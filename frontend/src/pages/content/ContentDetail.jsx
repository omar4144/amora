import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { ArrowRight, Trash2, Sparkles, Hash, MessageCircle, FileText, Wand2, Building2, CheckSquare } from "lucide-react";

export default function ContentDetail() {
    const { id } = useParams();
    const nav = useNavigate();
    const [item, setItem] = useState(null);
    const [meta, setMeta] = useState(null);
    const [busy, setBusy] = useState(false);
    const [aiBusy, setAiBusy] = useState("");
    const [aiResult, setAiResult] = useState("");
    const [aiFor, setAiFor] = useState("");
    const [linkedClient, setLinkedClient] = useState(null);
    const [linkedTasks, setLinkedTasks] = useState([]);

    const load = async () => {
        try {
            const [m, it] = await Promise.all([api.get("/content/meta"), api.get(`/content/items/${id}`)]);
            setMeta(m.data);
            setItem(it.data);
            // fetch linked entities
            if (it.data.client_id) {
                try {
                    const c = await api.get(`/crm/clients/${it.data.client_id}`);
                    setLinkedClient(c.data);
                } catch { /* ignore */ }
            } else {
                setLinkedClient(null);
            }
            try {
                const r = await api.get(`/workspace/related?content_id=${id}`);
                setLinkedTasks(r.data.tasks || []);
            } catch { /* ignore */ }
        } catch {
            toast.error("تعذّر تحميل المحتوى");
            nav("/content/kanban");
        }
    };
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

    const save = async (patch) => {
        setBusy(true);
        try {
            const r = await api.put(`/content/items/${id}`, patch);
            setItem(r.data);
            toast.success("تم الحفظ");
        } catch { toast.error("خطأ"); }
        finally { setBusy(false); }
    };

    const moveStatus = async (status) => {
        const r = await api.put(`/content/items/${id}/status`, { status });
        setItem(r.data);
        toast.success("تم النقل");
    };

    const remove = async () => {
        if (!window.confirm(`حذف المحتوى "${item.title}"؟`)) return;
        await api.delete(`/content/items/${id}`);
        toast.success("محذوف");
        nav("/content/kanban");
    };

    const runAi = async (task) => {
        setAiBusy(task);
        setAiFor(task);
        try {
            let topic = item.title;
            if (task === "caption" && item.caption) topic = item.caption;
            const r = await api.post(`/content/ai/${task}`, { topic, platform: item.platform, format: item.format });
            setAiResult(r.data.result);
            toast.success("جاهز!");
        } catch (err) {
            const msg = err.response?.data?.detail || "خطأ AI (ربما الميزانية مستنفدة)";
            setAiResult(msg);
            toast.error(msg);
        } finally { setAiBusy(""); }
    };

    const applyAi = () => {
        const patch = {};
        if (aiFor === "script") patch.script = aiResult;
        else if (aiFor === "caption") patch.caption = aiResult;
        else if (aiFor === "hashtags") patch.hashtags = aiResult;
        else return;
        save(patch);
        setAiResult("");
        setAiFor("");
    };

    if (!item || !meta) return <div className="p-8 text-white/50 text-center">جارٍ التحميل...</div>;

    return (
        <div data-testid="content-detail" className="p-4 space-y-5">
            <button onClick={() => nav(-1)} className="text-xs text-white/60 flex items-center gap-1">
                <ArrowRight className="w-3 h-3" /> رجوع
            </button>

            {/* Header */}
            <div className="bg-gradient-to-br from-[#141414] to-[#0A0A0A] border border-white/10 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <input
                        data-testid="detail-title"
                        value={item.title}
                        onChange={(e) => setItem({ ...item, title: e.target.value })}
                        onBlur={() => save({ title: item.title })}
                        className="flex-1 bg-transparent text-white font-heading font-black text-lg outline-none border-b border-transparent focus:border-[#D1795F]/50 pb-1"
                    />
                    <button onClick={remove} className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center">
                        <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/60">
                    <select value={item.platform} onChange={(e) => save({ platform: e.target.value })} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 outline-none">
                        {meta.platforms.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                    </select>
                    <select value={item.format} onChange={(e) => save({ format: e.target.value })} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 outline-none">
                        {meta.formats.map((f) => <option key={f.key} value={f.key}>{f.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Status picker */}
            <div>
                <p className="text-xs text-white/50 font-body mb-2">الحالة</p>
                <div className="grid grid-cols-4 gap-1.5">
                    {meta.statuses.map((s) => (
                        <button
                            key={s.key}
                            data-testid={`status-${s.key}`}
                            onClick={() => moveStatus(s.key)}
                            className={`text-[10px] font-heading font-semibold px-2 py-2 rounded-lg transition ${item.status === s.key ? "text-black" : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"}`}
                            style={{ backgroundColor: item.status === s.key ? s.color : undefined }}
                        >{s.name}</button>
                    ))}
                </div>
            </div>

            {/* Linked cross-engine cards */}
            {(linkedClient || linkedTasks.length > 0) && (
                <div className="space-y-2">
                    {linkedClient && (
                        <button
                            data-testid="linked-client-card"
                            onClick={() => nav(`/crm/clients/${linkedClient.id}`)}
                            className="w-full text-start bg-gradient-to-r from-[#D1795F]/10 to-transparent border border-[#D1795F]/30 rounded-2xl p-3 flex items-center gap-3 hover:border-[#D1795F]/60 transition"
                        >
                            <div className="w-9 h-9 rounded-xl bg-[#D1795F]/20 flex items-center justify-center flex-shrink-0">
                                <Building2 className="w-4 h-4 text-[#D1795F]" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] text-white/50 font-body">مرتبط بعميل</div>
                                <div className="font-heading font-bold text-sm text-white truncate">{linkedClient.name}</div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-white/40 rotate-180" />
                        </button>
                    )}
                    {linkedTasks.length > 0 && (
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckSquare className="w-3.5 h-3.5 text-[#C3E0A5]" />
                                <span className="text-xs font-heading font-bold text-white/80">مهام مرتبطة ({linkedTasks.length})</span>
                            </div>
                            <div className="space-y-1">
                                {linkedTasks.map((t) => (
                                    <button
                                        key={t.id}
                                        data-testid={`content-task-${t.id}`}
                                        onClick={() => nav(`/tasks/task/${t.id}`)}
                                        className="w-full text-start bg-black/30 rounded-lg p-2 hover:bg-black/50 transition"
                                    >
                                        <div className="text-xs font-heading font-semibold text-white truncate">{t.title}</div>
                                        <div className="text-[10px] text-white/50">{t.status}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Fields */}
            <div className="space-y-3">
                <div>
                    <label className="text-xs text-white/50 font-body block mb-1">Hook (الجملة الجذّابة)</label>
                    <input value={item.hook || ""} onChange={(e) => setItem({ ...item, hook: e.target.value })} onBlur={() => save({ hook: item.hook })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#D1795F]" />
                </div>
                <div>
                    <label className="text-xs text-white/50 font-body block mb-1 flex items-center gap-1"><MessageCircle className="w-3 h-3" /> Caption</label>
                    <textarea value={item.caption || ""} onChange={(e) => setItem({ ...item, caption: e.target.value })} onBlur={() => save({ caption: item.caption })} rows={4} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#D1795F] resize-none" />
                    <div className="flex gap-1 mt-1.5">
                        <button onClick={() => runAi("caption")} disabled={aiBusy === "caption"} className="text-[10px] text-[#D1795F] flex items-center gap-1 hover:underline disabled:opacity-40"><Wand2 className="w-3 h-3" /> {aiBusy === "caption" ? "..." : "حسّن بالـ AI"}</button>
                    </div>
                </div>
                <div>
                    <label className="text-xs text-white/50 font-body block mb-1 flex items-center gap-1"><Hash className="w-3 h-3" /> Hashtags</label>
                    <textarea value={item.hashtags || ""} onChange={(e) => setItem({ ...item, hashtags: e.target.value })} onBlur={() => save({ hashtags: item.hashtags })} rows={2} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#D1795F] resize-none" />
                    <button onClick={() => runAi("hashtags")} disabled={aiBusy === "hashtags"} className="mt-1.5 text-[10px] text-[#D1795F] flex items-center gap-1 hover:underline disabled:opacity-40"><Wand2 className="w-3 h-3" /> {aiBusy === "hashtags" ? "..." : "ولّد هاشتاجات"}</button>
                </div>
                <div>
                    <label className="text-xs text-white/50 font-body block mb-1 flex items-center gap-1"><FileText className="w-3 h-3" /> السيناريو</label>
                    <textarea value={item.script || ""} onChange={(e) => setItem({ ...item, script: e.target.value })} onBlur={() => save({ script: item.script })} rows={6} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#D1795F] resize-none" />
                    <button onClick={() => runAi("script")} disabled={aiBusy === "script"} className="mt-1.5 text-[10px] text-[#D1795F] flex items-center gap-1 hover:underline disabled:opacity-40"><Wand2 className="w-3 h-3" /> {aiBusy === "script" ? "..." : "ولّد سيناريو"}</button>
                </div>
                <div>
                    <label className="text-xs text-white/50 font-body block mb-1">تاريخ الجدولة</label>
                    <input type="datetime-local" value={item.scheduled_at?.slice(0,16) || ""} onChange={(e) => save({ scheduled_at: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none" />
                </div>
            </div>

            {/* AI Result Overlay */}
            {aiResult && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setAiResult("")}>
                    <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#0F0F0F] border border-[#D1795F]/30 rounded-3xl p-5 max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-4 h-4 text-[#D1795F]" />
                            <h3 className="font-heading font-bold">نتيجة الذكاء</h3>
                        </div>
                        <div className="bg-black/40 rounded-xl p-4 text-sm text-white/90 whitespace-pre-wrap leading-relaxed font-body">{aiResult}</div>
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => setAiResult("")} className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2.5 text-sm">إغلاق</button>
                            <button onClick={applyAi} className="flex-1 bg-[#D1795F] text-white font-heading font-bold rounded-xl py-2.5 text-sm">طبّق →</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
