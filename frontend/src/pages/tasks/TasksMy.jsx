import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";

export default function TasksMy() {
    const [tasks, setTasks] = useState([]);
    const [filter, setFilter] = useState("all");
    const nav = useNavigate();

    useEffect(() => {
        api.get("/tasks/my").then((r) => setTasks(r.data)).catch(() => nav("/auth"));
    }, [nav]);

    const filtered = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);

    return (
        <div data-testid="tasks-my" className="p-4 space-y-4">
            <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4">
                {["all", "todo", "in_progress", "review", "blocked", "done"].map((s) => (
                    <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-full text-[11px] whitespace-nowrap font-heading font-semibold ${filter === s ? "bg-[#E3FF00] text-black" : "bg-white/5 text-white/60 border border-white/10"}`}>
                        {s === "all" ? "الكل" : s}
                    </button>
                ))}
            </div>
            <div className="space-y-2">
                {filtered.length === 0 && <div className="text-center py-16 text-white/40 text-sm">لا يوجد مهام</div>}
                {filtered.map((t) => (
                    <div key={t.id} data-testid={`my-task-${t.id}`} onClick={() => nav(`/tasks/task/${t.id}`)} className="bg-white/5 border border-white/10 rounded-xl p-3 hover:border-[#E3FF00]/40 transition cursor-pointer">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-heading font-semibold text-white line-clamp-1">{t.title}</h4>
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-white/50">
                                    <span className="px-1.5 py-0.5 rounded bg-white/10">{t.status}</span>
                                    <span>•</span>
                                    <span>{t.priority}</span>
                                    {t.due_date && <><span>•</span><span>📅 {new Date(t.due_date).toLocaleDateString('ar')}</span></>}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
