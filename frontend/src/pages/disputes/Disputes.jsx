import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { AlertTriangle, Send, Check, X, DollarSign, Scale, Shield } from "lucide-react";

const STATUS_META = {
    open:          { c: "#F59E0B", l: "مفتوح" },
    under_review:  { c: "#57769D", l: "قيد المراجعة" },
    resolved:      { c: "#C3E0A5", l: "محلول" },
    closed:        { c: "#94A3B8", l: "مسحوب" },
};

export function DisputesList() {
    const [items, setItems] = useState([]);
    const nav = useNavigate();
    useEffect(() => { api.get("/disputes").then((r) => setItems(r.data)).catch(() => {}); }, []);
    return (
        <div className="p-4 pt-14 pb-24 space-y-3" data-testid="disputes-page">
            <div className="flex items-center gap-2 mb-2">
                <Scale className="w-6 h-6 text-[#D1795F]" />
                <h1 className="font-heading font-black text-2xl">نزاعاتي</h1>
            </div>
            {items.length === 0 && <div className="text-center py-16 text-white/40">لا نزاعات — ممتاز!</div>}
            {items.map((d) => {
                const st = STATUS_META[d.status] || STATUS_META.open;
                return (
                    <button key={d.id} data-testid={`dispute-${d.id}`} onClick={() => nav(`/disputes/${d.id}`)} className="w-full text-start bg-white/5 border border-white/10 rounded-2xl p-3 hover:border-[#D1795F]/40 transition">
                        <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                <div className="font-heading font-bold text-sm text-white truncate">نزاع #{d.id.slice(0,8)}</div>
                            </div>
                            <span className="text-[10px] font-heading font-bold text-black px-2 py-0.5 rounded-full" style={{ backgroundColor: st.c }}>{st.l}</span>
                        </div>
                        <div className="text-[11px] text-white/60">
                            {d.role === "buyer" ? `مع البائع: ${d.counterparty?.name || "غير معروف"}` : `مع المشتري: ${d.counterparty?.name || "غير معروف"}`}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[#D1795F] font-heading font-black text-sm flex items-center"><DollarSign className="w-3 h-3" />{d.amount}</span>
                            <span className="text-[10px] text-white/50">{new Date(d.created_at).toLocaleDateString("ar")}</span>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}


export function DisputeDetail() {
    const { id } = useParams();
    const nav = useNavigate();
    const [d, setD] = useState(null);
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);

    const load = () => api.get(`/disputes/${id}`).then((r) => setD(r.data)).catch(() => { toast.error("النزاع غير موجود"); nav("/disputes"); });
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

    const sendMsg = async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        setBusy(true);
        try {
            await api.post(`/disputes/${id}/messages`, { text });
            setText("");
            await load();
        } catch (err) {
            toast.error(err.response?.data?.detail || "خطأ");
        } finally { setBusy(false); }
    };

    const close = async () => {
        if (!window.confirm("سحب النزاع نهائياً؟")) return;
        await api.post(`/disputes/${id}/close`);
        toast.success("تم سحب النزاع");
        load();
    };

    const resolve = async (resolution) => {
        if (!window.confirm(`تأكيد الحل: ${resolution}؟`)) return;
        await api.post(`/disputes/${id}/resolve`, { resolution });
        toast.success("تم حل النزاع");
        load();
    };

    if (!d) return <div className="p-8 text-white/50 text-center">جارٍ التحميل...</div>;
    const st = STATUS_META[d.status] || STATUS_META.open;
    const canReply = d.status !== "resolved" && d.status !== "closed";

    return (
        <div className="p-4 pt-14 pb-24" data-testid="dispute-detail">
            <div className="bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/30 rounded-2xl p-4 mb-4">
                <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        <h1 className="font-heading font-black text-lg text-white">نزاع #{d.id.slice(0,8)}</h1>
                    </div>
                    <span className="text-[10px] font-heading font-bold text-black px-2 py-1 rounded-full" style={{ backgroundColor: st.c }}>{st.l}</span>
                </div>
                <div className="text-xs text-white/60 space-y-1">
                    <div>القيمة: <span className="text-[#D1795F] font-heading font-black">${d.amount}</span></div>
                    <div>المشتري: {d.buyer?.name}</div>
                    <div>البائع: {d.seller?.name}</div>
                    <div>السبب: {d.reason}</div>
                </div>
            </div>

            {/* Messages */}
            <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
                {(d.messages || []).map((m) => (
                    <div key={m.id} data-testid={`dispute-msg-${m.id}`} className={`rounded-xl p-3 ${m.role === "admin" ? "bg-[#57769D]/20 border border-[#57769D]/40" : m.role === d.role ? "bg-[#D1795F]/15 border border-[#D1795F]/30 mr-6" : "bg-white/5 border border-white/10 ml-6"}`}>
                        <div className="flex items-center gap-1 mb-1">
                            {m.role === "admin" && <Shield className="w-3 h-3 text-[#57769D]" />}
                            <span className="text-[10px] font-heading font-bold text-white/60">{m.role === "buyer" ? "المشتري" : m.role === "seller" ? "البائع" : "الإدارة"}</span>
                            <span className="text-[9px] text-white/40 mr-auto">{new Date(m.created_at).toLocaleString("ar")}</span>
                        </div>
                        <div className="text-sm text-white font-body">{m.text}</div>
                    </div>
                ))}
            </div>

            {canReply && (
                <form onSubmit={sendMsg} className="flex gap-2 mb-3">
                    <input data-testid="dispute-msg-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب رداً..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-[#D1795F]" />
                    <button data-testid="dispute-send-btn" type="submit" disabled={busy} className="w-11 h-11 rounded-xl bg-[#D1795F] text-white flex items-center justify-center disabled:opacity-50">
                        <Send className="w-4 h-4" />
                    </button>
                </form>
            )}

            <div className="flex gap-2">
                {d.role === "buyer" && canReply && (
                    <button data-testid="dispute-close-btn" onClick={close} className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2.5 text-xs text-white/70 font-heading font-bold">
                        سحب النزاع
                    </button>
                )}
                {d.role === "admin" && canReply && (
                    <>
                        <button data-testid="resolve-refund" onClick={() => resolve("refund_buyer")} className="flex-1 bg-red-500/20 border border-red-500/30 text-red-300 rounded-xl py-2.5 text-xs font-heading font-bold">استرداد للمشتري</button>
                        <button data-testid="resolve-release" onClick={() => resolve("release_to_seller")} className="flex-1 bg-[#C3E0A5]/20 border border-[#C3E0A5]/30 text-[#C3E0A5] rounded-xl py-2.5 text-xs font-heading font-bold">إفراج للبائع</button>
                    </>
                )}
            </div>
        </div>
    );
}


export function OpenDisputeButton({ orderId, onOpened }) {
    const [show, setShow] = useState(false);
    const [reason, setReason] = useState("not_delivered");
    const [desc, setDesc] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (!desc.trim()) return toast.error("اكتب وصفاً للمشكلة");
        setBusy(true);
        try {
            const r = await api.post("/disputes", { order_id: orderId, reason, description: desc });
            toast.success("تم فتح النزاع");
            setShow(false);
            onOpened?.(r.data);
        } catch (err) {
            toast.error(err.response?.data?.detail || "خطأ");
        } finally { setBusy(false); }
    };

    return (
        <>
            <button data-testid="open-dispute-btn" onClick={() => setShow(true)} className="text-xs bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-lg px-3 py-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> فتح نزاع
            </button>
            {show && (
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setShow(false)}>
                    <form onSubmit={submit} onClick={(e) => e.stopPropagation()} data-testid="dispute-form" className="w-full max-w-md bg-[#0F0F0F] border border-amber-500/30 rounded-t-3xl sm:rounded-3xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-heading font-black text-lg text-amber-400">فتح نزاع</h3>
                            <button type="button" onClick={() => setShow(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><X className="w-4 h-4" /></button>
                        </div>
                        <select data-testid="dispute-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none">
                            <option value="not_delivered">لم يتم التسليم</option>
                            <option value="not_as_described">لا يطابق الوصف</option>
                            <option value="poor_quality">جودة سيئة</option>
                            <option value="other">سبب آخر</option>
                        </select>
                        <textarea data-testid="dispute-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="اشرح المشكلة بالتفصيل..." rows={4} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none resize-none" />
                        <button data-testid="dispute-submit" type="submit" disabled={busy} className="w-full bg-amber-500 hover:bg-amber-600 text-black font-heading font-black rounded-xl py-3 disabled:opacity-50">
                            {busy ? "جارٍ الفتح..." : "فتح النزاع"}
                        </button>
                        <p className="text-[10px] text-white/40 text-center">سيتم إشعار البائع فوراً للرد</p>
                    </form>
                </div>
            )}
        </>
    );
}
