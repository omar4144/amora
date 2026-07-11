import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { ArrowRight, Trash2, Check, X, Plus } from "lucide-react";

export default function TaskDetail() {
    const { id } = useParams();
    const nav = useNavigate();
    const [task, setTask] = useState(null);
    const [meta, setMeta] = useState(null);
    const [newCheck, setNewCheck] = useState("");

    const load = async () => {
        try {
            const [m, t] = await Promise.all([api.get("/tasks/meta"), api.get(`/tasks/${id}`)]);
            setMeta(m.data);
            setTask(t.data);
        } catch {
            toast.error("تعذّر التحميل");
            nav("/tasks");
        }
    };
    useEffect(() => { load(); }, [id]);

    const save = async (patch) => {
        try {
            const r = await api.put(`/tasks/${id}`, patch);
            setTask(r.data);
            toast.success("تم الحفظ");
        } catch { toast.error("خطأ"); }
    };

    const moveStatus = async (status) => {
        const r = await api.put(`/tasks/${id}/status`, { status });
        setTask(r.data);
    };

    const toggleCheck = async (index, done) => {
        const r = await api.put(`/tasks/${id}/checklist`, { index, done });
        setTask(r.data);
    };

    const addCheck = () => {
        if (!newCheck.trim()) return;
        const newList = [...(task.checklist || []), { text: newCheck.trim(), done: false }];
        save({ checklist: newList });
        setNewCheck("");
    };

    const removeCheck = (i) => {
        const newList = (task.checklist || []).filter((_, x) => x !== i);
        save({ checklist: newList });
    };

    const remove = async () => {
        if (!window.confirm(`حذف المهمة "${task.title}"؟`)) return;
        await api.delete(`/tasks/${id}`);
        toast.success("محذوفة");
        nav(-1);
    };

    if (!task || !meta) return <div className="p-8 text-white/50 text-center">جارٍ التحميل...</div>;

    const currentStatus = meta.statuses.find((s) => s.key === task.status);

    return (
        <div data-testid="task-detail" className="p-4 space-y-5">
            <button onClick={() => nav(-1)} className="text-xs text-white/60 flex items-center gap-1">
                <ArrowRight className="w-3 h-3" /> رجوع
            </button>

            {/* Header */}
            <div className="bg-gradient-to-br from-[#141414] to-[#0A0A0A] border border-white/10 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <input
                        data-testid="detail-title"
                        value={task.title}
                        onChange={(e) => setTask({ ...task, title: e.target.value })}
                        onBlur={() => save({ title: task.title })}
                        className="flex-1 bg-transparent text-white font-heading font-black text-lg outline-none border-b border-transparent focus:border-[#D1795F]/50 pb-1"
                    />
                    <button onClick={remove} className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center">
                        <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                </div>
                <textarea placeholder="وصف..." value={task.description || ""} onChange={(e) => setTask({ ...task, description: e.target.value })} onBlur={() => save({ description: task.description })} rows={3} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/80 outline-none resize-none focus:border-[#D1795F]" />
            </div>

            {/* Status + Priority */}
            <div>
                <p className="text-xs text-white/50 font-body mb-2">الحالة</p>
                <div className="grid grid-cols-5 gap-1.5">
                    {meta.statuses.map((s) => (
                        <button key={s.key} data-testid={`ts-${s.key}`} onClick={() => moveStatus(s.key)} className={`text-[10px] font-heading font-semibold px-2 py-2 rounded-lg transition ${task.status === s.key ? "text-black" : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"}`} style={{ backgroundColor: task.status === s.key ? s.color : undefined }}>{s.name}</button>
                    ))}
                </div>
            </div>
            <div>
                <p className="text-xs text-white/50 font-body mb-2">الأولوية</p>
                <div className="grid grid-cols-4 gap-1.5">
                    {meta.priorities.map((p) => (
                        <button key={p.key} onClick={() => save({ priority: p.key })} className={`text-[10px] font-heading font-semibold px-2 py-2 rounded-lg transition ${task.priority === p.key ? "text-black" : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"}`} style={{ backgroundColor: task.priority === p.key ? p.color : undefined }}>{p.name}</button>
                    ))}
                </div>
            </div>

            {/* Due date */}
            <div>
                <label className="text-xs text-white/50 font-body block mb-1">تاريخ الاستحقاق</label>
                <input type="date" value={task.due_date?.slice(0,10) || ""} onChange={(e) => save({ due_date: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none" />
            </div>

            {/* Checklist */}
            <div>
                <p className="text-xs text-white/50 font-body mb-2">قائمة المراجعة</p>
                <div className="space-y-2">
                    {(task.checklist || []).map((item, i) => (
                        <div key={i} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-3 group">
                            <button onClick={() => toggleCheck(i, !item.done)} className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${item.done ? "bg-[#D1795F] border-[#D1795F]" : "border-white/30 hover:border-[#D1795F]/50"}`}>
                                {item.done && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                            </button>
                            <span className={`flex-1 text-sm ${item.done ? "text-white/40 line-through" : "text-white"}`}>{item.text}</span>
                            <button onClick={() => removeCheck(i)} className="opacity-0 group-hover:opacity-100 text-red-400 transition"><X className="w-3.5 h-3.5" /></button>
                        </div>
                    ))}
                    <div className="flex gap-2">
                        <input placeholder="أضف عنصر..." value={newCheck} onChange={(e) => setNewCheck(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCheck())} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-[#D1795F]" />
                        <button onClick={addCheck} className="bg-[#D1795F] text-white rounded-xl px-4 py-2.5 font-bold"><Plus className="w-4 h-4" /></button>
                    </div>
                </div>
            </div>
        </div>
    );
}
