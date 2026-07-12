import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Briefcase, DollarSign, Clock, Plus, X } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["تسويق", "تصوير", "تصميم", "مونتاج", "كتابة", "برمجة", "تمثيل", "استشارة", "أخرى"];

export default function Marketplace() {
    const [items, setItems] = useState([]);
    const [cat, setCat] = useState("");
    const [show, setShow] = useState(false);
    const { user } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ title: "", description: "", category: "تسويق", budget_min: "", budget_max: "", deadline_days: 7 });

    const load = () => {
        const q = cat ? `?category=${encodeURIComponent(cat)}` : "";
        api.get(`/project-requests${q}`).then((r) => setItems(r.data));
    };
    useEffect(() => { load(); }, [cat]);  // eslint-disable-line react-hooks/exhaustive-deps

    const create = async (e) => {
        e.preventDefault();
        if (!user) return navigate("/auth");
        try {
            await api.post("/project-requests", {
                ...form,
                budget_min: parseFloat(form.budget_min || 0),
                budget_max: parseFloat(form.budget_max || 0),
                deadline_days: parseInt(form.deadline_days),
            });
            toast.success("نُشر طلبك");
            setShow(false);
            setForm({ title: "", description: "", category: "تسويق", budget_min: "", budget_max: "", deadline_days: 7 });
            load();
        } catch (err) {
            toast.error(err?.response?.data?.detail || "خطأ");
        }
    };

    return (
        <div className="p-6 pt-8 font-body" data-testid="marketplace-page">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Briefcase className="w-6 h-6 text-[#D1795F]" />
                    <h1 className="text-2xl font-heading font-black">السوق</h1>
                </div>
                <button data-testid="new-request-btn" onClick={() => user ? setShow(true) : navigate("/auth")} className="bg-[#D1795F] text-white font-heading font-bold rounded-full px-4 py-2 text-sm flex items-center gap-1 active:scale-95">
                    <Plus className="w-4 h-4" /> اطلب مشروع
                </button>
            </div>
            <p className="text-sm text-neutral-400 mb-4">اعرض ما تحتاجه أو ابحث بين طلبات المشاريع</p>

            <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5 pb-1">
                <button onClick={() => setCat("")} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-heading font-bold ${!cat ? "bg-[#D1795F] text-white" : "bg-[#141414] border border-[#262626]"}`}>الكل</button>
                {CATEGORIES.map((c) => (
                    <button key={c} data-testid={`filter-${c}`} onClick={() => setCat(c)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-heading font-bold ${cat === c ? "bg-[#D1795F] text-white" : "bg-[#141414] border border-[#262626]"}`}>{c}</button>
                ))}
            </div>

            {items.length === 0 && <div className="text-center py-16 text-neutral-500">لا طلبات في هذه الفئة</div>}

            <div className="space-y-3">
                {items.map((p) => (
                    <div key={p.id} className="bg-[#141414] border border-[#262626] rounded-2xl p-4" data-testid={`request-${p.id}`}>
                        <div className="flex items-start justify-between mb-2">
                            <h3 className="font-heading font-bold flex-1">{p.title}</h3>
                            <span className="text-xs bg-white/5 px-2 py-1 rounded-full">{p.category}</span>
                        </div>
                        <p className="text-sm text-neutral-400 line-clamp-2 mb-3">{p.description}</p>
                        <div className="flex items-center gap-4 text-xs text-neutral-500 mb-3">
                            {(p.budget_min > 0 || p.budget_max > 0) && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> ${p.budget_min}-${p.budget_max}</span>}
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {p.deadline_days} يوم</span>
                            <span>{p.applications_count} مقدّم</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <Link to={`/u/${p.user?.username}`} className="text-xs text-[#D1795F]">@{p.user?.username}</Link>
                            <Link to={`/marketplace/${p.id}`} data-testid={`view-request-${p.id}`} className="text-xs bg-white/10 hover:bg-white/20 rounded-full px-3 py-1.5 font-heading font-bold">التفاصيل ←</Link>
                        </div>
                    </div>
                ))}
            </div>

            {show && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShow(false)}>
                    <form onSubmit={create} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 space-y-3" data-testid="new-request-modal">
                        <div className="flex items-center justify-between">
                            <h3 className="font-heading font-black text-lg">طلب مشروع جديد</h3>
                            <button type="button" onClick={() => setShow(false)}><X className="w-5 h-5" /></button>
                        </div>
                        <input required data-testid="req-title" placeholder="عنوان الطلب" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#D1795F] focus:outline-none" />
                        <textarea required data-testid="req-desc" placeholder="اشرح ما تحتاجه بالتفصيل..." rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#D1795F] focus:outline-none resize-none" />
                        <select data-testid="req-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#D1795F] focus:outline-none">
                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                            <input type="number" min="0" placeholder="ميزانية من ($)" data-testid="req-budget-min" value={form.budget_min} onChange={(e) => setForm({ ...form, budget_min: e.target.value })} className="bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#D1795F] focus:outline-none" />
                            <input type="number" min="0" placeholder="إلى ($)" data-testid="req-budget-max" value={form.budget_max} onChange={(e) => setForm({ ...form, budget_max: e.target.value })} className="bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#D1795F] focus:outline-none" />
                        </div>
                        <input type="number" min="1" placeholder="مدة التنفيذ (يوم)" data-testid="req-deadline" value={form.deadline_days} onChange={(e) => setForm({ ...form, deadline_days: e.target.value })} className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#D1795F] focus:outline-none" />
                        <button data-testid="submit-request" type="submit" className="w-full bg-[#D1795F] text-white font-heading font-bold rounded-full py-3">نشر الطلب</button>
                    </form>
                </div>
            )}
        </div>
    );
}
