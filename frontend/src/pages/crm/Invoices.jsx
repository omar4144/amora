import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { Plus, FileText, Download, Trash2, Search, ArrowRight, X, DollarSign } from "lucide-react";
import { toast } from "sonner";

const STATUS_META = {
    draft:     { label: "مسودة",   color: "#94A3B8" },
    sent:      { label: "مُرسلة",   color: "#57769D" },
    paid:      { label: "مدفوعة",  color: "#C3E0A5" },
    overdue:   { label: "متأخرة",  color: "#EF4444" },
    cancelled: { label: "ملغاة",   color: "#6B7280" },
};

export default function Invoices() {
    const [items, setItems] = useState([]);
    const [stats, setStats] = useState(null);
    const [clients, setClients] = useState([]);
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [showNew, setShowNew] = useState(false);
    const [params, setParams] = useSearchParams();
    const nav = useNavigate();

    const load = async () => {
        try {
            const [inv, st, cl] = await Promise.all([
                api.get(`/crm/invoices${statusFilter ? `?status=${statusFilter}` : ""}`),
                api.get("/crm/invoices/stats"),
                api.get("/crm/clients"),
            ]);
            setItems(inv.data);
            setStats(st.data);
            setClients(cl.data);
        } catch { nav("/auth"); }
    };
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);
    useEffect(() => {
        if (params.get("new") === "1") { setShowNew(true); params.delete("new"); setParams(params); }
    }, [params, setParams]);

    const create = async (form) => {
        try {
            const r = await api.post("/crm/invoices", form);
            toast.success("تم إنشاء الفاتورة");
            setShowNew(false);
            nav(`/crm/invoices/${r.data.id}`);
        } catch (e) {
            toast.error(e.response?.data?.detail || "خطأ");
        }
    };

    const filtered = q.trim()
        ? items.filter((i) => (i.title || "").toLowerCase().includes(q.toLowerCase()) || (i.number || "").toLowerCase().includes(q.toLowerCase()))
        : items;

    return (
        <div data-testid="invoices-page" className="p-4 space-y-4 pb-24">
            <div className="flex items-center justify-between gap-3">
                <h1 className="font-heading font-black text-lg text-white">الفواتير</h1>
                <button data-testid="new-invoice-btn" onClick={() => setShowNew(true)} className="bg-[#D1795F] text-white font-heading font-bold rounded-xl px-4 py-2 text-sm flex items-center gap-1 active:scale-95">
                    <Plus className="w-4 h-4" /> فاتورة
                </button>
            </div>

            {/* KPI cards */}
            {stats && (
                <div className="grid grid-cols-3 gap-2">
                    <Kpi label="مدفوع" value={`$${stats.paid.toLocaleString()}`} tone="#C3E0A5" />
                    <Kpi label="مستحق" value={`$${stats.outstanding.toLocaleString()}`} tone="#F59E0B" />
                    <Kpi label="مسوّدات" value={`$${stats.draft.toLocaleString()}`} tone="#94A3B8" />
                </div>
            )}

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
                <button data-testid="filter-all" onClick={() => setStatusFilter("")} className={`text-[11px] px-3 py-1.5 rounded-full whitespace-nowrap font-heading font-bold ${!statusFilter ? "bg-[#D1795F] text-white" : "bg-white/5 text-white/60 border border-white/10"}`}>الكل</button>
                {Object.entries(STATUS_META).map(([k, m]) => (
                    <button key={k} data-testid={`filter-${k}`} onClick={() => setStatusFilter(k)} className={`text-[11px] px-3 py-1.5 rounded-full whitespace-nowrap font-heading font-bold ${statusFilter === k ? "text-white" : "bg-white/5 text-white/60 border border-white/10"}`} style={{ backgroundColor: statusFilter === k ? m.color : undefined }}>
                        {m.label} {stats?.by_status?.[k] > 0 && `(${stats.by_status[k]})`}
                    </button>
                ))}
            </div>

            <div className="relative">
                <Search className="w-4 h-4 text-white/40 absolute right-3 top-1/2 -translate-y-1/2" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder-white/40 focus:border-[#D1795F] outline-none" />
            </div>

            <div className="space-y-2">
                {filtered.length === 0 && <div className="text-center py-16 text-white/40 text-sm">لا فواتير — ابدأ بإصدار أول فاتورة</div>}
                {filtered.map((i) => {
                    const st = STATUS_META[i.status] || STATUS_META.draft;
                    return (
                        <button
                            key={i.id}
                            data-testid={`invoice-${i.id}`}
                            onClick={() => nav(`/crm/invoices/${i.id}`)}
                            className="w-full text-start bg-white/5 border border-white/10 rounded-2xl p-3 hover:border-[#D1795F]/40 transition"
                        >
                            <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-3.5 h-3.5 text-[#D1795F]" />
                                        <span className="font-heading font-bold text-sm text-white truncate">{i.title || i.number}</span>
                                    </div>
                                    <div className="text-[10px] text-white/50 mt-0.5">{i.number} • {i.client?.name || ""}</div>
                                </div>
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-heading font-bold text-black" style={{ backgroundColor: st.color }}>{st.label}</span>
                                    <span className="text-[#D1795F] font-heading font-black text-sm">${(i.total || 0).toLocaleString()}</span>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {showNew && (
                <NewInvoiceModal clients={clients} onClose={() => setShowNew(false)} onSubmit={create} />
            )}
        </div>
    );
}

function Kpi({ label, value, tone }) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <div className="w-2 h-2 rounded-full mb-1.5" style={{ backgroundColor: tone }} />
            <div className="text-sm font-heading font-black text-white truncate">{value}</div>
            <div className="text-[10px] text-white/50 mt-0.5">{label}</div>
        </div>
    );
}

function NewInvoiceModal({ clients, onClose, onSubmit }) {
    const [form, setForm] = useState({
        client_id: clients[0]?.id || "",
        title: "فاتورة خدمات",
        items: [{ description: "", quantity: 1, unit_price: 0 }],
        tax_percent: 0,
        discount: 0,
        currency: "USD",
        notes: "",
    });
    const setItem = (idx, patch) => {
        const arr = [...form.items];
        arr[idx] = { ...arr[idx], ...patch };
        setForm({ ...form, items: arr });
    };
    const addItem = () => setForm({ ...form, items: [...form.items, { description: "", quantity: 1, unit_price: 0 }] });
    const removeItem = (idx) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });

    const subtotal = form.items.reduce((s, it) => s + (it.quantity || 0) * (it.unit_price || 0), 0);
    const tax = subtotal * (form.tax_percent || 0) / 100;
    const total = subtotal + tax - (form.discount || 0);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
            <form
                data-testid="new-invoice-form"
                onSubmit={(e) => { e.preventDefault(); if (!form.client_id) return toast.error("اختر عميل"); onSubmit({ ...form, items: form.items.filter((i) => i.description) }); }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-[#0F0F0F] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto"
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-heading font-bold text-lg">فاتورة جديدة</h3>
                    <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-3">
                    <select data-testid="inv-client" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none">
                        <option value="">— اختر العميل —</option>
                        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ""}</option>)}
                    </select>
                    <input placeholder="عنوان الفاتورة" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none" />

                    <div className="space-y-2">
                        <p className="text-xs text-white/50">البنود</p>
                        {form.items.map((it, idx) => (
                            <div key={idx} className="bg-black/40 rounded-xl p-2.5 space-y-1.5">
                                <input placeholder="الوصف" value={it.description} onChange={(e) => setItem(idx, { description: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none" />
                                <div className="grid grid-cols-3 gap-1.5">
                                    <input type="number" step="0.01" min="0" placeholder="الكمية" value={it.quantity} onChange={(e) => setItem(idx, { quantity: parseFloat(e.target.value) || 0 })} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none" />
                                    <input type="number" step="0.01" min="0" placeholder="السعر" value={it.unit_price} onChange={(e) => setItem(idx, { unit_price: parseFloat(e.target.value) || 0 })} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none" />
                                    <button type="button" onClick={() => removeItem(idx)} className="rounded-lg bg-red-500/10 text-red-400 text-xs">حذف</button>
                                </div>
                            </div>
                        ))}
                        <button type="button" onClick={addItem} className="w-full border border-dashed border-white/20 rounded-xl py-2 text-xs text-white/60 flex items-center justify-center gap-1"><Plus className="w-3 h-3" /> بند جديد</button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <input type="number" step="0.01" min="0" placeholder="ضريبة %" value={form.tax_percent} onChange={(e) => setForm({ ...form, tax_percent: parseFloat(e.target.value) || 0 })} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none" />
                        <input type="number" step="0.01" min="0" placeholder="خصم" value={form.discount} onChange={(e) => setForm({ ...form, discount: parseFloat(e.target.value) || 0 })} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none" />
                    </div>

                    <div className="bg-[#D1795F]/10 border border-[#D1795F]/30 rounded-xl p-3 text-sm">
                        <div className="flex justify-between text-white/70"><span>المجموع</span><span>${subtotal.toFixed(2)}</span></div>
                        {tax > 0 && <div className="flex justify-between text-white/70"><span>ضريبة</span><span>${tax.toFixed(2)}</span></div>}
                        {form.discount > 0 && <div className="flex justify-between text-white/70"><span>خصم</span><span>-${form.discount.toFixed(2)}</span></div>}
                        <div className="border-t border-[#D1795F]/30 mt-2 pt-2 flex justify-between font-heading font-black text-[#D1795F]"><span>الإجمالي</span><span>${total.toFixed(2)}</span></div>
                    </div>
                </div>
                <button data-testid="inv-save" type="submit" className="w-full bg-[#D1795F] text-white font-heading font-bold rounded-xl py-3 mt-4 active:scale-95">إنشاء الفاتورة</button>
            </form>
        </div>
    );
}
