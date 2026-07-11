"""All Pydantic request/response models shared across engines."""
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict


# ==================== AUTH ====================
class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    username: str
    role: Optional[str] = "creator"
    looking_for: Optional[List[str]] = []


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdate(BaseModel):
    name: str
    bio: Optional[str] = ""
    role: Optional[str] = None
    looking_for: Optional[List[str]] = None
    skills: Optional[List[str]] = None
    years_experience: Optional[int] = None
    intro_video_url: Optional[str] = None
    certifications: Optional[List[Dict]] = None
    portfolio: Optional[List[Dict]] = None


# ==================== MARKETPLACE ====================
class ServiceCreate(BaseModel):
    title: str
    description: str
    price: float
    delivery_days: int = 3


class OrderCreate(BaseModel):
    service_id: str
    notes: Optional[str] = ""


class ReviewCreate(BaseModel):
    order_id: str
    rating: int  # 1-5
    text: Optional[str] = ""


class ProjectRequestCreate(BaseModel):
    title: str
    description: str
    category: str
    budget_min: Optional[float] = 0
    budget_max: Optional[float] = 0
    deadline_days: Optional[int] = 7


class ApplicationCreate(BaseModel):
    message: str
    proposed_price: Optional[float] = 0


# ==================== PAYMENTS ====================
class CheckoutRequest(BaseModel):
    order_id: str
    origin_url: str


# ==================== SOCIAL ====================
class CommentCreate(BaseModel):
    text: str


class MessageCreate(BaseModel):
    text: str


# ==================== COMMUNITIES / TEAMS ====================
class PostCreate(BaseModel):
    text: str


class TeamCreate(BaseModel):
    name: str
    description: str
    kind: Optional[str] = "team"


# ==================== INCUBATOR ====================
class IdeaCreate(BaseModel):
    title: str
    description: str


class StageUpdate(BaseModel):
    stage: int  # 1-7
    progress: int  # 0-100
    notes: Optional[str] = ""


# ==================== AI ====================
class AIRequest(BaseModel):
    task: str
    context: str


# ==================== EVENTS / ACADEMY ====================
class EventCreate(BaseModel):
    title: str
    description: str
    kind: str = "workshop"
    date: str
    location: str = ""
    price: float = 0
    capacity: int = 50


class CourseCreate(BaseModel):
    title: str
    description: str
    price: float = 0
    lessons: List[Dict] = []


# ==================== CRM ====================
class LeadCreate(BaseModel):
    name: str
    email: EmailStr
    story: str


# ==================== CONTENT OS ====================
class ContentCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    platform: str = "instagram"
    format: str = "post"
    status: Optional[str] = "idea"
    scheduled_at: Optional[str] = None  # ISO datetime
    caption: Optional[str] = ""
    hook: Optional[str] = ""
    script: Optional[str] = ""
    hashtags: Optional[str] = ""
    tags: Optional[List[str]] = []
    client_id: Optional[str] = None  # optional link to CRM client


class ContentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    platform: Optional[str] = None
    format: Optional[str] = None
    scheduled_at: Optional[str] = None
    caption: Optional[str] = None
    hook: Optional[str] = None
    script: Optional[str] = None
    hashtags: Optional[str] = None
    tags: Optional[List[str]] = None
    client_id: Optional[str] = None


class ContentStatusMove(BaseModel):
    status: str


class ContentAIRequest(BaseModel):
    topic: str  # topic/context for ideas OR content title for script
    platform: Optional[str] = "instagram"
    format: Optional[str] = "reel"


class ClientCreate(BaseModel):
    name: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    company: Optional[str] = ""
    industry: Optional[str] = ""
    address: Optional[str] = ""
    notes: Optional[str] = ""
    tags: Optional[List[str]] = []
    source: Optional[str] = "manual"  # manual | lead | referral | website | other
    status: Optional[str] = "active"  # active | inactive | archived


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    industry: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None


class DealCreate(BaseModel):
    title: str
    client_id: str
    value: float = 0
    currency: str = "USD"
    stage: Optional[str] = "new"  # new | contacted | qualified | proposal | negotiation | won | lost
    expected_close_date: Optional[str] = ""  # ISO date
    notes: Optional[str] = ""
    tags: Optional[List[str]] = []
    source_lead_id: Optional[str] = None


class DealUpdate(BaseModel):
    title: Optional[str] = None
    value: Optional[float] = None
    currency: Optional[str] = None
    expected_close_date: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None


class DealMove(BaseModel):
    stage: str


class ActivityCreate(BaseModel):
    client_id: Optional[str] = None
    deal_id: Optional[str] = None
    type: str  # note | call | email | meeting | task
    title: str
    description: Optional[str] = ""
    date: Optional[str] = None  # ISO datetime

