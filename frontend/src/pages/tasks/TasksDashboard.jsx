import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { AlertCircle, Clock, CheckCircle2, TrendingUp, ArrowLeft, Zap, Plus } from "lucide-react";

function StatCard({ icon: Icon, label, value, color = "#E3FF00" }) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2" style={{ backgroundColor: `${color}20`, color }}>
                <Icon className="w-4.5 h-4.5" />
            </div>
            <div className="text-2xl font-black font-heading text-white">{value}</div>
            <div className="text-xs text-white/60 font-body mt-1">{label}</div>
        </div>
    );
}

export default function TasksDashboard() {
    const [stats, setStats] = useState(null);
    const [my, setMy] = useState([]);
    const [loading, setLoading] = useState(true);
    const nav = useNavigate();

    useEffect(() => {
        Promise.all([
            api.get("/tasks/stats").catch(() => ({ data: null })),
            api.get("/tasks/my").catch(() => ({ data: [] })),
        ]).then(([s, m]) => {
            setStats(s.data);
            setMy((m.data || []).slice(0, 5));
            setLoading(false);
        }).catch(() => { setLoading(false); nav("/auth"); });
    }, [nav]);

    if (loading) return <div className="p-8 text-white/50 text-center">جارٍ التحميل...</div>;
    if (!stats) return <div className="p-8 text-white/50 text-center">تعذّر التحميل</div>;

    return (
        <div data-testid="tasks-dashboard" className="p-4 space-y-6">
            {stats.total === 0 && (
                <div className="rounded-2xl bg-gradient-to-br from-[#E3FF00]/10 to-transparent border border-[#E3FF00]/30 p-6">
                    <div className="flex items-start gap-3 mb-3">
                        <Zap className="w-6 h-6 text-[#E3FF00] flex-shrink-0 mt-0.5" fill="#E3FF00" />
                        <div>
                            <h3 className="font-heading font-bold text-lg">مركز إدارة المهام والمشاريع</h3>
                            <p className="text-sm text-white/70 mt-1 font-body leading-relaxed">
                                أنشئ أول لوحة لتبدأ تنظيم مهامك وتتبّع تقدّمك.
                            </p>
                        </div>
                    </div>
                    <button onClick={() => nav("/tasks/boards?new=1")} data-testid="create-first-board" className="w-full bg-[#E3FF00] text-black font-heading font-bold rounded-xl py-3 text-sm active:scale-95">
                        + أنشئ أول لوحة
                    </button>
                </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3">
                <StatCard icon={AlertCircle} label="متأخرة" value={stats.overdue} color="#EF4444" />
                <StatCard icon={Clock} label="للأخير اليوم" value={stats.due_today} color="#F59E0B" />
                <StatCard icon={TrendingUp} label="نشطة" value={stats.active} color="#3B82F6" />
                <StatCard icon={CheckCircle2} label="أدّيت هذا الأسبوع" value={stats.done_this_week} color="#10B981" />
            </div>

            {/* My Tasks */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-heading font-bold text-base">مهامي</h3>
                    <button onClick={() => nav("/tasks/my")} className="text-xs text-[#E3FF00] font-body flex items-center gap-1">
                        الكل <ArrowLeft className="w-3 h-3" />
                    </button>
                </div>
                {my.length === 0 && <div className="text-center py-8 text-white/40 text-sm">لا يوجد مهام بعد</div>}
                {my.map((t) => (
                    <div key={t.id} onClick={() => nav(`/tasks/task/${t.id}`)} className="bg-white/5 border border-white/10 rounded-xl p-3 hover:border-[#E3FF00]/40 transition cursor-pointer">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-heading font-semibold text-white line-clamp-1">{t.title}</h4>
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-white/50">
                                    <span className="px-1.5 py-0.5 rounded bg-white/10">{t.status}</span>
                                    <span>•</span>
                                    <span>{t.priority}</span>
                                    {t.due_date && <><span>•</span><span>{new Date(t.due_date).toLocaleDateString('ar')}</span></>}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* By Priority */}
            <div>
                <h3 className="font-heading font-bold text-base mb-3">حسب الأولوية</h3>
                <div className="grid grid-cols-4 gap-2">
                    {stats.by_priority.map((p) => (
                        <div key={p.key} className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                            <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{ backgroundColor: p.color }} />
                            <div className="text-lg font-black font-heading text-white">{p.count}</div>
                            <div className="text-[10px] text-white/50 font-body">{p.name}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
