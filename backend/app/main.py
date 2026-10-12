import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    status,
    Query,
    UploadFile,
    File,
    Request,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import or_, text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import engine, Base, SessionLocal, get_db
from app.models import (
    User,
    Product,
    SearchHistory,
    Category,
    ProductType,
    ProductSubType,
)
from app.schemas import (
    UserRegister,
    UserLogin,
    UserResponse,
    UserStatusUpdate,
    TokenResponse,
    CategoryCreate,
    CategoryResponse,
    ProductTypeCreate,
    ProductTypeResponse,
    ProductSubTypeCreate,
    ProductSubTypeResponse,
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
from app.seed import seed_initial_data, ensure_taxonomy_hierarchy

UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads"
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _ensure_sqlite_columns():
    """Ensure existing SQLite products table has category_id, type_id, sub_type_id columns."""
    with engine.begin() as conn:
        try:
            res = conn.execute(text("PRAGMA table_info(products)"))
            existing_cols = {row[1] for row in res.fetchall()}
            for col_name in ("category_id", "type_id", "sub_type_id"):
                if existing_cols and col_name not in existing_cols:
                    conn.execute(
                        text(f"ALTER TABLE products ADD COLUMN {col_name} INTEGER")
                    )
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _ensure_sqlite_columns()
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
        "name": "Taxonomy",
        "description": "Hierarchical Category -> Type -> Sub Type management.",
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

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


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

    if user.is_deleted or getattr(user, "status", "active") != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is inactive or archived. Please contact your BU Administrator.",
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


@app.get(
    "/api/users",
    response_model=List[UserResponse],
    tags=["Authentication"],
)
def list_users(
    include_archived: bool = Query(
        True, description="Whether to include archived users"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List team members and user accounts with lifecycle statuses (Requires Administrator privileges)."""
    if current_user.username != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted: Administrator role required to manage team accounts.",
        )
    query = db.query(User)
    if not include_archived:
        query = query.filter(User.is_deleted == False)
    return query.order_by(User.id.asc()).all()


@app.patch(
    "/api/users/{user_id}/status",
    response_model=UserResponse,
    tags=["Authentication"],
)
def update_user_status(
    user_id: int,
    payload: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update user account status ('active', 'inactive', 'archived')."""
    if current_user.username != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted: Administrator role required to manage team accounts.",
        )
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    target_user.status = payload.status
    if payload.status == "archived":
        target_user.is_deleted = True
        target_user.deleted_at = datetime.now(timezone.utc)
    else:
        target_user.is_deleted = False
        target_user.deleted_at = None

    db.commit()
    db.refresh(target_user)
    return target_user


# ==========================================
# 2. Protected Taxonomy Hierarchy Routes
#    Category (Largest) -> Type -> SubType
# ==========================================
@app.get(
    "/api/taxonomy",
    response_model=List[CategoryResponse],
    tags=["Taxonomy"],
)
def get_taxonomy_tree(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return full hierarchical Category -> Type -> SubType tree."""
    return db.query(Category).order_by(Category.id.asc()).all()


@app.post(
    "/api/taxonomy/categories",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Taxonomy"],
)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new top-level Category (or return existing if already present)."""
    clean_name = payload.name.strip()
    existing = db.query(Category).filter(Category.name.ilike(clean_name)).first()
    if existing:
        return existing
    cat = Category(name=clean_name)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@app.post(
    "/api/taxonomy/types",
    response_model=ProductTypeResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Taxonomy"],
)
def create_product_type(
    payload: ProductTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new Type related to a Category."""
    cat = db.query(Category).filter(Category.id == payload.category_id).first()
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Parent Category not found"
        )
    clean_name = payload.name.strip()
    existing = (
        db.query(ProductType)
        .filter(
            ProductType.category_id == cat.id,
            ProductType.name.ilike(clean_name),
        )
        .first()
    )
    if existing:
        return existing
    pt = ProductType(name=clean_name, category_id=cat.id)
    db.add(pt)
    db.commit()
    db.refresh(pt)
    return pt


@app.post(
    "/api/taxonomy/sub-types",
    response_model=ProductSubTypeResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Taxonomy"],
)
def create_product_sub_type(
    payload: ProductSubTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new Sub Type related to a Type."""
    pt = db.query(ProductType).filter(ProductType.id == payload.type_id).first()
    if not pt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Parent Type not found"
        )
    clean_name = payload.name.strip()
    existing = (
        db.query(ProductSubType)
        .filter(
            ProductSubType.type_id == pt.id,
            ProductSubType.name.ilike(clean_name),
        )
        .first()
    )
    if existing:
        return existing
    pst = ProductSubType(name=clean_name, type_id=pt.id)
    db.add(pst)
    db.commit()
    db.refresh(pst)
    return pst


# ==========================================
# 3. Protected Product Catalog CRUD Routes
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
    type_filter: Optional[str] = Query(
        None, alias="type", description="Filter by product type"
    ),
    sub_type_filter: Optional[str] = Query(
        None, alias="sub_type", description="Filter by product sub_type"
    ),
    status_filter: Optional[str] = Query(
        None,
        alias="status",
        description="Filter by status ('active', 'inactive', 'archived')",
    ),
    include_deleted: bool = Query(
        False, description="Whether to include soft-deleted products"
    ),
    page: Optional[int] = Query(
        None, ge=1, description="Optional 1-indexed page number (10 items per page)"
    ),
    limit: Optional[int] = Query(
        None, ge=1, le=100, description="Optional page size limit (default 10 when page is set)"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List products in the catalog (Requires valid JWT Token)."""
    query = db.query(Product)
    if not include_deleted:
        query = query.filter(Product.is_deleted == False)
    if category and category not in ("All Categories", "all", ""):
        query = query.filter(Product.category == category)
    if type_filter and type_filter not in ("All Types", "all", ""):
        query = query.filter(Product.type == type_filter)
    if sub_type_filter and sub_type_filter not in ("All Sub Types", "all", ""):
        query = query.filter(Product.sub_type == sub_type_filter)
    if status_filter and status_filter != "All Statuses":
        query = query.filter(Product.status == status_filter)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                Product.name.ilike(pattern),
                Product.brand.ilike(pattern),
                Product.description.ilike(pattern),
                Product.category.ilike(pattern),
                Product.type.ilike(pattern),
                Product.sub_type.ilike(pattern),
            )
        )
    query = query.order_by(Product.id.asc())
    if page is not None:
        page_size = limit or 10
        offset = (page - 1) * page_size
        return query.offset(offset).limit(page_size).all()
    if limit is not None:
        return query.limit(limit).all()
    return query.all()


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
    "/api/products/upload-image",
    tags=["Products"],
)
async def upload_product_image(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload a local product image file (PNG, JPG, WEBP, SVG) and return its served URL."""
    filename = file.filename or "product.png"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}:
        ext = ".png"

    unique_name = f"prod_{uuid.uuid4().hex[:12]}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    base_url = str(request.base_url).rstrip("/")
    image_url = f"{base_url}/uploads/{unique_name}"
    return {"image_url": image_url, "filename": unique_name}


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
    """Create a new product in the catalog and link to Category -> Type -> SubType tables."""
    cat_obj, type_obj, sub_obj = ensure_taxonomy_hierarchy(
        db, payload.category, payload.type, payload.sub_type
    )

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
                "title": f"Application Note: Deploying {payload.name} in {cat_obj.name}",
                "doc_type": "Publication",
                "summary": f"Best-practice guide and benchmark data for {type_obj.name} / {sub_obj.name}.",
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
        category_id=cat_obj.id,
        type_id=type_obj.id,
        sub_type_id=sub_obj.id,
        category=cat_obj.name,
        type=type_obj.name,
        sub_type=sub_obj.name,
        status=payload.status or "active",
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
    """Update an existing product in the catalog and sync taxonomy hierarchy."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    if any(k in update_data for k in ("category", "type", "sub_type")):
        cat_obj, type_obj, sub_obj = ensure_taxonomy_hierarchy(
            db,
            product.category or "General",
            product.type or "Standard",
            product.sub_type or "Standard",
        )
        product.category_id = cat_obj.id
        product.type_id = type_obj.id
        product.sub_type_id = sub_obj.id
        product.category = cat_obj.name
        product.type = type_obj.name
        product.sub_type = sub_obj.name

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
    """Soft delete a product from the catalog."""
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


@app.delete(
    "/api/products/{product_id}/permanent",
    status_code=status.HTTP_200_OK,
    tags=["Products"],
)
def delete_product_permanently(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete a product from the database (Hard Delete - irreversible)."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
        )
    db.delete(product)
    db.commit()
    return {
        "message": "Product permanently deleted from database",
        "deleted_id": product_id,
        "permanent": True,
    }


@app.delete(
    "/api/products/trash/empty",
    status_code=status.HTTP_200_OK,
    tags=["Products"],
)
def empty_trash(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently purge all soft-deleted items currently in the trash."""
    trash_items = db.query(Product).filter(Product.is_deleted == True).all()
    count = len(trash_items)
    for p in trash_items:
        db.delete(p)
    db.commit()
    return {
        "message": f"Purged {count} item(s) from trash permanently",
        "purged_count": count,
    }


# ==========================================
# 4. Protected AI Suggestion Routes
# ==========================================
@app.get(
    "/api/ai/status",
    tags=["AI Product Suggestion"],
)
def get_ai_status(
    current_user: User = Depends(get_current_user),
):
    """Check whether Detailed Search AI API is configured and available."""
    api_key = (settings.OPENROUTER_API_KEY or "").strip()
    return {
        "available": True,
        "has_openrouter_key": bool(api_key),
        "default_model": settings.DEFAULT_AI_MODEL,
    }


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
    recommendations (Requires valid JWT Token).
    """
    products = (
        db.query(Product)
        .filter(Product.is_deleted == False)
        .order_by(Product.id.asc())
        .all()
    )
    suggestion = await generate_product_suggestions(payload, products)

    if payload.query.strip():
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


@app.delete(
    "/api/ai/history/{history_id}",
    status_code=status.HTTP_200_OK,
    tags=["AI Product Suggestion"],
)
def delete_search_history_item(
    history_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a specific search history entry."""
    item = db.query(SearchHistory).filter(SearchHistory.id == history_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Search history entry not found",
        )
    db.delete(item)
    db.commit()
    return {"message": "History entry deleted", "deleted_id": history_id}


@app.delete(
    "/api/ai/history",
    status_code=status.HTTP_200_OK,
    tags=["AI Product Suggestion"],
)
def clear_search_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clear all search history entries."""
    deleted_count = db.query(SearchHistory).delete()
    db.commit()
    return {"message": "Search history cleared", "deleted_count": deleted_count}



# ==========================================
# 5. Protected Analytics Route
# ==========================================
@app.get("/api/analytics", tags=["Analytics"])
def get_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return portfolio and AI search metrics & breakdown data for charts in /analyze."""
    products = db.query(Product).filter(Product.is_deleted == False).all()
    deleted_count = db.query(Product).filter(Product.is_deleted == True).count()
    histories = db.query(SearchHistory).all()
    history_count = len(histories)

    categories = {}
    types_map = {}
    sub_types_map = {}
    brands = {}
    category_coverage = {}
    total_docs = 0
    total_cross_sells = 0

    for p in products:
        cat_name = p.category or "Uncategorized"
        t_name = p.type or "General"
        st_name = p.sub_type or "Standard"

        categories[cat_name] = categories.get(cat_name, 0) + 1
        types_map[t_name] = {"type": t_name, "category": cat_name, "count": types_map.get(t_name, {}).get("count", 0) + 1}
        sub_types_map[st_name] = {"sub_type": st_name, "type": t_name, "count": sub_types_map.get(st_name, {}).get("count", 0) + 1}
        brands[p.brand] = brands.get(p.brand, 0) + 1

        doc_cnt = len(p.supporting_documents or [])
        cs_cnt = len(p.cross_sell_products or [])
        total_docs += doc_cnt
        total_cross_sells += cs_cnt

        if cat_name not in category_coverage:
            category_coverage[cat_name] = {
                "category": cat_name,
                "skus": 0,
                "docs": 0,
                "cross_sells": 0,
            }
        category_coverage[cat_name]["skus"] += 1
        category_coverage[cat_name]["docs"] += doc_cnt
        category_coverage[cat_name]["cross_sells"] += cs_cnt

    quick_searches = sum(1 for h in histories if h.search_mode == "quick")
    detailed_searches = sum(1 for h in histories if h.search_mode == "detailed")

    return {
        "total_products": len(products),
        "total_searches": history_count,
        "total_supporting_documents": total_docs,
        "total_cross_sell_links": total_cross_sells,
        "total_archived": deleted_count,
        "categories_breakdown": [
            {"category": k, "count": v} for k, v in categories.items()
        ],
        "types_breakdown": list(types_map.values()),
        "sub_types_breakdown": list(sub_types_map.values()),
        "brands_breakdown": [
            {"brand": k, "count": v} for k, v in brands.items()
        ],
        "search_modes_breakdown": [
            {"mode": "Quick Search", "count": quick_searches},
            {"mode": "Detailed AI Search", "count": detailed_searches},
        ],
        "category_coverage": list(category_coverage.values()),
    }
