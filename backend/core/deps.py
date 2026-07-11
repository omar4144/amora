"""
Shared infrastructure & dependencies used by ALL engines.
Single source of truth for: db, auth, security, storage, helpers, constants.
"""
import os
import uuid
import logging
import bcrypt
import jwt
import requests
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional
from dotenv import load_dotenv

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# ==================== CONFIG ====================
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
STRIPE_API_KEY = os.environ['STRIPE_API_KEY']
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
APP_NAME = os.environ.get('APP_NAME', 'creator-hub')
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*').split(',')

PLATFORM_FEE_PERCENT = 10.0
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"

logger = logging.getLogger("ruaa")

# ==================== DATABASE ====================
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ==================== SECURITY ====================
security = HTTPBearer(auto_error=False)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode('utf-8'), hashed.encode('utf-8'))


def create_token(user_id: str) -> str:
    payload = {"user_id": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


async def current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def optional_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        return await db.users.find_one({"id": payload["user_id"]}, {"_id": 0, "password": 0})
    except jwt.PyJWTError:
        return None


# ==================== STORAGE (Emergent Object Storage) ====================
storage_key = None


def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        return storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=180,
    )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60,
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ==================== NOTIFICATIONS HELPER ====================
async def create_notification(user_id: str, type_: str, text: str, ref_id: str = "", from_user_id: str = ""):
    if user_id == from_user_id:
        return
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": type_,
        "text": text,
        "ref_id": ref_id,
        "from_user_id": from_user_id,
        "seen": False,
        "created_at": now_iso(),
    })


# ==================== CONSTANTS / SEEDS ====================
INCUBATOR_STAGES = [
    {"id": 1, "name": "الفكرة", "icon": "💡"},
    {"id": 2, "name": "تحليل السوق", "icon": "📊"},
    {"id": 3, "name": "الهوية", "icon": "🎨"},
    {"id": 4, "name": "الخطة المالية", "icon": "💰"},
    {"id": 5, "name": "بناء البراند", "icon": "🏷️"},
    {"id": 6, "name": "التسويق", "icon": "📣"},
    {"id": 7, "name": "الإطلاق", "icon": "🚀"},
]

COMMUNITIES_SEED = [
    {"slug": "doctors", "name": "الأطباء", "icon": "🩺"},
    {"slug": "photographers", "name": "المصورون", "icon": "📷"},
    {"slug": "cafes", "name": "المقاهي", "icon": "☕"},
    {"slug": "restaurants", "name": "المطاعم", "icon": "🍽️"},
    {"slug": "artists", "name": "الفنانون", "icon": "🎨"},
    {"slug": "entrepreneurs", "name": "رواد الأعمال", "icon": "💼"},
    {"slug": "designers", "name": "المصممون", "icon": "✏️"},
    {"slug": "musicians", "name": "الموسيقيون", "icon": "🎵"},
    {"slug": "actors", "name": "الممثلون", "icon": "🎭"},
    {"slug": "writers", "name": "الكتّاب", "icon": "📝"},
]

AI_PROMPTS = {
    "reels_script": "أنت خبير محتوى Reels/TikTok باللغة العربية. اكتب سيناريو ريلز جذاب (30-60 ثانية) بناءً على الفكرة التالية. قسّم لخطاطة: Hook (أول 3 ثواني)، المحتوى، الخاتمة (CTA). استخدم أسلوب عصري وحيوي.",
    "marketing_plan": "أنت مستشار تسويق. ضع خطة تسويقية عربية شاملة (30 يوماً) للمشروع التالي. تشمل: الجمهور المستهدف، المنصات، أنواع المحتوى، ميزانية مقترحة، KPIs.",
    "project_names": "أنت خبير علامات تجارية. اقترح 10 أسماء مشاريع إبداعية عربية/عالمية للفكرة التالية. مع شرح مختصر لكل اسم ودلالته.",
    "account_analysis": "أنت خبير سوشيال ميديا. حلل حساب المستخدم بناءً على المعطيات. قدم: نقاط القوة، نقاط الضعف، توصيات فورية، خطة نمو.",
    "pricing": "أنت خبير تسعير خدمات. اقترح أسعار خدمات صانع المحتوى/المستقل بناءً على معطياته. قدم: أدنى، متوسط، مميز، مع تبرير لكل سعر.",
    "profile_bio": "اكتب bio احترافي عربي جذاب (2-3 أسطر) للمستخدم بناءً على معطياته. يبرز خبرته وقيمته الفريدة.",
    "competitors": "أنت محلل سوق. حدد أبرز 5 منافسين للمشروع وأنشط ميزاتهم وثغرات يمكن استغلالها.",
    # Newly added for AI-Everywhere (Iteration 8+)
    "video_hooks": "أنت خبير هوكات فيديو. اقترح 8 هوكات (Hooks) قوية جذّابة عربية للفيديو التالي، بحيث يمسك المشاهد أول 3 ثواني.",
    "suggest_price": "أنت مسعّر خدمات إبداعية في السوق العربي. بناء على وصف الخدمة اقترح سعرين: ودّي (Starter) وعادل (Standard) وممتاز (Premium) بالدولار مع تبرير قصير لكل واحد.",
    "deal_close": "أنت خبير مبيعات B2B. بناء على معطيات صفقة، توقّع احتمال إغلاقها 0-100% ولخّص السبب في 3 نقاط عربية.",
    "improve_bio": "حسّن نص الـ Bio الحالي للمستخدم مع الحفاظ على شخصيته. اجعله أكثر جذباً وإقناعاً.",
}


# ==================== HELPERS ====================
def strip_id(doc: dict) -> dict:
    if doc:
        doc.pop("_id", None)
    return doc


def conv_id(a: str, b: str) -> str:
    return "_".join(sorted([a, b]))
