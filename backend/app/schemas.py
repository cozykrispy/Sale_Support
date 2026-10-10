from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict


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
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 3600  # 1 hour (3600 seconds)
    expires_at: datetime
    user: UserResponse


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


class ProductBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=200, description="Product Name *")
    brand: str = Field(..., min_length=1, max_length=150, description="Brand *")
    description: str = Field(
        ...,
        min_length=10,
        description="Description * (minimum 10 characters)",
    )
    image_url: str = Field(..., min_length=1, max_length=500, description="Image URL *")
    category: str = Field(..., min_length=1, max_length=150, description="Category *")
    type: str = Field(..., min_length=1, max_length=150, description="Type *")
    sub_type: str = Field(..., min_length=1, max_length=150, description="Sub Type *")
    supporting_documents: Optional[List[SupportingDocItem]] = Field(default_factory=list)
    cross_sell_products: Optional[List[CrossSellItem]] = Field(default_factory=list)


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    brand: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = Field(None, min_length=10)
    image_url: Optional[str] = Field(None, min_length=1, max_length=500)
    category: Optional[str] = Field(None, min_length=1, max_length=150)
    type: Optional[str] = Field(None, min_length=1, max_length=150)
    sub_type: Optional[str] = Field(None, min_length=1, max_length=150)
    supporting_documents: Optional[List[SupportingDocItem]] = None
    cross_sell_products: Optional[List[CrossSellItem]] = None


class ProductResponse(ProductBase):
    id: int
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- AI Product Suggestion Schemas (Figure 1 & Figure 2) ---
class SuggestedProductResult(BaseModel):
    product_id: Optional[int] = None
    name: str
    brand: str
    category: str
    type: str
    sub_type: str
    image_url: str
    match_score: int = Field(..., ge=0, le=100)
    reasoning: str
    key_benefits: List[str] = Field(default_factory=list)


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
        ...,
        min_length=3,
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


class AISuggestResponse(BaseModel):
    query: str
    search_mode: str
    model_used: str
    inference_source: str
    executive_summary: str
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
