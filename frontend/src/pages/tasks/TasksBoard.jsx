import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, X, ArrowRight, ArrowLeftRight } from "lucide-react";

function TaskForm({ meta, boardId, initial, onSubmit, onClose }) {
    const [form, setForm] = useState(initial || {
        title: "", description: "", status: "todo", priority: "medium", due_date: "", checklist: [],
    });
    const [busy, setBusy] = useState(false);
    const [newCheck, setNewCheck] = useState("");

    const submit = async (e) => {
        e.preventDefault();
        if (!form.title.trim()) return toast.error("العنوان مطلوب");
        setBusy(true);
        try { await onSubmit({ ...form, board_id: boardId }); onClose(); }
        catch { toast.error("خطأ"); }
        finally { setBusy(false); }
    };

    const addCheck = () => {
        if (!newCheck.trim()) return;
        setForm({ ...form, checklist: [...(form.checklist || []), { text: newCheck.trim(), done: false }] });
        setNewCheck("");
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
            <form data-testid="task-form" onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#0F0F0F] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-heading font-bold text-lg">مهمة جديدة</h3>
                    <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-3">
                    <input data-testid="task-title" placeholder="العنوان *" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#E3FF00] outline-none" />
                    <textarea placeholder="وصف" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} rows={2} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#E3FF00] outline-none resize-none" />
                    <div className="grid grid-cols-2 gap-3">
                        <select value={form.status} onChange={(e) => setForm({...form, status: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white outline-none">
                            {meta.statuses.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
                        </select>
                        <select value={form.priority} onChange={(e) => setForm({...form, priority: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white outline-none">
                            {meta.priorities.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                        </select>
                    </div>
                    <input type="date" value={form.due_date?.slice(0,10) || ""} onChange={(e) => setForm({...form, due_date: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none" />
                    {/* Checklist */}
                    <div className="space-y-2">
                        <label className="text-xs text-white/50">قائمة المراجعة</label>
                        {(form.checklist || []).map((item, i) => (
                            <div key={i} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                                <span className="flex-1 text-sm text-white">{item.text}</span>
                                <button type="button" onClick={() => setForm({ ...form, checklist: form.checklist.filter((_, x) => x !== i) })} className="text-red-400">×</button>
                            </div>
                        ))}
                        <div className="flex gap-2">
                            <input placeholder="أضف عنصر مراجعة..." value={newCheck} onChange={(e) => setNewCheck(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCheck())} className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#E3FF00]" />
                            <button type="button" onClick={addCheck} className="bg-white/10 rounded-lg px-3 text-xs">+</button>
                        </div>
                    </div>
                </div>
                <button data-testid="task-save" type="submit" disabled={busy} className="w-full bg-[#E3FF00] text-black font-heading font-bold rounded-xl py-3 mt-5 active:scale-95 disabled:opacity-60">{busy ? "..." : "حفظ"}</button>
            </form>
        </div>
    );
}

function TaskCard({ task, statuses, priorities, onMove, onOpen }) {
    const [showMenu, setShowMenu] = useState(false);
    const prio = priorities.find((p) => p.key === task.priority);
    const checklistDone = (task.checklist || []).filter(c => c.done).length;
    const checklistTotal = (task.checklist || []).length;
    return (
        <div data-testid={`task-card-${task.id}`} className="bg-black border border-white/10 rounded-xl p-3 hover:border-[#E3FF00]/40 transition cursor-pointer">
            <div onClick={onOpen}>
                <div className="flex items-start gap-2 mb-2">
                    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: prio?.color }} />
                    <h4 className="text-sm font-heading font-semibold text-white flex-1 line-clamp-2">{task.title}</h4>
                </div>
                {task.assignee && (
                    <div className="flex items-center gap-1 mb-2">
                        {task.assignee.avatar_url ? (
                            <img src={task.assignee.avatar_url} className="w-5 h-5 rounded-full" alt="" />
                        ) : (
                            <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px]">{task.assignee.name?.[0]}</div>
                        )}
                        <span className="text-[10px] text-white/60">@{task.assignee.username}</span>
                    </div>
                )}
                <div className="flex items-center gap-2 flex-wrap text-[10px] text-white/50">
                    {task.due_date && <span className="px-1.5 py-0.5 rounded bg-white/5">📅 {new Date(task.due_date).toLocaleDateString('ar')}</span>}
                    {checklistTotal > 0 && <span className="px-1.5 py-0.5 rounded bg-white/5">✓ {checklistDone}/{checklistTotal}</span>}
                </div>
            </div>
            <div className="mt-2 pt-2 border-t border-white/5">
                <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} className="w-full text-[10px] text-white/60 hover:text-[#E3FF00] flex items-center justify-center gap-1 py-1">
                    <ArrowLeftRight className="w-3 h-3" /> نقل
                </button>
            </div>
            {showMenu && (
                <div className="mt-2 space-y-1">
                    {statuses.filter((s) => s.key !== task.status).map((s) => (
                        <button key={s.key} onClick={(e) => { e.stopPropagation(); onMove(task, s.key); setShowMenu(false); }} className="w-full text-start text-xs px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                            {s.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function TasksBoard() {
    const { id } = useParams();
    const nav = useNavigate();
    const [board, setBoard] = useState(null);
    const [columns, setColumns] = useState({});
    const [meta, setMeta] = useState(null);
    const [showForm, setShowForm] = useState(false);

    const load = async () => {
        try {
            const [m, k] = await Promise.all([api.get("/tasks/meta"), api.get(`/tasks/board/${id}/kanban`)]);
            setMeta(m.data);
            setBoard(k.data.board);
            setColumns(k.data.columns);
        } catch { nav("/tasks/boards"); }
    };
    useEffect(() => { load(); }, [id]);

    const create = async (form) => {
        await api.post("/tasks", form);
        toast.success("تمت الإضافة");
        await load();
    };

    const move = async (task, status) => {
        try {
            await api.put(`/tasks/${task.id}/status`, { status });
            toast.success("تم النقل");
            await load();
        } catch { toast.error("خطأ"); }
    };

    if (!board || !meta) return <div className="p-8 text-white/50 text-center">جارٍ التحميل...</div>;

    return (
        <div data-testid="tasks-board" className="pt-4">
            <div className="px-4 mb-3 flex items-center justify-between gap-2">
                <button onClick={() => nav("/tasks/boards")} className="text-xs text-white/60 flex items-center gap-1">
                    <ArrowRight className="w-3 h-3" /> {board.name}
                </button>
                <button data-testid="add-task-btn" onClick={() => setShowForm(true)} className="bg-[#E3FF00] text-black font-heading font-bold rounded-xl px-4 py-2 text-sm flex items-center gap-1 active:scale-95">
                    <Plus className="w-4 h-4" /> مهمة
                </button>
            </div>
            <div className="flex gap-3 px-4 overflow-x-auto scrollbar-thin pb-4" style={{ scrollSnapType: "x mandatory" }}>
                {meta.statuses.map((s) => {
                    const col = columns[s.key] || { tasks: [], count: 0 };
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
                                {col.tasks.length === 0 && <div className="text-center py-6 text-white/30 text-xs">فارغ</div>}
                                {col.tasks.map((t) => (
                                    <TaskCard key={t.id} task={t} statuses={meta.statuses} priorities={meta.priorities} onMove={move} onOpen={() => nav(`/tasks/task/${t.id}`)} />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
            {showForm && meta && <TaskForm meta={meta} boardId={id} onSubmit={create} onClose={() => setShowForm(false)} />}
        </div>
    );
}
