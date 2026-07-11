import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, X, KanbanSquare, Trash2 } from "lucide-react";

function BoardForm({ initial, onSubmit, onClose }) {
    const [form, setForm] = useState(initial || { name: "", description: "", color: "#D1795F", kind: "personal" });
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
            <form data-testid="board-form" onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#0F0F0F] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-heading font-bold text-lg">{initial ? "تعديل لوحة" : "لوحة جديدة"}</h3>
                    <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-3">
                    <input data-testid="board-name" placeholder="الاسم *" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#D1795F] outline-none" />
                    <textarea placeholder="وصف" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} rows={2} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#D1795F] outline-none resize-none" />
                    <div className="flex gap-2">
                        {["#D1795F","#57769D","#EF4444","#C3E0A5","#8B5CF6","#F59E0B"].map((c) => (
                            <button key={c} type="button" onClick={() => setForm({...form, color: c})} className={`w-8 h-8 rounded-full ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''}`} style={{ backgroundColor: c }} />
                        ))}
                    </div>
                </div>
                <button data-testid="board-save" type="submit" disabled={busy} className="w-full bg-[#D1795F] text-white font-heading font-bold rounded-xl py-3 mt-5 active:scale-95 disabled:opacity-60">
                    {busy ? "..." : "حفظ"}
                </button>
            </form>
        </div>
    );
}

export default function TasksBoards() {
    const [boards, setBoards] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [params, setParams] = useSearchParams();
    const nav = useNavigate();

    const load = () => api.get("/tasks/boards").then((r) => setBoards(r.data)).catch(() => nav("/auth"));
    useEffect(() => { load(); }, []);
    useEffect(() => {
        if (params.get("new") === "1") { setShowForm(true); params.delete("new"); setParams(params); }
    }, [params, setParams]);

    const create = async (form) => {
        await api.post("/tasks/boards", form);
        toast.success("تمت الإضافة");
        await load();
    };

    const remove = async (b, e) => {
        e.stopPropagation();
        if (!window.confirm(`حذف اللوحة "${b.name}"؟ ستُحذف مهامها.`)) return;
        await api.delete(`/tasks/boards/${b.id}`);
        setBoards(boards.filter((x) => x.id !== b.id));
        toast.success("محذوفة");
    };

    return (
        <div data-testid="tasks-boards" className="p-4 space-y-4">
            <div className="flex justify-end">
                <button data-testid="add-board-btn" onClick={() => setShowForm(true)} className="bg-[#D1795F] text-white font-heading font-bold rounded-xl px-4 py-2 text-sm flex items-center gap-1 active:scale-95">
                    <Plus className="w-4 h-4" /> لوحة جديدة
                </button>
            </div>
            <div className="grid grid-cols-1 gap-3">
                {boards.length === 0 && (
                    <div className="text-center py-16 text-white/40 text-sm">لا يوجد لوحات. أنشئ واحدة!</div>
                )}
                {boards.map((b) => (
                    <div key={b.id} data-testid={`board-${b.id}`} onClick={() => nav(`/tasks/board/${b.id}`)} className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:border-[#D1795F]/40 transition cursor-pointer group">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${b.color}20`, color: b.color }}>
                                <KanbanSquare className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="font-heading font-bold text-white truncate">{b.name}</h3>
                                    <button onClick={(e) => remove(b, e)} className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full bg-white/5 hover:bg-red-500/20 flex items-center justify-center transition">
                                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                    </button>
                                </div>
                                {b.description && <p className="text-xs text-white/60 font-body mt-1 line-clamp-1">{b.description}</p>}
                                <div className="flex items-center gap-3 mt-2 text-[11px] text-white/50">
                                    <span>{b.tasks_count} مهمة</span>
                                    <span>•</span>
                                    <span>{b.done_count} مكتملة</span>
                                    {b.kind === "team" && <><span>•</span><span className="text-[#D1795F]">👥 {b.team?.name || "فريق"}</span></>}
                                </div>
                                {b.tasks_count > 0 && (
                                    <div className="mt-2 h-1 bg-black/40 rounded-full overflow-hidden">
                                        <div className="h-full transition-all" style={{ backgroundColor: b.color, width: `${Math.round((b.done_count/b.tasks_count)*100)}%` }} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {showForm && <BoardForm onSubmit={create} onClose={() => setShowForm(false)} />}
        </div>
    );
}
