"""Invoice Engine — invoices + contracts + PDF generation with Arabic support."""
import uuid
import io
import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

from core.deps import db, current_user, now_iso

router = APIRouter(tags=["invoice"])
logger = logging.getLogger("ruaa.invoice")


# ==================== MODELS ====================
class LineItem(BaseModel):
    description: str
    quantity: float = 1
    unit_price: float = 0.0


class InvoiceCreate(BaseModel):
    client_id: str
    deal_id: Optional[str] = None
    title: str = "فاتورة"
    items: List[LineItem] = Field(default_factory=list)
    currency: str = "USD"
    tax_percent: float = 0.0
    discount: float = 0.0
    due_date: Optional[str] = None
    notes: Optional[str] = ""


class InvoiceUpdate(BaseModel):
    title: Optional[str] = None
    items: Optional[List[LineItem]] = None
    tax_percent: Optional[float] = None
    discount: Optional[float] = None
    due_date: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None  # draft / sent / paid / overdue / cancelled


INVOICE_STATUSES = ["draft", "sent", "paid", "overdue", "cancelled"]


def _compute_totals(items: list, tax_percent: float, discount: float) -> dict:
    subtotal = sum((i.get("quantity", 1) or 1) * (i.get("unit_price", 0) or 0) for i in items)
    tax_amount = subtotal * (tax_percent or 0) / 100
    total = subtotal + tax_amount - (discount or 0)
    return {"subtotal": round(subtotal, 2), "tax_amount": round(tax_amount, 2), "total": round(total, 2)}


async def _next_invoice_number(uid: str) -> str:
    """Atomically get the next invoice number using a counter document (race-safe).
    On first use for a given user+year, seeds the counter from the current max invoice number."""
    year = datetime.now(timezone.utc).year
    counter_id = f"inv:{uid}:{year}"
    existing = await db.counters.find_one({"_id": counter_id})
    if not existing:
        # seed from current max to avoid collision with pre-counter invoices
        prefix = f"INV-{year}-"
        cursor = db.invoices.find(
            {"owner_id": uid, "number": {"$regex": f"^{prefix}"}},
            {"_id": 0, "number": 1},
        ).sort("number", -1).limit(1)
        top = await cursor.to_list(1)
        base = 0
        if top:
            try:
                base = int(top[0]["number"].split("-")[-1])
            except Exception:
                base = 0
        await db.counters.update_one({"_id": counter_id}, {"$setOnInsert": {"seq": base}}, upsert=True)
    doc = await db.counters.find_one_and_update(
        {"_id": counter_id},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    seq = (doc or {}).get("seq", 1)
    return f"INV-{year}-{seq:04d}"


# ==================== INVOICE CRUD ====================
@router.get("/crm/invoices")
async def list_invoices(user=Depends(current_user), status: Optional[str] = None, client_id: Optional[str] = None):
    q = {"owner_id": user["id"]}
    if status:
        q["status"] = status
    if client_id:
        q["client_id"] = client_id
    items = await db.invoices.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    # enrich with client name
    for it in items:
        if it.get("client_id"):
            c = await db.crm_clients.find_one({"id": it["client_id"], "owner_id": user["id"]}, {"_id": 0, "name": 1, "company": 1})
            it["client"] = c
    return items


@router.get("/crm/invoices/stats")
async def invoices_stats(user=Depends(current_user)):
    uid = user["id"]
    all_inv = await db.invoices.find({"owner_id": uid}, {"_id": 0, "total": 1, "status": 1, "currency": 1}).to_list(2000)
    total_paid = sum(i.get("total", 0) for i in all_inv if i.get("status") == "paid")
    total_outstanding = sum(i.get("total", 0) for i in all_inv if i.get("status") in ("sent", "overdue"))
    total_draft = sum(i.get("total", 0) for i in all_inv if i.get("status") == "draft")
    return {
        "count": len(all_inv),
        "paid": round(total_paid, 2),
        "outstanding": round(total_outstanding, 2),
        "draft": round(total_draft, 2),
        "by_status": {s: sum(1 for i in all_inv if i.get("status") == s) for s in INVOICE_STATUSES},
    }


@router.post("/crm/invoices")
async def create_invoice(data: InvoiceCreate, user=Depends(current_user)):
    # verify client belongs to user
    c = await db.crm_clients.find_one({"id": data.client_id, "owner_id": user["id"]})
    if not c:
        raise HTTPException(404, "العميل غير موجود")
    items = [it.model_dump() for it in data.items]
    totals = _compute_totals(items, data.tax_percent, data.discount)
    doc = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "client_id": data.client_id,
        "deal_id": data.deal_id,
        "number": await _next_invoice_number(user["id"]),
        "title": data.title,
        "items": items,
        "currency": data.currency,
        "tax_percent": data.tax_percent,
        "discount": data.discount,
        "due_date": data.due_date,
        "notes": data.notes or "",
        "status": "draft",
        **totals,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.invoices.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/crm/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, user=Depends(current_user)):
    inv = await db.invoices.find_one({"id": invoice_id, "owner_id": user["id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "الفاتورة غير موجودة")
    if inv.get("client_id"):
        c = await db.crm_clients.find_one({"id": inv["client_id"], "owner_id": user["id"]}, {"_id": 0})
        inv["client"] = c
    return inv


@router.put("/crm/invoices/{invoice_id}")
async def update_invoice(invoice_id: str, data: InvoiceUpdate, user=Depends(current_user)):
    inv = await db.invoices.find_one({"id": invoice_id, "owner_id": user["id"]})
    if not inv:
        raise HTTPException(404, "الفاتورة غير موجودة")
    patch = data.model_dump(exclude_unset=True)
    if "items" in patch:
        patch["items"] = [it if isinstance(it, dict) else it.model_dump() for it in patch["items"]]
    if patch.get("status") and patch["status"] not in INVOICE_STATUSES:
        raise HTTPException(400, "حالة غير صالحة")
    # recompute totals if items/tax/discount changed
    new_items = patch.get("items", inv.get("items", []))
    new_tax = patch.get("tax_percent", inv.get("tax_percent", 0))
    new_disc = patch.get("discount", inv.get("discount", 0))
    if any(k in patch for k in ("items", "tax_percent", "discount")):
        patch.update(_compute_totals(new_items, new_tax, new_disc))
    patch["updated_at"] = now_iso()
    await db.invoices.update_one({"id": invoice_id, "owner_id": user["id"]}, {"$set": patch})
    doc = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    return doc


@router.delete("/crm/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, user=Depends(current_user)):
    await db.invoices.delete_one({"id": invoice_id, "owner_id": user["id"]})
    return {"ok": True}


# ==================== PDF GENERATION ====================
def _make_pdf(kind: str, title: str, meta: dict, body: dict, footer: str = "") -> bytes:
    """Build a PDF using ReportLab + Arabic reshaping (right-to-left)."""
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    from reportlab.lib import colors
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    import arabic_reshaper
    from bidi.algorithm import get_display

    # Register Arabic-capable font (bundled with system)
    try:
        pdfmetrics.registerFont(TTFont("ArFont", "/usr/share/fonts/truetype/freefont/FreeSerif.ttf"))
        pdfmetrics.registerFont(TTFont("ArFontBold", "/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf"))
        arabic_font = "ArFont"
        arabic_bold = "ArFontBold"
    except Exception:
        arabic_font = "Helvetica"
        arabic_bold = "Helvetica-Bold"

    def ar(text: str) -> str:
        if not text:
            return ""
        try:
            return get_display(arabic_reshaper.reshape(str(text)))
        except Exception:
            return str(text)

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    W, H = A4

    # Header brand
    c.setFillColor(colors.HexColor("#D1795F"))
    c.rect(0, H - 90, W, 90, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont(arabic_bold, 26)
    c.drawRightString(W - 40, H - 55, ar("Amora"))
    c.setFont(arabic_font, 12)
    c.drawRightString(W - 40, H - 75, ar("نظام تشغيل إبداعي"))
    c.setFont(arabic_bold, 18)
    c.drawString(40, H - 55, ar(title))

    # Meta box
    y = H - 130
    c.setFillColor(colors.HexColor("#333333"))
    c.setFont(arabic_font, 11)
    for k, v in meta.items():
        c.drawRightString(W - 40, y, ar(f"{k}: {v}"))
        y -= 18

    # Body
    y -= 20
    c.setFont(arabic_bold, 13)
    c.setFillColor(colors.HexColor("#0F0F0F"))
    if kind == "invoice":
        # items table
        c.drawRightString(W - 40, y, ar("البنود"))
        y -= 18
        c.setFont(arabic_font, 10)
        # header row
        c.setFillColor(colors.HexColor("#F5E9E4"))
        c.rect(40, y - 4, W - 80, 20, fill=1, stroke=0)
        c.setFillColor(colors.HexColor("#0F0F0F"))
        c.drawRightString(W - 50, y + 4, ar("الوصف"))
        c.drawString(220, y + 4, ar("الكمية"))
        c.drawString(310, y + 4, ar("السعر"))
        c.drawString(410, y + 4, ar("الإجمالي"))
        y -= 22
        for it in body.get("items", []):
            qty = it.get("quantity", 1) or 1
            up = it.get("unit_price", 0) or 0
            line_total = qty * up
            c.drawRightString(W - 50, y, ar(it.get("description", "")[:60]))
            c.drawString(220, y, ar(f"{qty:g}"))
            c.drawString(310, y, ar(f"{up:.2f}"))
            c.drawString(410, y, ar(f"{line_total:.2f}"))
            y -= 18
            if y < 150:
                c.showPage()
                y = H - 60
        # totals
        y -= 10
        c.setFont(arabic_font, 11)
        c.drawRightString(W - 40, y, ar(f"المجموع: {body.get('subtotal', 0):.2f} {body.get('currency', 'USD')}"))
        y -= 16
        if body.get("tax_amount"):
            c.drawRightString(W - 40, y, ar(f"ضريبة ({body.get('tax_percent',0):.1f}%): {body.get('tax_amount', 0):.2f}"))
            y -= 16
        if body.get("discount"):
            c.drawRightString(W - 40, y, ar(f"خصم: -{body.get('discount', 0):.2f}"))
            y -= 16
        c.setFont(arabic_bold, 14)
        c.setFillColor(colors.HexColor("#D1795F"))
        c.drawRightString(W - 40, y - 6, ar(f"الإجمالي المستحق: {body.get('total', 0):.2f} {body.get('currency', 'USD')}"))
    elif kind == "contract":
        c.setFont(arabic_font, 11)
        c.setFillColor(colors.HexColor("#333333"))
        for para in body.get("paragraphs", []):
            # simple wrap
            words = para.split()
            line = ""
            for w in words:
                test = (line + " " + w).strip()
                if len(test) > 70:
                    c.drawRightString(W - 40, y, ar(line))
                    y -= 16
                    line = w
                else:
                    line = test
            if line:
                c.drawRightString(W - 40, y, ar(line))
                y -= 20
            if y < 150:
                c.showPage()
                y = H - 60

    # Notes
    if body.get("notes"):
        y -= 20
        c.setFont(arabic_bold, 11)
        c.setFillColor(colors.HexColor("#0F0F0F"))
        c.drawRightString(W - 40, y, ar("ملاحظات:"))
        y -= 16
        c.setFont(arabic_font, 10)
        c.setFillColor(colors.HexColor("#555555"))
        c.drawRightString(W - 40, y, ar(body["notes"][:150]))

    # Footer
    c.setFont(arabic_font, 9)
    c.setFillColor(colors.HexColor("#888888"))
    c.drawCentredString(W / 2, 30, ar(footer or f"Amora · {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"))
    c.save()
    return buf.getvalue()


@router.get("/crm/invoices/{invoice_id}/pdf")
async def invoice_pdf(invoice_id: str, user=Depends(current_user)):
    inv = await db.invoices.find_one({"id": invoice_id, "owner_id": user["id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "الفاتورة غير موجودة")
    client = None
    if inv.get("client_id"):
        client = await db.crm_clients.find_one({"id": inv["client_id"]}, {"_id": 0})
    meta = {
        "رقم الفاتورة": inv.get("number", ""),
        "التاريخ": inv.get("created_at", "")[:10],
        "الحالة": inv.get("status", ""),
    }
    if client:
        meta["العميل"] = client.get("name", "")
        if client.get("company"):
            meta["الشركة"] = client["company"]
    if inv.get("due_date"):
        meta["تاريخ الاستحقاق"] = inv["due_date"][:10]
    pdf_bytes = _make_pdf("invoice", inv.get("title", "فاتورة"), meta, inv, f"{user.get('name','')} · Amora")
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=\"invoice-{inv.get('number','x')}.pdf\""},
    )


@router.get("/crm/deals/{deal_id}/contract-pdf")
async def deal_contract_pdf(deal_id: str, user=Depends(current_user)):
    d = await db.crm_deals.find_one({"id": deal_id, "owner_id": user["id"]}, {"_id": 0})
    if not d:
        raise HTTPException(404, "الصفقة غير موجودة")
    client = await db.crm_clients.find_one({"id": d.get("client_id"), "owner_id": user["id"]}, {"_id": 0}) if d.get("client_id") else None
    signer_name = user.get("name", "")
    client_name = (client or {}).get("name", "العميل الكريم")
    company = (client or {}).get("company", "")
    value = d.get("value", 0)
    currency = d.get("currency", "USD")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    paragraphs = [
        f"عقد اتفاقية خدمة رقم {d.get('id','')[:8]}",
        f"تم إبرام هذا العقد بتاريخ {today} بين {signer_name} (المزود) و{client_name} {f'({company})' if company else ''} (العميل).",
        f"موضوع العقد: {d.get('title','خدمة')}.",
        f"القيمة الإجمالية: {value:.2f} {currency}.",
        d.get("notes") or "يلتزم الطرفان بتنفيذ بنود هذا العقد بحسن نية وضمان جودة التسليم في الأوقات المتفق عليها.",
        "التوقيعات: يعتبر هذا العقد سارياً بمجرد توقيع الطرفين إلكترونياً أو ورقياً، ويحق لأي طرف طلب نسخة موقعة من الآخر.",
        "الاختصاص القضائي: يخضع هذا العقد لأنظمة المملكة العربية السعودية والدول العربية، ما لم يُتّفق على غير ذلك.",
    ]
    meta = {"رقم الصفقة": d.get("id", "")[:8], "التاريخ": today, "المرحلة": d.get("stage", "")}
    body = {"paragraphs": paragraphs, "notes": f"توقيع المزود: {signer_name}    |    توقيع العميل: {client_name}"}
    pdf_bytes = _make_pdf("contract", "عقد اتفاقية خدمة", meta, body, f"Amora · Contract · {today}")
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=\"contract-{d.get('id','x')[:8]}.pdf\""},
    )


# ==================== INVOICE FROM DEAL (SHORTCUT) ====================
@router.post("/crm/deals/{deal_id}/create-invoice")
async def invoice_from_deal(deal_id: str, user=Depends(current_user)):
    d = await db.crm_deals.find_one({"id": deal_id, "owner_id": user["id"]})
    if not d:
        raise HTTPException(404, "الصفقة غير موجودة")
    if not d.get("client_id"):
        raise HTTPException(400, "الصفقة بدون عميل مرتبط")
    items = [{"description": d.get("title", "خدمة"), "quantity": 1, "unit_price": d.get("value", 0)}]
    totals = _compute_totals(items, 0, 0)
    doc = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "client_id": d["client_id"],
        "deal_id": deal_id,
        "number": await _next_invoice_number(user["id"]),
        "title": f"فاتورة: {d.get('title','')}",
        "items": items,
        "currency": d.get("currency", "USD"),
        "tax_percent": 0,
        "discount": 0,
        "notes": "أُنشئت تلقائياً من الصفقة",
        "status": "draft",
        **totals,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.invoices.insert_one(doc)
    doc.pop("_id", None)
    return doc
