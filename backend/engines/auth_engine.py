"""Auth Engine: signup, login, me."""
import uuid
from fastapi import APIRouter, HTTPException, Depends

from core.deps import db, now_iso, hash_password, verify_password, create_token, current_user
from core.schemas import SignupRequest, LoginRequest

router = APIRouter(tags=["auth"])


@router.post("/auth/signup")
async def signup(data: SignupRequest):
    if await db.users.find_one({"email": data.email}):
        raise HTTPException(400, "البريد الإلكتروني مسجل مسبقاً")
    if await db.users.find_one({"username": data.username}):
        raise HTTPException(400, "اسم المستخدم غير متاح")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": data.email,
        "username": data.username,
        "name": data.name,
        "password": hash_password(data.password),
        "bio": "",
        "avatar_url": "",
        "role": data.role or "creator",
        "looking_for": data.looking_for or [],
        "skills": [],
        "years_experience": 0,
        "intro_video_url": "",
        "certifications": [],
        "portfolio": [],
        "is_creator": True,
        "followers": 0,
        "following": 0,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    token = create_token(user_id)
    doc.pop("_id", None)
    return {"token": token, "user": {k: v for k, v in doc.items() if k != "password"}}


@router.post("/auth/login")
async def login(data: LoginRequest):
    user = await db.users.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(401, "بيانات الدخول غير صحيحة")
    token = create_token(user["id"])
    user.pop("password", None)
    user.pop("_id", None)
    return {"token": token, "user": user}


@router.get("/auth/me")
async def me(user=Depends(current_user)):
    return user
