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
