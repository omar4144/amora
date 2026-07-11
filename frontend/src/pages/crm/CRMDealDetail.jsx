import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { ArrowRight, Building2, DollarSign, Calendar, Trash2, MessageSquare, Phone, Mail, Users2 as UsersIcon, StickyNote, ArrowLeftRight } from "lucide-react";

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

    const load = async () => {
        try {
            const [d, s] = await Promise.all([
                api.get(`/crm/deals/${id}`),
                api.get("/crm/stages"),
            ]);
            setDeal(d.data);
            setStages(s.data);
        } catch (e) {
            toast.error("تعذر تحميل الصفقة");
            nav("/crm/deals");
        }
    };
    useEffect(() => { load(); }, [id]);

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
                    <div className="flex items-center gap-1.5 text-[#E3FF00] font-heading font-black text-2xl">
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
                                    act.type === t ? "bg-[#E3FF00] text-black font-heading font-bold" : "bg-white/5 text-white/60 border border-white/10"
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
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/40 focus:border-[#E3FF00] outline-none"
                />
                <textarea
                    placeholder="تفاصيل (اختياري)"
                    value={act.description}
                    onChange={(e) => setAct({ ...act, description: e.target.value })}
                    rows={2}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/40 focus:border-[#E3FF00] outline-none resize-none"
                />
                <button data-testid="activity-save" type="submit" disabled={busy} className="w-full bg-[#E3FF00] text-black font-heading font-bold rounded-xl py-2.5 text-sm active:scale-95 disabled:opacity-60">
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
                                <div className="w-8 h-8 rounded-full bg-[#E3FF00]/10 flex items-center justify-center flex-shrink-0">
                                    <Icon className="w-4 h-4 text-[#E3FF00]" />
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
