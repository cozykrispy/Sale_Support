import os
import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite://"

from app.main import app
from app.config import settings
from app.database import Base, get_db
from app.models import User
from app.seed import seed_initial_data

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_initial_data(db)
    db.close()
    yield


client = TestClient(app)


def test_health_and_swagger_spec():
    """Verify health endpoint and Swagger OpenAPI spec availability."""
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"

    docs_res = client.get("/docs")
    assert docs_res.status_code == 200

    openapi_res = client.get("/openapi.json")
    assert openapi_res.status_code == 200
    assert "Fusion Advantec" in openapi_res.json()["info"]["title"]


def test_register_hashes_password_not_plain_text():
    """Verify Register endpoint stores password as bcrypt hash, never plain text."""
    plain_password = "MySecretPassword123!"
    res = client.post(
        "/api/auth/register",
        json={
            "username": "sales_specialist",
            "email": "sales@fusion.co.th",
            "password": plain_password,
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["username"] == "sales_specialist"
    assert data["email"] == "sales@fusion.co.th"
    assert "password" not in data

    # Verify in database that password is NOT stored in plain text
    db = TestingSessionLocal()
    user_in_db = db.query(User).filter(User.username == "sales_specialist").first()
    db.close()
    assert user_in_db is not None
    assert user_in_db.hashed_password != plain_password
    assert user_in_db.hashed_password.startswith("$2b$")


def test_login_returns_one_hour_token():
    """Verify Login endpoint authenticates user and issues a 1-hour (3600s) JWT token."""
    client.post(
        "/api/auth/register",
        json={
            "username": "bu_leader",
            "email": "bu@fusion.co.th",
            "password": "StrongPassword99",
        },
    )
    login_res = client.post(
        "/api/auth/login",
        json={"username": "bu_leader", "password": "StrongPassword99"},
    )
    assert login_res.status_code == 200
    body = login_res.json()
    assert "access_token" in body
    assert body["expires_in"] == 3600

    payload = jwt.decode(
        body["access_token"],
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )
    assert payload["sub"] == "bu_leader"
    assert payload["exp"] - payload["iat"] == 3600


def test_protected_routes_reject_missing_or_invalid_token():
    """Verify all protected routes require a valid JWT token."""
    assert client.get("/api/products").status_code == 401
    assert client.post("/api/products", json={}).status_code == 401
    assert (
        client.post("/api/ai/suggest", json={"query": "chromatography"}).status_code
        == 401
    )
    assert (
        client.get(
            "/api/products",
            headers={"Authorization": "Bearer invalid.jwt.token"},
        ).status_code
        == 401
    )


def test_product_crud_lifecycle():
    """Verify full Create, Read, Update, Delete lifecycle on Products with JWT protection."""
    login_res = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "Admin@1234"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Read initial 3 seeded products
    list_res = client.get("/api/products", headers=headers)
    assert list_res.status_code == 200
    products = list_res.json()
    assert len(products) == 3
    assert products[0]["name"] == "DynaChrom system"

    # 2. Create new product
    create_res = client.post(
        "/api/products",
        headers=headers,
        json={
            "name": "AKTA Pure 25 Chromatography System",
            "brand": "Cytiva",
            "description": "Flexible and intuitive chromatography system for fast purification of proteins, peptides, and nucleic acids.",
            "image_url": "https://example.com/akta-pure.jpg",
            "category": "Chromatography Systems",
            "type": "Lab Scale Equipment",
            "sub_type": "FPLC System",
        },
    )
    assert create_res.status_code == 201
    new_prod = create_res.json()
    prod_id = new_prod["id"]
    assert new_prod["name"] == "AKTA Pure 25 Chromatography System"

    # 3. Update product
    update_res = client.put(
        f"/api/products/{prod_id}",
        headers=headers,
        json={"brand": "Cytiva Life Sciences"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["brand"] == "Cytiva Life Sciences"

    # 4. Delete product
    del_res = client.delete(f"/api/products/{prod_id}", headers=headers)
    assert del_res.status_code == 200
    assert len(client.get("/api/products", headers=headers).json()) == 3


def test_ai_product_suggestion_returns_three_pillars():
    """Verify AI suggestion returns Product Suggestions, Supporting Documents, and Cross-selling."""
    login_res = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "Admin@1234"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    suggest_res = client.post(
        "/api/ai/suggest",
        headers=headers,
        json={
            "query": "Need automated single-use chromatography system for mAb purification",
            "search_mode": "detailed",
            "model": "Auto (default)",
        },
    )
    assert suggest_res.status_code == 200
    data = suggest_res.json()
    assert len(data["suggested_products"]) >= 1
    assert data["suggested_products"][0]["name"] == "DynaChrom system"
    assert len(data["supporting_documents"]) >= 1
    assert len(data["cross_selling"]) >= 1
