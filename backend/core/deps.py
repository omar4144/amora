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

# CRM Pipeline stages (with default probability %)
DEAL_STAGES = [
    {"key": "new",          "name": "\u062c\u062f\u064a\u062f",         "probability": 0,   "color": "#94A3B8"},
    {"key": "contacted",    "name": "\u062a\u0648\u0627\u0635\u0644",       "probability": 10,  "color": "#57769D"},
    {"key": "qualified",    "name": "\u0645\u0624\u0647\u0651\u0644",       "probability": 25,  "color": "#8B5CF6"},
    {"key": "proposal",     "name": "\u0639\u0631\u0636 \u0645\u0642\u062f\u0651\u0645",  "probability": 50,  "color": "#F59E0B"},
    {"key": "negotiation",  "name": "\u062a\u0641\u0627\u0648\u0636",       "probability": 75,  "color": "#EF4444"},
    {"key": "won",          "name": "\u0641\u0627\u0632",           "probability": 100, "color": "#C3E0A5"},
    {"key": "lost",         "name": "\u062e\u0633\u0631",           "probability": 0,   "color": "#6B7280"},
]
DEAL_STAGE_KEYS = [s["key"] for s in DEAL_STAGES]

# Content OS constants
CONTENT_STATUSES = [
    {"key": "idea",       "name": "\u0641\u0643\u0631\u0629",       "color": "#94A3B8"},
    {"key": "draft",      "name": "\u0645\u0633\u0648\u062f\u0651\u0629",     "color": "#57769D"},
    {"key": "review",     "name": "\u0645\u0631\u0627\u062c\u0639\u0629",     "color": "#F59E0B"},
    {"key": "approved",   "name": "\u0645\u0639\u062a\u0645\u062f\u0629",     "color": "#8B5CF6"},
    {"key": "scheduled",  "name": "\u0645\u062c\u062f\u0648\u0644\u0629",     "color": "#06B6D4"},
    {"key": "published",  "name": "\u0645\u0646\u0634\u0648\u0631\u0629",     "color": "#C3E0A5"},
    {"key": "archived",   "name": "\u0645\u0624\u0631\u0634\u0641\u0629",     "color": "#6B7280"},
]
CONTENT_STATUS_KEYS = [s["key"] for s in CONTENT_STATUSES]

CONTENT_PLATFORMS = [
    {"key": "instagram", "name": "\u0625\u0646\u0633\u062a\u0642\u0631\u0627\u0645", "color": "#E1306C"},
    {"key": "tiktok",    "name": "\u062a\u064a\u0643 \u062a\u0648\u0643",         "color": "#000000"},
    {"key": "twitter",   "name": "X (\u062a\u0648\u064a\u062a\u0631)",     "color": "#1DA1F2"},
    {"key": "linkedin",  "name": "\u0644\u064a\u0646\u0643\u062f\u0625\u0646",       "color": "#0A66C2"},
    {"key": "youtube",   "name": "\u064a\u0648\u062a\u064a\u0648\u0628",         "color": "#FF0000"},
    {"key": "facebook",  "name": "\u0641\u064a\u0633\u0628\u0648\u0643",         "color": "#1877F2"},
    {"key": "snapchat",  "name": "\u0633\u0646\u0627\u0628",           "color": "#FFFC00"},
    {"key": "other",     "name": "\u0623\u062e\u0631\u0649",             "color": "#6B7280"},
]

CONTENT_FORMATS = [
    {"key": "reel",     "name": "\u0631\u064a\u0644\u0632"},
    {"key": "post",     "name": "\u0645\u0646\u0634\u0648\u0631"},
    {"key": "story",    "name": "\u0642\u0635\u0629"},
    {"key": "thread",   "name": "\u062b\u0631\u064a\u062f"},
    {"key": "video",    "name": "\u0641\u064a\u062f\u064a\u0648"},
    {"key": "carousel", "name": "\u0643\u0627\u0631\u0648\u0633\u064a\u0644"},
    {"key": "live",     "name": "\u0628\u062b \u0645\u0628\u0627\u0634\u0631"},
]
CONTENT_FORMAT_KEYS = [f["key"] for f in CONTENT_FORMATS]

# Tasks Engine constants
TASK_STATUSES = [
    {"key": "todo",         "name": "\u0644\u0644\u062a\u0646\u0641\u064a\u0630",     "color": "#94A3B8"},
    {"key": "in_progress",  "name": "\u062c\u0627\u0631\u064d",         "color": "#57769D"},
    {"key": "review",       "name": "\u0645\u0631\u0627\u062c\u0639\u0629",       "color": "#F59E0B"},
    {"key": "blocked",      "name": "\u0645\u0639\u0644\u0651\u0642\u0629",        "color": "#EF4444"},
    {"key": "done",         "name": "\u0645\u0643\u062a\u0645\u0644\u0629",       "color": "#C3E0A5"},
]
TASK_STATUS_KEYS = [s["key"] for s in TASK_STATUSES]

TASK_PRIORITIES = [
    {"key": "low",     "name": "\u0645\u0646\u062e\u0641\u0636\u0629", "color": "#94A3B8"},
    {"key": "medium",  "name": "\u0645\u062a\u0648\u0633\u0637\u0629", "color": "#57769D"},
    {"key": "high",    "name": "\u0639\u0627\u0644\u064a\u0629",   "color": "#F59E0B"},
    {"key": "urgent",  "name": "\u0639\u0627\u062c\u0644\u0629",   "color": "#EF4444"},
]
TASK_PRIORITY_KEYS = [p["key"] for p in TASK_PRIORITIES]



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
    # Content OS specific
    "content_ideas": "أنت خبير محتوى سوشيال ميديا عربي. من الموضوع/السياق التالي، اقترح 8 أفكار محتوى مميّزة قابلة للتنفيذ. لكل فكرة: عنوان مغرٍ (5-8 كلمات) + وصف قصير (سطر واحد) + Hook مقترح + المنصة الأنسب. رقّم الأفكار بترتيب من الأقوى.",
    "content_script": "أنت كاتب سيناريو محتوى قصير. اكتب سيناريو كامل جاهز للتنفيذ (30-60 ثانية) للفكرة التالية. قسّم إلى: Hook (0-3s) — Body (المحتوى الأساسي مقسّم لمشاهد) — CTA (خاتمة قوية). استخدم لغة عربية عصرية.",
    "content_caption": "أنت خبير كتابة captions. حسّن الـ caption التالي ليصبح أكثر جذباً وتفاعلاً — احتفظ بالمعنى الأساسي لكن اجعله أقوى وأمتع للقارئ. أعد الـ caption المحسّن فقط.",
    "content_hashtags": "أنت خبير SEO سوشيال. اقترح 15-20 هاشتاق مناسب (مزيج بين واسع الانتشار ومتخصّص وعربي وإنجليزي) للمحتوى التالي. ضعها في سطر واحد مفصولة بمسافات.",
}


# ==================== HELPERS ====================
def strip_id(doc: dict) -> dict:
    if doc:
        doc.pop("_id", None)
    return doc


def conv_id(a: str, b: str) -> str:
    return "_".join(sorted([a, b]))
