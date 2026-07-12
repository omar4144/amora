"""AI Engine: unified AI assistant using Claude Sonnet 4.5 via emergentintegrations."""
import uuid
import logging
from fastapi import APIRouter, HTTPException, Depends

from core.deps import current_user, EMERGENT_LLM_KEY, AI_PROMPTS
from core.schemas import AIRequest
from engines.billing_engine import consume_credit, refund_credit

router = APIRouter(tags=["ai"])
logger = logging.getLogger("ruaa.ai")


@router.post("/ai/assist")
async def ai_assist(data: AIRequest, user=Depends(current_user)):
    system_prompt = AI_PROMPTS.get(data.task)
    if not system_prompt:
        raise HTTPException(400, "نوع المهمة غير مدعوم")
    # Credit gate
    if not await consume_credit(user["id"], 1):
        raise HTTPException(402, "استنفدت رصيد AI الشهري — رقّي خطتك من صفحة الأسعار")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"{user['id']}-{data.task}-{uuid.uuid4()}",
            system_message=system_prompt,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        msg = UserMessage(text=data.context)
        reply = await chat.send_message(msg)
        return {"result": reply, "task": data.task}
    except Exception as e:
        await refund_credit(user["id"], 1)
        logger.error(f"AI error: {e}")
        raise HTTPException(500, f"خطأ في المساعد الذكي: {str(e)}")
