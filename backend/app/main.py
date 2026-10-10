from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.config import settings
from app.database import engine, Base, SessionLocal, get_db
from app.models import User, Product, SearchHistory
from app.schemas import (
    UserRegister,
    UserLogin,
    UserResponse,
    TokenResponse,
    ProductCreate,
    ProductUpdate,
    ProductStatusUpdate,
    ProductResponse,
    AISuggestRequest,
    AISuggestResponse,
    SearchHistoryResponse,
)
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)
from app.ai_service import generate_product_suggestions
from app.seed import seed_initial_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_initial_data(db)
    finally:
        db.close()
    yield


openapi_tags = [
    {
        "name": "Health",
        "description": "Service health check for Docker container orchestration and monitoring.",
    },
    {
        "name": "Authentication",
        "description": "User registration (bcrypt password hashing) and login with 1-hour JWT token issuance.",
    },
    {
        "name": "Products",
        "description": "Protected CRUD endpoints for managing the Product Catalog.",
    },
    {
        "name": "AI Product Suggestion",
        "description": "OpenRouter AI-powered Product Suggestion, Supporting Documents, and Cross-selling engine.",
    },
    {
        "name": "Analytics",
        "description": "Portfolio and search analytics for the Sales Support Hub dashboard.",
    },
]

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "AI-powered Sales Support Hub RESTful API built with FastAPI and OpenRouter.\n\n"
        "### Key Capabilities\n"
        "- **Product Suggestion**: Recommends optimal products based on natural language customer needs.\n"
        "- **Supporting Documents**: Recommends validation reports and peer-reviewed publications.\n"
        "- **Cross-selling**: Identifies related products and accessories to maximize deal value.\n"
        "- **Security**: Bcrypt password hashing and 1-hour JWT Bearer route protection."
    ),
    openapi_tags=openapi_tags,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["Health"])
def health_check():
    """Health check endpoint used by Docker Compose and CI/CD pipelines."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
    }


# ==========================================
# 1. Authentication Routes
# ==========================================
@app.post(
    "/api/auth/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Authentication"],
)
def register_user(payload: UserRegister, db: Session = Depends(get_db)):
    """Register a new user with Username, Email, and bcrypt-hashed Password (never stored as plain text)."""
    existing_user = (
        db.query(User)
        .filter(
            or_(
                User.username == payload.username,
                User.email == payload.email,
            )
        )
        .first()
    )
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or Email is already registered",
        )

    new_user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post(
    "/api/auth/login",
    response_model=TokenResponse,
    tags=["Authentication"],
)
def login_user(payload: UserLogin, db: Session = Depends(get_db)):
    """Authenticate user with Username/Email and Password; returns a JWT response valid for 1 hour (3600 seconds)."""
    user = (
        db.query(User)
        .filter(
            or_(
                User.username == payload.username,
                User.email == payload.username,
            )
        )
        .first()
    )
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token, expires_at = create_access_token(
        data={"sub": user.username, "user_id": user.id}
    )
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        expires_at=expires_at,
        user=user,
    )


@app.get(
    "/api/auth/me",
    response_model=UserResponse,
    tags=["Authentication"],
)
def get_me(current_user: User = Depends(get_current_user)):
    """Verify current JWT token and return the authenticated user profile."""
    return current_user


# ==========================================
# 2. Protected Product Catalog CRUD Routes
# ==========================================
@app.get(
    "/api/products",
    response_model=List[ProductResponse],
    tags=["Products"],
)
def list_products(
    search: Optional[str] = Query(
        None, description="Search by product name, brand, or description"
    ),
    category: Optional[str] = Query(None, description="Filter by category"),
    status_filter: Optional[str] = Query(
        None, alias="status", description="Filter by status ('active', 'inactive', 'archived')"
    ),
    include_deleted: bool = Query(
        False, description="Whether to include soft-deleted products"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List products in the catalog (Requires valid JWT Token). Defaults to active products only."""
    query = db.query(Product)
    if not include_deleted:
        query = query.filter(Product.is_deleted == False)
    if category and category != "All Categories":
        query = query.filter(Product.category == category)
    if status_filter and status_filter != "All Statuses":
        query = query.filter(Product.status == status_filter)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                Product.name.ilike(pattern),
                Product.brand.ilike(pattern),
                Product.description.ilike(pattern),
            )
        )
    return query.order_by(Product.id.asc()).all()


@app.get(
    "/api/products/{product_id}",
    response_model=ProductResponse,
    tags=["Products"],
)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single product by ID (Requires valid JWT Token)."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
        )
    return product


@app.post(
    "/api/products",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Products"],
)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new product in the catalog (Requires valid JWT Token)."""
    default_docs = (
        [doc.model_dump() for doc in payload.supporting_documents]
        if payload.supporting_documents
        else [
            {
                "title": f"{payload.name} Technical Qualification & Validation Report",
                "doc_type": "Validation Report",
                "summary": f"Standard quality and performance validation report for {payload.name} ({payload.brand}).",
                "url": "#",
            },
            {
                "title": f"Application Note: Deploying {payload.name} in {payload.category}",
                "doc_type": "Publication",
                "summary": f"Best-practice guide and benchmark data for {payload.type} / {payload.sub_type}.",
                "url": "#",
            },
        ]
    )
    default_cross_sell = (
        [cs.model_dump() for cs in payload.cross_sell_products]
        if payload.cross_sell_products
        else [
            {
                "product_name": f"{payload.brand} Preventative Maintenance & Calibration Kit",
                "category": "Service & Accessories",
                "reason": f"Recommended annual qualification and consumables kit for {payload.name}.",
            }
        ]
    )

    product = Product(
        name=payload.name,
        brand=payload.brand,
        description=payload.description,
        image_url=payload.image_url,
        category=payload.category,
        type=payload.type,
        sub_type=payload.sub_type,
        supporting_documents=default_docs,
        cross_sell_products=default_cross_sell,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@app.put(
    "/api/products/{product_id}",
    response_model=ProductResponse,
    tags=["Products"],
)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing product in the catalog (Requires valid JWT Token)."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return product


@app.patch(
    "/api/products/{product_id}/status",
    response_model=ProductResponse,
    tags=["Products"],
)
def update_product_status(
    product_id: int,
    payload: ProductStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Quickly update product lifecycle status ('active', 'inactive', 'archived')."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
        )
    product.status = payload.status
    db.commit()
    db.refresh(product)
    return product


@app.delete(
    "/api/products/{product_id}",
    status_code=status.HTTP_200_OK,
    tags=["Products"],
)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft delete a product from the catalog (Preserves data integrity for audit and restoration)."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
        )
    product.is_deleted = True
    product.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return {
        "message": "Product soft-deleted successfully",
        "deleted_id": product_id,
        "is_deleted": True,
    }


@app.post(
    "/api/products/{product_id}/restore",
    response_model=ProductResponse,
    tags=["Products"],
)
def restore_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Restore a previously soft-deleted product back into the active catalog."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
        )
    product.is_deleted = False
    product.deleted_at = None
    db.commit()
    db.refresh(product)
    return product


# ==========================================
# 3. Protected AI Suggestion Routes (OpenRouter)
# ==========================================
@app.post(
    "/api/ai/suggest",
    response_model=AISuggestResponse,
    tags=["AI Product Suggestion"],
)
async def ai_suggest_products(
    payload: AISuggestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate AI-powered Product Suggestions, Supporting Documents, and Cross-selling
    recommendations via OpenRouter (Requires valid JWT Token).
    """
    products = (
        db.query(Product)
        .filter(Product.is_deleted == False, Product.status == "active")
        .order_by(Product.id.asc())
        .all()
    )
    suggestion = await generate_product_suggestions(payload, products)

    history_entry = SearchHistory(
        user_id=current_user.id,
        query=payload.query,
        search_mode=payload.search_mode,
        model_used=suggestion.model_used,
        results=suggestion.model_dump(mode="json"),
    )
    db.add(history_entry)
    db.commit()

    return suggestion


@app.get(
    "/api/ai/history",
    response_model=List[SearchHistoryResponse],
    tags=["AI Product Suggestion"],
)
def get_search_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve recent AI product search history (Requires valid JWT Token)."""
    return (
        db.query(SearchHistory)
        .order_by(SearchHistory.id.desc())
        .limit(20)
        .all()
    )


# ==========================================
# 4. Protected Analytics Route
# ==========================================
@app.get("/api/analytics", tags=["Analytics"])
def get_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return portfolio and AI search metrics for the Analytics Dashboard tab."""
    products = db.query(Product).filter(Product.is_deleted == False).all()
    deleted_count = db.query(Product).filter(Product.is_deleted == True).count()
    history_count = db.query(SearchHistory).count()

    categories = {}
    brands = {}
    total_docs = 0
    total_cross_sells = 0

    status_counts = {"active": 0, "inactive": 0, "archived": 0}
    for p in products:
        categories[p.category] = categories.get(p.category, 0) + 1
        brands[p.brand] = brands.get(p.brand, 0) + 1
        total_docs += len(p.supporting_documents or [])
        total_cross_sells += len(p.cross_sell_products or [])
        st = getattr(p, "status", "active") or "active"
        status_counts[st] = status_counts.get(st, 0) + 1

    return {
        "total_products": len(products),
        "total_active": status_counts.get("active", 0),
        "total_inactive": status_counts.get("inactive", 0),
        "total_archived_status": status_counts.get("archived", 0),
        "total_searches": history_count,
        "total_supporting_documents": total_docs,
        "total_cross_sell_links": total_cross_sells,
        "total_archived": deleted_count,
        "categories_breakdown": [
            {"category": k, "count": v} for k, v in categories.items()
        ],
        "brands_breakdown": [
            {"brand": k, "count": v} for k, v in brands.items()
        ],
    }
