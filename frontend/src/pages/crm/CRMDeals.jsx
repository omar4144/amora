import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, X, DollarSign, ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react";

function DealForm({ clients, initial, onSubmit, onClose }) {
    const [form, setForm] = useState(
        initial || { title: "", client_id: clients[0]?.id || "", value: "", currency: "USD", stage: "new", notes: "", expected_close_date: "" }
    );
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (!form.title.trim()) return toast.error("العنوان مطلوب");
        if (!form.client_id) return toast.error("اختر عميلاً");
        setBusy(true);
        try {
            await onSubmit({ ...form, value: parseFloat(form.value) || 0 });
            onClose();
        } catch { toast.error("خطأ"); }
        finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
            <form
                data-testid="deal-form"
                onSubmit={submit}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-[#0F0F0F] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto"
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-heading font-bold text-lg">{initial ? "تعديل صفقة" : "صفقة جديدة"}</h3>
                    <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-3">
                    <input data-testid="deal-title" placeholder="عنوان الصفقة *" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#E3FF00] outline-none" />
                    <select data-testid="deal-client" value={form.client_id} onChange={(e) => setForm({...form, client_id: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none">
                        <option value="">-- اختر العميل --</option>
                        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>)}
                    </select>
                    <div className="grid grid-cols-3 gap-3">
                        <input data-testid="deal-value" type="number" placeholder="القيمة" value={form.value} onChange={(e) => setForm({...form, value: e.target.value})} className="col-span-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#E3FF00] outline-none" />
                        <select value={form.currency} onChange={(e) => setForm({...form, currency: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white outline-none">
                            <option>USD</option><option>SAR</option><option>EUR</option><option>AED</option>
                        </select>
                    </div>
                    <input type="date" value={form.expected_close_date?.slice(0,10) || ""} onChange={(e) => setForm({...form, expected_close_date: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none" />
                    <textarea placeholder="ملاحظات" value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#E3FF00] outline-none resize-none" />
                </div>
                <button data-testid="deal-save" type="submit" disabled={busy} className="w-full bg-[#E3FF00] text-black font-heading font-bold rounded-xl py-3 mt-5 active:scale-95 disabled:opacity-60">
                    {busy ? "جارٍ الحفظ..." : "حفظ"}
                </button>
            </form>
        </div>
    );
}

function DealCard({ deal, onMove, stages, onOpen }) {
    const [showMenu, setShowMenu] = useState(false);
    const stage = stages.find((s) => s.key === deal.stage);

    return (
        <div
            data-testid={`deal-card-${deal.id}`}
            className="bg-black border border-white/10 rounded-xl p-3 hover:border-[#E3FF00]/40 transition group cursor-pointer"
        >
            <div onClick={onOpen}>
                <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-sm font-heading font-semibold text-white line-clamp-2 flex-1">{deal.title}</h4>
                </div>
                {deal.client && (
                    <p className="text-[11px] text-white/50 mb-2 truncate">👤 {deal.client.name}</p>
                )}
                <div className="flex items-center justify-between">
                    <span className="text-[#E3FF00] font-heading font-bold text-sm">
                        {deal.currency === "USD" ? "$" : ""}{deal.value.toLocaleString()} {deal.currency !== "USD" ? deal.currency : ""}
                    </span>
                    <span className="text-[10px] text-white/40">{deal.probability}%</span>
                </div>
            </div>
            <div className="mt-3 pt-2 border-t border-white/5 flex items-center gap-1">
                <button
                    onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                    className="flex-1 text-[10px] text-white/60 hover:text-[#E3FF00] flex items-center justify-center gap-1 py-1"
                    data-testid={`move-deal-${deal.id}`}
                >
                    <ArrowLeftRight className="w-3 h-3" /> نقل
                </button>
            </div>
            {showMenu && (
                <div className="mt-2 space-y-1">
                    {stages.filter((s) => s.key !== deal.stage).map((s) => (
                        <button
                            key={s.key}
                            onClick={(e) => { e.stopPropagation(); onMove(deal, s.key); setShowMenu(false); }}
                            className="w-full text-start text-xs px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 flex items-center gap-2"
                        >
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                            {s.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function CRMDeals() {
    const [pipeline, setPipeline] = useState({});
    const [stages, setStages] = useState([]);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const nav = useNavigate();

    const load = async () => {
        try {
            const [s, p, c] = await Promise.all([
                api.get("/crm/stages"),
                api.get("/crm/deals/pipeline"),
                api.get("/crm/clients"),
            ]);
            setStages(s.data);
            setPipeline(p.data);
            setClients(c.data);
            setLoading(false);
        } catch { nav("/auth"); }
    };
    useEffect(() => { load(); }, []);

    const create = async (form) => {
        await api.post("/crm/deals", form);
        toast.success("تمت إضافة الصفقة ✓");
        await load();
    };

    const move = async (deal, stage) => {
        try {
            await api.put(`/crm/deals/${deal.id}/stage`, { stage });
            toast.success("تم النقل");
            await load();
        } catch { toast.error("خطأ"); }
    };

    if (loading) return <div className="p-8 text-white/50 text-center">جارٍ التحميل...</div>;

    return (
        <div data-testid="crm-deals" className="pt-4">
            <div className="px-4 mb-3 flex items-center justify-between">
                <p className="text-xs text-white/50 font-body">اسحب أفقياً لرؤية كل المراحل</p>
                <button
                    data-testid="add-deal-btn"
                    onClick={() => setShowForm(true)}
                    disabled={clients.length === 0}
                    className="bg-[#E3FF00] text-black font-heading font-bold rounded-xl px-4 py-2 text-sm flex items-center gap-1 active:scale-95 disabled:opacity-40"
                >
                    <Plus className="w-4 h-4" /> صفقة
                </button>
            </div>

            {clients.length === 0 && (
                <div className="mx-4 mb-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-sm text-amber-300">
                    أضف عميلاً أولاً لتتمكّن من إنشاء صفقات.
                </div>
            )}

            {/* Kanban horizontal scroll */}
            <div className="flex gap-3 px-4 overflow-x-auto scrollbar-thin pb-4" style={{ scrollSnapType: "x mandatory" }}>
                {stages.map((s) => {
                    const col = pipeline[s.key] || { deals: [], count: 0, total_value: 0 };
                    return (
                        <div
                            key={s.key}
                            className="flex-shrink-0 w-64 bg-white/5 border border-white/10 rounded-2xl p-3"
                            style={{ scrollSnapAlign: "start" }}
                        >
                            {/* Column header */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                    <h4 className="font-heading font-bold text-sm text-white">{s.name}</h4>
                                    <span className="text-[10px] text-white/40">{col.count}</span>
                                </div>
                                <span className="text-[10px] text-[#E3FF00] font-heading font-semibold">
                                    ${col.total_value.toLocaleString()}
                                </span>
                            </div>

                            {/* Cards */}
                            <div className="space-y-2 min-h-[100px]">
                                {col.deals.length === 0 && (
                                    <div className="text-center py-6 text-white/30 text-xs">فارغ</div>
                                )}
                                {col.deals.map((d) => (
                                    <DealCard
                                        key={d.id}
                                        deal={d}
                                        stages={stages}
                                        onMove={move}
                                        onOpen={() => nav(`/crm/deals/${d.id}`)}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {showForm && <DealForm clients={clients} onSubmit={create} onClose={() => setShowForm(false)} />}
        </div>
    );
}
