import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Lightbulb, PenSquare, Eye, Check, Calendar, Rocket, Archive, ArrowLeft, Sparkles, Plus, TrendingUp } from "lucide-react";

const STATUS_ICONS = { idea: Lightbulb, draft: PenSquare, review: Eye, approved: Check, scheduled: Calendar, published: Rocket, archived: Archive };

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

export default function ContentDashboard() {
    const [stats, setStats] = useState(null);
    const [upcoming, setUpcoming] = useState([]);
    const [loading, setLoading] = useState(true);
    const nav = useNavigate();

    useEffect(() => {
        Promise.all([
            api.get("/content/stats").catch(() => ({ data: null })),
            api.get("/content/items?status=scheduled&limit=5").catch(() => ({ data: [] })),
        ]).then(([s, u]) => {
            setStats(s.data);
            setUpcoming(u.data);
            setLoading(false);
        }).catch(() => { setLoading(false); nav("/auth"); });
    }, [nav]);

    if (loading) return <div className="p-8 text-white/50 text-center">جارٍ التحميل...</div>;
    if (!stats) return <div className="p-8 text-white/50 text-center">تعذّر تحميل الإحصاءات</div>;

    return (
        <div data-testid="content-dashboard" className="p-4 space-y-6">
            {stats.total === 0 && (
                <div className="rounded-2xl bg-gradient-to-br from-[#E3FF00]/10 to-transparent border border-[#E3FF00]/30 p-6">
                    <div className="flex items-start gap-3 mb-3">
                        <Sparkles className="w-6 h-6 text-[#E3FF00] flex-shrink-0 mt-0.5" fill="#E3FF00" />
                        <div>
                            <h3 className="font-heading font-bold text-lg">أهلاً في Content OS</h3>
                            <p className="text-sm text-white/70 mt-1 font-body leading-relaxed">
                                ورشة محتواك المتكاملة — من الفكرة إلى النشر. دع الذكاء يساعدك في كل خطوة.
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                        <button onClick={() => nav("/content/ai")} data-testid="dash-quick-ai" className="bg-[#E3FF00] text-black font-heading font-bold rounded-xl py-3 text-sm active:scale-95">
                            ✨ ولّد أفكاراً
                        </button>
                        <button onClick={() => nav("/content/kanban?new=1")} data-testid="dash-quick-new" className="bg-white/5 border border-white/10 text-white font-heading font-bold rounded-xl py-3 text-sm">
                            + محتوى يدوياً
                        </button>
                    </div>
                </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3">
                <StatCard icon={Lightbulb} label="أفكار" value={stats.ideas} color="#94A3B8" />
                <StatCard icon={PenSquare} label="مسودّات" value={stats.drafts} color="#3B82F6" />
                <StatCard icon={Calendar} label="مجدولة" value={stats.scheduled} color="#06B6D4" />
                <StatCard icon={Rocket} label="نشر هذا الشهر" value={stats.published_this_month} color="#10B981" />
            </div>

            {/* Upcoming scheduled */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-heading font-bold text-base">منشورات قادمة</h3>
                    <button onClick={() => nav("/content/calendar")} className="text-xs text-[#E3FF00] font-body flex items-center gap-1">
                        التقويم <ArrowLeft className="w-3 h-3" />
                    </button>
                </div>
                {upcoming.length === 0 && (
                    <div className="text-center py-8 text-white/40 text-sm">لا يوجد محتوى مجدول بعد</div>
                )}
                {upcoming.map((it) => (
                    <div key={it.id} onClick={() => nav(`/content/item/${it.id}`)} className="bg-white/5 border border-white/10 rounded-xl p-3 hover:border-[#E3FF00]/40 transition cursor-pointer">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-heading font-semibold text-white truncate">{it.title}</h4>
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-white/50">
                                    <span>{it.platform}</span>
                                    <span>•</span>
                                    <span>{it.format}</span>
                                    {it.scheduled_at && <><span>•</span><span>{new Date(it.scheduled_at).toLocaleDateString('ar')}</span></>}
                                </div>
                            </div>
                            <Calendar className="w-4 h-4 text-[#06B6D4]" />
                        </div>
                    </div>
                ))}
            </div>

            {/* By platform */}
            <div>
                <h3 className="font-heading font-bold text-base mb-3">حسب المنصة</h3>
                <div className="grid grid-cols-4 gap-2">
                    {stats.by_platform.filter(p => p.count > 0).map((p) => (
                        <div key={p.key} className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                            <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{ backgroundColor: p.color }} />
                            <div className="text-lg font-black font-heading text-white">{p.count}</div>
                            <div className="text-[10px] text-white/50 font-body">{p.name}</div>
                        </div>
                    ))}
                    {stats.by_platform.every(p => p.count === 0) && (
                        <div className="col-span-4 text-center py-4 text-white/30 text-xs">لا يوجد محتوى بعد</div>
                    )}
                </div>
            </div>
        </div>
    );
}
