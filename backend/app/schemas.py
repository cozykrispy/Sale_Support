from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator


# --- Auth Schemas ---
class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=100, description="Username ผู้ใช้งาน")
    email: EmailStr = Field(..., description="Email อีเมล์ของผู้ใช้งาน")
    password: str = Field(..., min_length=6, max_length=128, description="Password รหัสผ่านของผู้ใช้งาน")


class UserLogin(BaseModel):
    username: str = Field(..., description="Username หรือ Email สำหรับยืนยันตัวตน")
    password: str = Field(..., description="Password รหัสผ่าน")


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    status: str = "active"
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(active|inactive|archived)$", description="New status ('active', 'inactive', 'archived')")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 3600  # 1 hour (3600 seconds)
    expires_at: datetime
    user: UserResponse


# --- Taxonomy Schemas (Category -> Type -> SubType) ---
class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)


class ProductTypeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    category_id: int


class ProductSubTypeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    type_id: int


class ProductSubTypeResponse(BaseModel):
    id: int
    name: str
    type_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProductTypeResponse(BaseModel):
    id: int
    name: str
    category_id: int
    sub_types: List[ProductSubTypeResponse] = Field(default_factory=list)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CategoryResponse(BaseModel):
    id: int
    name: str
    types: List[ProductTypeResponse] = Field(default_factory=list)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Product Schemas ---
class SupportingDocItem(BaseModel):
    title: str
    doc_type: str = "Validation Report"
    summary: str
    url: str = "#"


class CrossSellItem(BaseModel):
    product_name: str
    category: str
    reason: str


def _validate_description_word_limit(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    words = [w for w in v.strip().split() if w]
    if len(words) > 1000:
        raise ValueError(f"Description must not exceed 1,000 words (currently {len(words)} words).")
    return v


class ProductBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=200, description="Product Name *")
    brand: str = Field(..., min_length=1, max_length=150, description="Brand *")
    description: str = Field(
        ...,
        min_length=10,
        description="Description * (minimum 10 characters, max 1000 words)",
    )
    image_url: str = Field(..., min_length=1, max_length=500, description="Image URL *")
    category: str = Field(..., min_length=1, max_length=150, description="Category *")
    type: str = Field(..., min_length=1, max_length=150, description="Type *")
    sub_type: str = Field(..., min_length=1, max_length=150, description="Sub Type *")
    category_id: Optional[int] = None
    type_id: Optional[int] = None
    sub_type_id: Optional[int] = None
    status: str = Field(default="active", description="Product status: 'active', 'inactive', 'archived'")
    supporting_documents: Optional[List[SupportingDocItem]] = Field(default_factory=list)
    cross_sell_products: Optional[List[CrossSellItem]] = Field(default_factory=list)

    @field_validator("description")
    @classmethod
    def check_word_limit(cls, v: str) -> str:
        return _validate_description_word_limit(v) or v


class ProductCreate(ProductBase):
    pass


class ProductStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(active|inactive|archived)$", description="New status ('active', 'inactive', 'archived')")


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    brand: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = Field(None, min_length=10)
    image_url: Optional[str] = Field(None, min_length=1, max_length=500)
    category: Optional[str] = Field(None, min_length=1, max_length=150)
    type: Optional[str] = Field(None, min_length=1, max_length=150)
    sub_type: Optional[str] = Field(None, min_length=1, max_length=150)
    category_id: Optional[int] = None
    type_id: Optional[int] = None
    sub_type_id: Optional[int] = None
    status: Optional[str] = Field(None, pattern="^(active|inactive|archived)$")
    supporting_documents: Optional[List[SupportingDocItem]] = None
    cross_sell_products: Optional[List[CrossSellItem]] = None

    @field_validator("description")
    @classmethod
    def check_word_limit(cls, v: Optional[str]) -> Optional[str]:
        return _validate_description_word_limit(v)


class ProductResponse(ProductBase):
    id: int
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- AI Product Suggestion Schemas ---
class SuggestedProductResult(BaseModel):
    product_id: Optional[int] = None
    name: str
    brand: str
    description: str = ""
    category: str
    type: str
    sub_type: str
    category_id: Optional[int] = None
    type_id: Optional[int] = None
    sub_type_id: Optional[int] = None
    image_url: str
    match_score: int = Field(..., ge=0, le=100)
    reasoning: str
    key_benefits: List[str] = Field(default_factory=list)
    supporting_documents: List[SupportingDocItem] = Field(default_factory=list)
    cross_sell_products: List[CrossSellItem] = Field(default_factory=list)


class SupportingDocumentResult(BaseModel):
    title: str
    doc_type: str
    related_product: str
    relevance: str
    url: str = "#"


class CrossSellingResult(BaseModel):
    product_name: str
    category: str
    paired_with: str
    pitch_reason: str


class AISuggestRequest(BaseModel):
    query: str = Field(
        default="",
        description="Customer needs description in natural language",
    )
    search_mode: str = Field(
        default="quick",
        description="Search mode: 'quick' or 'detailed'",
    )
    model: str = Field(
        default="Auto (default)",
        description="OpenRouter AI model identifier or 'Auto (default)'",
    )
    category: Optional[str] = Field(
        default=None,
        description="Optional category advance filter",
    )
    type: Optional[str] = Field(
        default=None,
        description="Optional type advance filter",
    )
    sub_type: Optional[str] = Field(
        default=None,
        description="Optional sub_type advance filter",
    )


class AISuggestResponse(BaseModel):
    query: str
    search_mode: str
    model_used: str
    inference_source: str
    executive_summary: str
    closing_note: str = ""
    suggested_products: List[SuggestedProductResult]
    supporting_documents: List[SupportingDocumentResult]
    cross_selling: List[CrossSellingResult]
    created_at: datetime

    model_config = ConfigDict(protected_namespaces=())


class SearchHistoryResponse(BaseModel):
    id: int
    query: str
    search_mode: str
    model_used: str
    results: dict
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())
