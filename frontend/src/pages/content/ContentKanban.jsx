import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, X, ArrowLeftRight, Sparkles } from "lucide-react";

function ContentForm({ meta, initial, onSubmit, onClose }) {
    const [form, setForm] = useState(
        initial || {
            title: "", description: "", platform: "instagram", format: "reel",
            status: "idea", hook: "", caption: "", hashtags: "", script: "", scheduled_at: "",
        }
    );
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (!form.title.trim()) return toast.error("العنوان مطلوب");
        setBusy(true);
        try { await onSubmit(form); onClose(); }
        catch { toast.error("خطأ"); }
        finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
            <form data-testid="content-form" onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#0F0F0F] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-heading font-bold text-lg">{initial ? "تعديل محتوى" : "محتوى جديد"}</h3>
                    <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-3">
                    <input data-testid="content-title" placeholder="العنوان *" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#E3FF00] outline-none" />
                    <textarea placeholder="وصف مختصر" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} rows={2} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#E3FF00] outline-none resize-none" />
                    <div className="grid grid-cols-2 gap-3">
                        <select value={form.platform} onChange={(e) => setForm({...form, platform: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white outline-none">
                            {meta.platforms.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                        </select>
                        <select value={form.format} onChange={(e) => setForm({...form, format: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white outline-none">
                            {meta.formats.map((f) => <option key={f.key} value={f.key}>{f.name}</option>)}
                        </select>
                    </div>
                    <input placeholder="Hook (الجملة الأولى الجذّابة)" value={form.hook} onChange={(e) => setForm({...form, hook: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#E3FF00] outline-none" />
                    <textarea placeholder="Caption — الوصف المنشور" value={form.caption} onChange={(e) => setForm({...form, caption: e.target.value})} rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#E3FF00] outline-none resize-none" />
                    <input placeholder="Hashtags" value={form.hashtags} onChange={(e) => setForm({...form, hashtags: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#E3FF00] outline-none" />
                    <input type="datetime-local" value={form.scheduled_at?.slice(0,16) || ""} onChange={(e) => setForm({...form, scheduled_at: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none" />
                    <select value={form.status} onChange={(e) => setForm({...form, status: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white outline-none">
                        {meta.statuses.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
                    </select>
                </div>
                <button data-testid="content-save" type="submit" disabled={busy} className="w-full bg-[#E3FF00] text-black font-heading font-bold rounded-xl py-3 mt-5 active:scale-95 disabled:opacity-60">
                    {busy ? "جارٍ الحفظ..." : "حفظ"}
                </button>
            </form>
        </div>
    );
}

function ContentCard({ item, onOpen, onMove, statuses, meta }) {
    const [showMenu, setShowMenu] = useState(false);
    const platform = meta.platforms.find((p) => p.key === item.platform);
    return (
        <div data-testid={`content-card-${item.id}`} className="bg-black border border-white/10 rounded-xl p-3 hover:border-[#E3FF00]/40 transition cursor-pointer">
            <div onClick={onOpen}>
                <h4 className="text-sm font-heading font-semibold text-white line-clamp-2 mb-2">{item.title}</h4>
                {item.hook && <p className="text-[11px] text-[#E3FF00] mb-1 line-clamp-1">Hook: {item.hook}</p>}
                <div className="flex items-center gap-2 text-[10px]">
                    <span className="px-2 py-0.5 rounded-full text-white/70" style={{ backgroundColor: `${platform?.color || '#666'}30` }}>{platform?.name || item.platform}</span>
                    <span className="text-white/40">{item.format}</span>
                </div>
            </div>
            <div className="mt-2 pt-2 border-t border-white/5">
                <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} className="w-full text-[10px] text-white/60 hover:text-[#E3FF00] flex items-center justify-center gap-1 py-1">
                    <ArrowLeftRight className="w-3 h-3" /> نقل
                </button>
            </div>
            {showMenu && (
                <div className="mt-2 space-y-1">
                    {statuses.filter((s) => s.key !== item.status).map((s) => (
                        <button key={s.key} onClick={(e) => { e.stopPropagation(); onMove(item, s.key); setShowMenu(false); }} className="w-full text-start text-xs px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                            {s.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function ContentKanban() {
    const [kanban, setKanban] = useState({});
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [params, setParams] = useSearchParams();
    const nav = useNavigate();

    const load = async () => {
        try {
            const [m, k] = await Promise.all([api.get("/content/meta"), api.get("/content/kanban")]);
            setMeta(m.data);
            setKanban(k.data);
            setLoading(false);
        } catch { nav("/auth"); }
    };
    useEffect(() => { load(); }, []);
    useEffect(() => {
        if (params.get("new") === "1") { setShowForm(true); params.delete("new"); setParams(params); }
    }, [params, setParams]);

    const create = async (form) => {
        await api.post("/content/items", form);
        toast.success("تمت الإضافة ✓");
        await load();
    };

    const move = async (item, status) => {
        try {
            await api.put(`/content/items/${item.id}/status`, { status });
            toast.success("تم النقل");
            await load();
        } catch { toast.error("خطأ"); }
    };

    if (loading) return <div className="p-8 text-white/50 text-center">جارٍ التحميل...</div>;

    return (
        <div data-testid="content-kanban" className="pt-4">
            <div className="px-4 mb-3 flex items-center justify-between">
                <p className="text-xs text-white/50 font-body">اسحب أفقياً</p>
                <button data-testid="add-content-btn" onClick={() => setShowForm(true)} className="bg-[#E3FF00] text-black font-heading font-bold rounded-xl px-4 py-2 text-sm flex items-center gap-1 active:scale-95">
                    <Plus className="w-4 h-4" /> محتوى
                </button>
            </div>
            <div className="flex gap-3 px-4 overflow-x-auto scrollbar-thin pb-4" style={{ scrollSnapType: "x mandatory" }}>
                {meta.statuses.map((s) => {
                    const col = kanban[s.key] || { items: [], count: 0 };
                    return (
                        <div key={s.key} className="flex-shrink-0 w-64 bg-white/5 border border-white/10 rounded-2xl p-3" style={{ scrollSnapAlign: "start" }}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                    <h4 className="font-heading font-bold text-sm text-white">{s.name}</h4>
                                </div>
                                <span className="text-[10px] text-white/40">{col.count}</span>
                            </div>
                            <div className="space-y-2 min-h-[100px]">
                                {col.items.length === 0 && <div className="text-center py-6 text-white/30 text-xs">فارغ</div>}
                                {col.items.map((it) => (
                                    <ContentCard key={it.id} item={it} statuses={meta.statuses} meta={meta} onMove={move} onOpen={() => nav(`/content/item/${it.id}`)} />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
            {showForm && meta && <ContentForm meta={meta} onSubmit={create} onClose={() => setShowForm(false)} />}
        </div>
    );
}
