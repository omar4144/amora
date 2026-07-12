import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { API } from "@/lib/api";
import { toast } from "sonner";
import { ArrowRight, Building2, DollarSign, Calendar, Trash2, MessageSquare, Phone, Mail, Users2 as UsersIcon, StickyNote, ArrowLeftRight, CheckSquare, Video, Wand2, Sparkles, TrendingUp, FileText, FileSignature } from "lucide-react";

const ACT_ICONS = {
    note: StickyNote,
    call: Phone,
    email: Mail,
    meeting: UsersIcon,
    task: Calendar,
    stage_change: ArrowLeftRight,
};
const ACT_LABELS = {
    note: "ملاحظة", call: "مكالمة", email: "بريد", meeting: "اجتماع", task: "مهمة", stage_change: "نقل مرحلة",
};

export default function CRMDealDetail() {
    const { id } = useParams();
    const nav = useNavigate();
    const [deal, setDeal] = useState(null);
    const [stages, setStages] = useState([]);
    const [act, setAct] = useState({ type: "note", title: "", description: "" });
    const [busy, setBusy] = useState(false);
    const [related, setRelated] = useState({ tasks: [], content: [], activities: [] });
    const [prediction, setPrediction] = useState("");
    const [predBusy, setPredBusy] = useState(false);

    const load = async () => {
        try {
            const [d, s, r] = await Promise.all([
                api.get(`/crm/deals/${id}`),
                api.get("/crm/stages"),
                api.get(`/workspace/related?deal_id=${id}`),
            ]);
            setDeal(d.data);
            setStages(s.data);
            setRelated(r.data);
        } catch (e) {
            toast.error("تعذر تحميل الصفقة");
            nav("/crm/deals");
        }
    };
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

    const predictClose = async () => {
        setPredBusy(true);
        setPrediction("");
        try {
            const ctx = JSON.stringify({
                title: deal.title,
                value: deal.value,
                stage: deal.stage,
                probability: deal.probability,
                client: deal.client?.name,
                notes: deal.notes,
                days_since_update: deal.updated_at ? Math.floor((Date.now() - new Date(deal.updated_at).getTime()) / 86400000) : 0,
                activities_count: (deal.activities || []).length,
            }, null, 2);
            const r = await api.post("/ai/assist", { task: "deal_close", context: ctx });
            setPrediction(r.data.result);
        } catch (err) {
            toast.error(err.response?.data?.detail || "خطأ AI");
        } finally { setPredBusy(false); }
    };

    if (!deal) return <div className="p-8 text-white/50 text-center">جارٍ التحميل...</div>;

    const move = async (stage) => {
        try {
            await api.put(`/crm/deals/${deal.id}/stage`, { stage });
            toast.success("تم النقل");
            await load();
        } catch { toast.error("خطأ"); }
    };

    const addActivity = async (e) => {
        e.preventDefault();
        if (!act.title.trim()) return toast.error("العنوان مطلوب");
        setBusy(true);
        try {
            await api.post("/crm/activities", { ...act, deal_id: deal.id });
            setAct({ type: "note", title: "", description: "" });
            toast.success("تمت الإضافة");
            await load();
        } catch { toast.error("خطأ"); }
        finally { setBusy(false); }
    };

    const remove = async () => {
        if (!window.confirm(`حذف الصفقة "${deal.title}"؟`)) return;
        await api.delete(`/crm/deals/${deal.id}`);
        toast.success("محذوفة");
        nav("/crm/deals");
    };

    const createInvoice = async () => {
        try {
            const r = await api.post(`/crm/deals/${id}/create-invoice`);
            toast.success("تم إنشاء الفاتورة");
            nav(`/crm/invoices/${r.data.id}`);
        } catch (e) { toast.error(e.response?.data?.detail || "خطأ"); }
    };

    const downloadContract = () => {
        const token = localStorage.getItem("token");
        fetch(`${API}/crm/deals/${id}/contract-pdf`, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.blob())
            .then((b) => {
                const url = URL.createObjectURL(b);
                const a = document.createElement("a");
                a.href = url; a.download = `contract-${id.slice(0,8)}.pdf`;
                a.click(); URL.revokeObjectURL(url);
            })
            .catch(() => toast.error("تعذّر تحميل العقد"));
    };

    const currentStage = stages.find((s) => s.key === deal.stage);

    return (
        <div data-testid="crm-deal-detail" className="p-4 space-y-5">
            <button onClick={() => nav("/crm/deals")} className="text-xs text-white/60 flex items-center gap-1">
                <ArrowRight className="w-3 h-3" /> رجوع
            </button>

            {/* Header */}
            <div className="bg-gradient-to-br from-[#141414] to-[#0A0A0A] border border-white/10 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <h1 className="font-heading font-black text-xl text-white flex-1">{deal.title}</h1>
                    <button onClick={remove} className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center">
                        <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                </div>

                <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-1.5 text-[#D1795F] font-heading font-black text-2xl">
                        <DollarSign className="w-5 h-5" />
                        {deal.value.toLocaleString()}
                        <span className="text-white/40 text-sm">{deal.currency}</span>
                    </div>
                    <div className="text-xs text-white/50 font-body">{deal.probability}% احتمال</div>
                </div>

                {deal.client && (
                    <div className="flex items-center gap-2 text-sm text-white/70 mb-3">
                        <Building2 className="w-4 h-4" />
                        {deal.client.name} {deal.client.company && `(${deal.client.company})`}
                    </div>
                )}
                {deal.notes && (
                    <p className="text-sm text-white/60 font-body bg-white/5 rounded-xl p-3">{deal.notes}</p>
                )}
            </div>

            {/* Stage picker */}
            <div>
                <p className="text-xs text-white/50 font-body mb-2">المرحلة الحالية</p>
                <div className="grid grid-cols-4 gap-1.5">
                    {stages.map((s) => (
                        <button
                            key={s.key}
                            data-testid={`stage-${s.key}`}
                            onClick={() => move(s.key)}
                            className={`text-[10px] font-heading font-semibold px-2 py-2 rounded-lg transition ${
                                deal.stage === s.key
                                    ? "text-black"
                                    : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
                            }`}
                            style={{ backgroundColor: deal.stage === s.key ? s.color : undefined }}
                        >
                            {s.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Quick actions: create invoice + contract PDF */}
            <div className="grid grid-cols-2 gap-2">
                <button
                    data-testid="create-invoice-btn"
                    onClick={createInvoice}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-3 flex items-center gap-2 transition text-start active:scale-[0.98]"
                >
                    <div className="w-9 h-9 rounded-xl bg-[#D1795F]/20 text-[#D1795F] flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="font-heading font-bold text-sm text-white">إنشاء فاتورة</div>
                        <div className="text-[10px] text-white/50">من بيانات الصفقة</div>
                    </div>
                </button>
                <button
                    data-testid="download-contract-btn"
                    onClick={downloadContract}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-3 flex items-center gap-2 transition text-start active:scale-[0.98]"
                >
                    <div className="w-9 h-9 rounded-xl bg-[#57769D]/20 text-[#57769D] flex items-center justify-center flex-shrink-0">
                        <FileSignature className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="font-heading font-bold text-sm text-white">عقد PDF</div>
                        <div className="text-[10px] text-white/50">تحميل جاهز للتوقيع</div>
                    </div>
                </button>
            </div>

            {/* AI: Deal close prediction */}
            <div data-testid="deal-ai-predict" className="bg-gradient-to-br from-[#57769D]/10 to-transparent border border-[#57769D]/30 rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#57769D] to-[#D1795F] flex items-center justify-center">
                            <TrendingUp className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <div className="font-heading font-bold text-sm text-white">تنبؤ إغلاق الصفقة</div>
                            <div className="text-[10px] text-white/50">Claude يحلل بياناتك</div>
                        </div>
                    </div>
                    <button
                        data-testid="predict-close-btn"
                        onClick={predictClose}
                        disabled={predBusy}
                        className="text-xs bg-[#57769D] hover:bg-[#476384] text-white font-heading font-bold rounded-lg px-3 py-1.5 flex items-center gap-1 disabled:opacity-50 active:scale-95 transition"
                    >
                        <Wand2 className={`w-3 h-3 ${predBusy ? "animate-pulse" : ""}`} />
                        {predBusy ? "يحلل..." : "تحليل"}
                    </button>
                </div>
                {prediction && (
                    <div data-testid="prediction-result" className="mt-2 text-sm text-white/90 leading-relaxed font-body bg-black/40 rounded-xl p-3 whitespace-pre-wrap">
                        {prediction}
                    </div>
                )}
            </div>

            {/* Related: Tasks + Content */}
            {(related.tasks.length + related.content.length) > 0 && (
                <div className="space-y-3">
                    {related.tasks.length > 0 && (
                        <div>
                            <h3 className="font-heading font-bold text-sm mb-2 flex items-center gap-2 text-white/80">
                                <CheckSquare className="w-3.5 h-3.5 text-[#C3E0A5]" />
                                مهام مرتبطة ({related.tasks.length})
                            </h3>
                            <div className="space-y-1.5">
                                {related.tasks.map((t) => (
                                    <button
                                        key={t.id}
                                        data-testid={`deal-task-${t.id}`}
                                        onClick={() => nav(`/tasks/task/${t.id}`)}
                                        className="w-full text-start bg-white/5 border border-white/10 rounded-xl p-2.5 hover:border-[#C3E0A5]/40 transition"
                                    >
                                        <div className="font-heading font-semibold text-xs text-white truncate">{t.title}</div>
                                        <div className="text-[10px] text-white/50">{t.status}{t.due_date ? ` • ${new Date(t.due_date).toLocaleDateString('ar')}` : ""}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {related.content.length > 0 && (
                        <div>
                            <h3 className="font-heading font-bold text-sm mb-2 flex items-center gap-2 text-white/80">
                                <Video className="w-3.5 h-3.5 text-[#57769D]" />
                                محتوى للعميل ({related.content.length})
                            </h3>
                            <div className="space-y-1.5">
                                {related.content.map((c) => (
                                    <button
                                        key={c.id}
                                        data-testid={`deal-content-${c.id}`}
                                        onClick={() => nav(`/content/item/${c.id}`)}
                                        className="w-full text-start bg-white/5 border border-white/10 rounded-xl p-2.5 hover:border-[#57769D]/40 transition"
                                    >
                                        <div className="font-heading font-semibold text-xs text-white truncate">{c.title}</div>
                                        <div className="text-[10px] text-white/50">{c.platform} • {c.status}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Add activity */}
            <form onSubmit={addActivity} data-testid="activity-form" className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                <p className="text-xs text-white/50 font-body">أضف نشاطاً</p>
                <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
                    {["note", "call", "email", "meeting", "task"].map((t) => {
                        const Icon = ACT_ICONS[t];
                        return (
                            <button
                                key={t} type="button"
                                onClick={() => setAct({ ...act, type: t })}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] whitespace-nowrap ${
                                    act.type === t ? "bg-[#D1795F] text-white font-heading font-bold" : "bg-white/5 text-white/60 border border-white/10"
                                }`}
                            >
                                <Icon className="w-3 h-3" /> {ACT_LABELS[t]}
                            </button>
                        );
                    })}
                </div>
                <input
                    data-testid="activity-title"
                    placeholder="ماذا حدث؟"
                    value={act.title}
                    onChange={(e) => setAct({ ...act, title: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/40 focus:border-[#D1795F] outline-none"
                />
                <textarea
                    placeholder="تفاصيل (اختياري)"
                    value={act.description}
                    onChange={(e) => setAct({ ...act, description: e.target.value })}
                    rows={2}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/40 focus:border-[#D1795F] outline-none resize-none"
                />
                <button data-testid="activity-save" type="submit" disabled={busy} className="w-full bg-[#D1795F] text-white font-heading font-bold rounded-xl py-2.5 text-sm active:scale-95 disabled:opacity-60">
                    {busy ? "..." : "حفظ النشاط"}
                </button>
            </form>

            {/* Timeline */}
            <div>
                <h3 className="font-heading font-bold text-sm mb-3">الخط الزمني</h3>
                <div className="space-y-2">
                    {(deal.activities || []).length === 0 && (
                        <div className="text-center py-8 text-white/40 text-sm">لا يوجد نشاط بعد</div>
                    )}
                    {(deal.activities || []).map((a) => {
                        const Icon = ACT_ICONS[a.type] || StickyNote;
                        return (
                            <div key={a.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#D1795F]/10 flex items-center justify-center flex-shrink-0">
                                    <Icon className="w-4 h-4 text-[#D1795F]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white font-heading font-semibold">{a.title}</p>
                                    {a.description && <p className="text-xs text-white/60 font-body mt-0.5">{a.description}</p>}
                                    <p className="text-[10px] text-white/40 mt-1">{new Date(a.created_at).toLocaleString('ar')}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
