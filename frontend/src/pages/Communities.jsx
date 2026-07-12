import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Users, Plus, Search, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const ICON_OPTIONS = ["🌱", "🎨", "📸", "🎬", "🎵", "💻", "📚", "🍽️", "💼", "🚀", "❤️", "🌍", "🏆", "🎓"];

export default function Communities() {
    const [items, setItems] = useState([]);
    const [q, setQ] = useState("");
    const [debounced, setDebounced] = useState("");
    const [show, setShow] = useState(false);
    const { user } = useAuth();
    const nav = useNavigate();

    // debounce
    useEffect(() => {
        const t = setTimeout(() => setDebounced(q), 300);
        return () => clearTimeout(t);
    }, [q]);

    const load = () => {
        const url = debounced ? `/communities?q=${encodeURIComponent(debounced)}` : "/communities";
        api.get(url).then((r) => setItems(r.data));
    };
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [debounced]);

    const openCreate = () => {
        if (!user) return nav("/auth");
        setShow(true);
    };

    return (
        <div className="p-6 pt-16 font-body pb-24" data-testid="communities-page">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Users className="w-6 h-6 text-[#D1795F]" />
                    <h1 className="text-3xl font-heading font-black">المجتمعات</h1>
                </div>
                <button
                    data-testid="new-community-btn"
                    onClick={openCreate}
                    className="bg-[#D1795F] text-white font-heading font-bold rounded-full px-4 py-2 text-sm flex items-center gap-1"
                >
                    <Plus className="w-4 h-4" /> مجتمع
                </button>
            </div>
            <p className="text-sm text-neutral-400 mb-4">انضم لمجتمعك أو أسّس مجتمعك الخاص</p>

            {/* Search */}
            <div className="relative mb-4">
                <Search className="w-4 h-4 text-white/40 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                    data-testid="community-search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="ابحث في المجتمعات..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder-white/40 focus:border-[#D1795F] outline-none"
                />
            </div>

            {items.length === 0 && (
                <div className="text-center py-14 border border-dashed border-white/10 rounded-2xl">
                    <div className="text-4xl mb-2 opacity-40">🌱</div>
                    <div className="text-sm text-white/50 mb-3">{debounced ? "لا نتائج بحث" : "لا توجد مجتمعات بعد"}</div>
                    <button onClick={openCreate} className="text-xs text-[#D1795F] hover:underline font-heading font-bold inline-flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> كن أول من يؤسّس مجتمعاً
                    </button>
                </div>
            )}

            <div className="grid grid-cols-2 gap-3">
                {items.map((c) => (
                    <Link
                        key={c.slug}
                        to={`/communities/${c.slug}`}
                        data-testid={`community-${c.slug}`}
                        className={`bg-[#141414] border rounded-2xl p-4 transition ${c.joined ? "border-[#D1795F]" : "border-[#262626] hover:border-white/30"}`}
                    >
                        <div className="text-3xl mb-2">{c.icon || "🌱"}</div>
                        <div className="font-heading font-bold text-white truncate">{c.name}</div>
                        <div className="text-[10px] text-white/50 mt-0.5">{c.members_count || 0} عضو</div>
                        {c.joined && <div className="text-[10px] text-[#D1795F] mt-1">✓ عضو</div>}
                    </Link>
                ))}
            </div>

            {show && <NewCommunityModal onClose={() => setShow(false)} onCreated={(c) => { setShow(false); toast.success("تم إنشاء المجتمع"); nav(`/communities/${c.slug}`); }} />}
        </div>
    );
}

function NewCommunityModal({ onClose, onCreated }) {
    const [form, setForm] = useState({ name: "", description: "", icon: "🌱" });
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return toast.error("الاسم مطلوب");
        setBusy(true);
        try {
            const r = await api.post("/communities", form);
            onCreated(r.data);
        } catch (err) {
            toast.error(err.response?.data?.detail || "خطأ");
        } finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
            <form
                onSubmit={submit}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-[#0F0F0F] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 space-y-3"
                data-testid="new-community-modal"
            >
                <div className="flex items-center justify-between">
                    <h3 className="font-heading font-black text-lg">تأسيس مجتمع</h3>
                    <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><X className="w-4 h-4" /></button>
                </div>
                <input
                    required
                    data-testid="comm-name"
                    placeholder="اسم المجتمع (مثال: مصورو الرياض)"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#D1795F]"
                />
                <textarea
                    data-testid="comm-desc"
                    placeholder="ما رسالة هذا المجتمع؟"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#D1795F] resize-none"
                />
                <div>
                    <p className="text-xs text-white/50 mb-2">اختر أيقونة</p>
                    <div className="grid grid-cols-7 gap-1.5">
                        {ICON_OPTIONS.map((ic) => (
                            <button
                                key={ic}
                                type="button"
                                onClick={() => setForm({ ...form, icon: ic })}
                                className={`text-2xl aspect-square rounded-xl flex items-center justify-center transition ${form.icon === ic ? "bg-[#D1795F]/20 border border-[#D1795F]" : "bg-white/5 hover:bg-white/10 border border-transparent"}`}
                            >{ic}</button>
                        ))}
                    </div>
                </div>
                <button data-testid="comm-save" type="submit" disabled={busy} className="w-full bg-[#D1795F] hover:bg-[#B86648] text-white font-heading font-bold rounded-xl py-3 disabled:opacity-50">
                    {busy ? "جارٍ الإنشاء..." : "أنشئ المجتمع"}
                </button>
            </form>
        </div>
    );
}
