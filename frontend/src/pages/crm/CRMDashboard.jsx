import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import {
    DollarSign, Target, TrendingUp, Users, ArrowUpRight,
    Trophy, X as XIcon, Zap, ArrowLeft, Activity as ActivityIcon,
} from "lucide-react";

function StatCard({ icon: Icon, label, value, sublabel, tone = "default" }) {
    const tones = {
        default: "bg-white/5 border-white/10",
        accent: "bg-[#E3FF00]/10 border-[#E3FF00]/30",
        success: "bg-emerald-500/10 border-emerald-500/20",
    };
    return (
        <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
            <div className="flex items-center justify-between mb-2">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tone === 'accent' ? 'bg-[#E3FF00] text-black' : tone === 'success' ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white'}`}>
                    <Icon className="w-4.5 h-4.5" />
                </div>
            </div>
            <div className="text-2xl font-black font-heading text-white">{value}</div>
            <div className="text-xs text-white/60 font-body mt-1">{label}</div>
            {sublabel && <div className="text-[10px] text-white/40 font-body mt-1">{sublabel}</div>}
        </div>
    );
}

export default function CRMDashboard() {
    const [stats, setStats] = useState(null);
    const [recent, setRecent] = useState([]);
    const [loading, setLoading] = useState(true);
    const nav = useNavigate();

    useEffect(() => {
        Promise.all([
            api.get("/crm/stats").catch(() => ({ data: null })),
            api.get("/crm/activities?limit=8").catch(() => ({ data: [] })),
        ])
        .then(([s, a]) => {
            setStats(s.data);
            setRecent(a.data);
            setLoading(false);
        })
        .catch(() => { setLoading(false); nav("/auth"); });
    }, [nav]);

    if (loading) return <div className="p-8 text-white/50 text-center">جارٍ التحميل...</div>;
    if (!stats) return <div className="p-8 text-white/50 text-center">تعذّر تحميل الإحصاءات</div>;

    const empty = stats.clients_total === 0;

    return (
        <div data-testid="crm-dashboard" className="p-4 space-y-6">
            {empty && (
                <div className="rounded-2xl bg-gradient-to-br from-[#E3FF00]/10 to-transparent border border-[#E3FF00]/30 p-6">
                    <div className="flex items-start gap-3 mb-3">
                        <Zap className="w-6 h-6 text-[#E3FF00] flex-shrink-0 mt-0.5" fill="#E3FF00" />
                        <div>
                            <h3 className="font-heading font-bold text-lg">مرحباً في CRM خاصتك</h3>
                            <p className="text-sm text-white/70 mt-1 font-body leading-relaxed">
                                أضف أول عميل لتبدأ تتبّع علاقاتك التجارية وصفقاتك في مكان واحد.
                            </p>
                        </div>
                    </div>
                    <button
                        data-testid="dashboard-add-first-client"
                        onClick={() => nav("/crm/clients?new=1")}
                        className="w-full bg-[#E3FF00] text-black font-heading font-bold rounded-xl py-3 text-sm active:scale-95 transition"
                    >
                        أضف أول عميل →
                    </button>
                </div>
            )}

            {/* Top KPIs */}
            <div className="grid grid-cols-2 gap-3">
                <StatCard
                    icon={DollarSign}
                    label="قيمة Pipeline"
                    value={`$${stats.pipeline_value.toLocaleString()}`}
                    sublabel={`مرجح: $${stats.weighted_pipeline.toLocaleString()}`}
                    tone="accent"
                />
                <StatCard
                    icon={Trophy}
                    label="الإيرادات"
                    value={`$${stats.won_value.toLocaleString()}`}
                    sublabel={`${stats.deals_won} صفقة فازت`}
                    tone="success"
                />
                <StatCard
                    icon={Users}
                    label="العملاء"
                    value={stats.clients_total}
                    sublabel={`${stats.clients_active} نشط`}
                />
                <StatCard
                    icon={TrendingUp}
                    label="معدل الفوز"
                    value={`${stats.win_rate}%`}
                    sublabel={`متوسط الصفقة $${stats.avg_deal_size.toLocaleString()}`}
                />
            </div>

            {/* Pipeline snapshot */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-heading font-bold text-base">الصفقات حسب المرحلة</h3>
                    <button data-testid="open-kanban" onClick={() => nav("/crm/deals")} className="text-xs text-[#E3FF00] font-body flex items-center gap-1">
                        أفتح الـ Kanban <ArrowLeft className="w-3 h-3" />
                    </button>
                </div>
                <div className="space-y-2">
                    {stats.by_stage.map((s) => (
                        <div key={s.key} className="bg-white/5 border border-white/10 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                    <span className="text-sm font-heading font-semibold text-white">{s.name}</span>
                                    <span className="text-[10px] text-white/40">({s.probability}%)</span>
                                </div>
                                <div className="text-xs text-white/60 font-body">
                                    {s.count} • <span className="text-white">${s.value.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                                <div
                                    className="h-full transition-all"
                                    style={{ backgroundColor: s.color, width: `${Math.min(100, s.count * 10)}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Activities */}
            <div className="space-y-3">
                <h3 className="font-heading font-bold text-base flex items-center gap-2">
                    <ActivityIcon className="w-4 h-4 text-[#E3FF00]" />
                    آخر الأنشطة
                </h3>
                {recent.length === 0 && (
                    <div className="text-center py-8 text-white/40 text-sm">لا يوجد نشاط بعد</div>
                )}
                <div className="space-y-2">
                    {recent.map((a) => (
                        <div key={a.id} className="bg-white/5 border border-white/10 rounded-xl p-3 text-sm">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                    <p className="text-white font-heading font-semibold">{a.title}</p>
                                    {a.description && <p className="text-white/60 text-xs mt-1 font-body">{a.description}</p>}
                                    <div className="flex items-center gap-2 mt-2 text-[10px] text-white/40">
                                        {a.client_name && <span>👤 {a.client_name}</span>}
                                        {a.deal_title && <span>💼 {a.deal_title}</span>}
                                        <span>🕐 {new Date(a.created_at).toLocaleDateString('ar')}</span>
                                    </div>
                                </div>
                                <div className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">{a.type}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
