import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Search, X, Building2, Mail, Phone, Tag, Trash2, Edit3 } from "lucide-react";

function ClientForm({ initial, onSubmit, onClose }) {
    const [form, setForm] = useState(
        initial || { name: "", email: "", phone: "", company: "", industry: "", notes: "", status: "active", source: "manual" }
    );
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return toast.error("الاسم مطلوب");
        setBusy(true);
        try { await onSubmit(form); onClose(); }
        catch { toast.error("خطأ"); }
        finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
            <form
                data-testid="client-form"
                onSubmit={submit}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-[#0F0F0F] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto"
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-heading font-bold text-lg">{initial ? "تعديل عميل" : "عميل جديد"}</h3>
                    <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-3">
                    <input data-testid="client-name" placeholder="الاسم *" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#E3FF00] outline-none" />
                    <input placeholder="الشركة" value={form.company} onChange={(e) => setForm({...form, company: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#E3FF00] outline-none" />
                    <input placeholder="المجال" value={form.industry} onChange={(e) => setForm({...form, industry: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#E3FF00] outline-none" />
                    <div className="grid grid-cols-2 gap-3">
                        <input placeholder="البريد" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#E3FF00] outline-none" />
                        <input placeholder="الهاتف" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#E3FF00] outline-none" />
                    </div>
                    <textarea placeholder="ملاحظات" value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#E3FF00] outline-none resize-none" />
                    <div className="grid grid-cols-2 gap-3">
                        <select value={form.status} onChange={(e) => setForm({...form, status: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none">
                            <option value="active">نشط</option>
                            <option value="inactive">غير نشط</option>
                            <option value="archived">مؤرشف</option>
                        </select>
                        <select value={form.source} onChange={(e) => setForm({...form, source: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none">
                            <option value="manual">يدوي</option>
                            <option value="referral">إحالة</option>
                            <option value="website">موقع</option>
                            <option value="lead">Lead</option>
                            <option value="other">أخرى</option>
                        </select>
                    </div>
                </div>
                <button data-testid="client-save" type="submit" disabled={busy} className="w-full bg-[#E3FF00] text-black font-heading font-bold rounded-xl py-3 mt-5 active:scale-95 disabled:opacity-60">
                    {busy ? "جارٍ الحفظ..." : "حفظ"}
                </button>
            </form>
        </div>
    );
}

export default function CRMClients() {
    const [clients, setClients] = useState([]);
    const [q, setQ] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [params, setParams] = useSearchParams();
    const nav = useNavigate();

    const load = () => api.get("/crm/clients").then((r) => setClients(r.data)).catch(() => nav("/auth"));
    useEffect(() => { load(); }, []);
    useEffect(() => {
        if (params.get("new") === "1") { setShowForm(true); params.delete("new"); setParams(params); }
    }, [params, setParams]);

    const filtered = useMemo(() => {
        if (!q.trim()) return clients;
        const s = q.toLowerCase();
        return clients.filter((c) =>
            [c.name, c.email, c.company, c.industry].some((v) => (v||"").toLowerCase().includes(s))
        );
    }, [q, clients]);

    const create = async (form) => {
        const r = await api.post("/crm/clients", form);
        setClients([r.data, ...clients]);
        toast.success("تمت إضافة العميل ✓");
    };

    const update = async (form) => {
        const r = await api.put(`/crm/clients/${editing.id}`, form);
        setClients(clients.map((c) => c.id === r.data.id ? r.data : c));
        setEditing(null);
        toast.success("تم التحديث");
    };

    const remove = async (c) => {
        if (!window.confirm(`حذف العميل "${c.name}"؟ ستُحذف صفقاته أيضاً.`)) return;
        await api.delete(`/crm/clients/${c.id}`);
        setClients(clients.filter((x) => x.id !== c.id));
        toast.success("محذوف");
    };

    return (
        <div data-testid="crm-clients" className="p-4 space-y-4">
            <div className="flex gap-2">
                <div className="flex-1 relative">
                    <Search className="w-4 h-4 text-white/40 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                        data-testid="clients-search"
                        placeholder="بحث..."
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder-white/40 focus:border-[#E3FF00] outline-none"
                    />
                </div>
                <button
                    data-testid="add-client-btn"
                    onClick={() => setShowForm(true)}
                    className="bg-[#E3FF00] text-black font-heading font-bold rounded-xl px-4 py-2.5 text-sm flex items-center gap-1 active:scale-95"
                >
                    <Plus className="w-4 h-4" /> إضافة
                </button>
            </div>

            <div className="space-y-2">
                {filtered.length === 0 && (
                    <div className="text-center py-16 text-white/40 text-sm">
                        {clients.length === 0 ? "لا يوجد عملاء بعد. ابدأ بإضافة واحد!" : "لا توجد نتائج"}
                    </div>
                )}
                {filtered.map((c) => (
                    <div key={c.id} data-testid={`client-${c.id}`} className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:border-[#E3FF00]/40 transition">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-heading font-bold text-white truncate">{c.name}</h3>
                                    {c.status !== "active" && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">{c.status}</span>
                                    )}
                                </div>
                                {c.company && (
                                    <div className="flex items-center gap-1 text-xs text-white/60 font-body">
                                        <Building2 className="w-3 h-3" /> {c.company}
                                        {c.industry && <span className="text-white/40">• {c.industry}</span>}
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-white/50">
                                    {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</span>}
                                    {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</span>}
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-[10px] bg-[#E3FF00]/10 text-[#E3FF00] px-2 py-0.5 rounded-full font-heading font-semibold">
                                        {c.deals_count} صفقة
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <button data-testid={`edit-client-${c.id}`} onClick={() => setEditing(c)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center">
                                    <Edit3 className="w-3.5 h-3.5 text-white/70" />
                                </button>
                                <button data-testid={`delete-client-${c.id}`} onClick={() => remove(c)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-red-500/20 flex items-center justify-center group">
                                    <Trash2 className="w-3.5 h-3.5 text-white/70 group-hover:text-red-400" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {showForm && <ClientForm onSubmit={create} onClose={() => setShowForm(false)} />}
            {editing && <ClientForm initial={editing} onSubmit={update} onClose={() => setEditing(null)} />}
        </div>
    );
}
