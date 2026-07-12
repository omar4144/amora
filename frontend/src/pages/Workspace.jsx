import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
    Users, Briefcase, Video, CheckSquare, ShieldAlert,
    AlertCircle, Clock, Rocket, TrendingUp,
    Plus, ArrowLeft, Sparkles, Home, Calendar as CalIcon,
    RefreshCw, Wand2, Wallet,
} from "lucide-react";
import { toast } from "sonner";

function Kpi({ icon: Icon, label, value, tone, onClick }) {
    return (
        <button onClick={onClick} className={`text-start bg-white/5 border border-white/10 rounded-2xl p-3.5 hover:border-[#D1795F]/40 transition group`}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: `${tone}20`, color: tone }}>
                <Icon className="w-4 h-4" />
            </div>
            <div className="text-xl font-black font-heading text-white">{value}</div>
            <div className="text-[10px] text-white/60 font-body mt-0.5">{label}</div>
        </button>
    );
}

function EngineCard({ icon: Icon, title, subtitle, to, tone }) {
    const nav = useNavigate();
    return (
        <button onClick={() => nav(to)} className="text-start bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-4 hover:border-[#D1795F]/40 transition flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: tone }}>
                <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="font-heading font-bold text-white text-sm">{title}</div>
                <div className="text-[10px] text-white/50 font-body">{subtitle}</div>
            </div>
            <ArrowLeft className="w-4 h-4 text-white/40 group-hover:text-[#D1795F] group-hover:-translate-x-1 transition" />
        </button>
    );
}

export default function Workspace() {
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [brief, setBrief] = useState(null);
    const [briefLoading, setBriefLoading] = useState(false);
    const [billing, setBilling] = useState(null);
    const nav = useNavigate();

    useEffect(() => {
        api.get("/workspace/today").then((r) => { setData(r.data); setLoading(false); })
            .catch(() => { setLoading(false); nav("/auth"); });
        api.get("/billing/me").then((r) => setBilling(r.data)).catch(() => {});
    }, [nav]);

    const loadBrief = async (force = false) => {
        setBriefLoading(true);
        try {
            const r = await api.post(`/workspace/morning-brief${force ? "?force=true" : ""}`);
            setBrief(r.data);
            if (force) toast.success("تم تحديث موجز اليوم");
        } catch (e) {
            toast.error("تعذّر تحضير موجز اليوم");
        } finally {
            setBriefLoading(false);
        }
    };

    useEffect(() => {
        if (data && user) loadBrief(false);
    }, [data, user]);

    if (loading || !data) return <div className="p-8 text-white/50 text-center">جارٍ التحميل...</div>;

    const greet = () => {
        const h = new Date().getHours();
        if (h < 12) return "صباح الخير";
        if (h < 18) return "مساء الخير";
        return "مساء الخير";
    };

    return (
        <div data-testid="workspace" className="pb-24 min-h-[100dvh]">
            {/* Hero header */}
            <div className="px-4 pt-6 pb-4 bg-gradient-to-br from-[#D1795F]/10 via-transparent to-transparent">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-11 h-11 rounded-xl bg-[#D1795F] flex items-center justify-center">
                        <Home className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                        <h1 className="font-heading font-black text-xl text-white">{greet()}، {user?.name}</h1>
                        <p className="text-xs text-white/60 font-body">مركز عملك الموحّد</p>
                    </div>
                    {billing && (
                        <button
                            data-testid="credits-chip"
                            onClick={() => nav("/billing")}
                            className="bg-white/5 border border-white/10 hover:border-[#D1795F]/40 rounded-full px-3 py-1.5 flex items-center gap-1.5 transition"
                            title={`خطة: ${billing.plan.name}`}
                        >
                            <Wallet className="w-3.5 h-3.5 text-[#D1795F]" />
                            <span className="text-[10px] text-white font-heading font-bold">
                                {billing.credits_remaining}<span className="text-white/50">/{billing.credits_total}</span>
                            </span>
                        </button>
                    )}
                </div>
            </div>

            <div className="p-4 space-y-6">
                {/* Morning Brief — AI daily kickoff */}
                <div data-testid="morning-brief-card" className="rounded-2xl bg-gradient-to-br from-[#57769D]/15 via-[#D1795F]/10 to-transparent border border-[#57769D]/30 p-5 relative overflow-hidden">
                    <div className="absolute -top-8 -left-8 w-32 h-32 bg-[#D1795F]/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="flex items-start justify-between gap-3 mb-3 relative">
                        <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#D1795F] to-[#57769D] flex items-center justify-center">
                                <Wand2 className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <h3 className="font-heading font-black text-base text-white">موجز اليوم</h3>
                                <p className="text-[10px] text-white/50 font-body">مساعدك الشخصي الذكي</p>
                            </div>
                        </div>
                        <button
                            data-testid="morning-brief-refresh"
                            onClick={() => loadBrief(true)}
                            disabled={briefLoading}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition disabled:opacity-50"
                            title="تحديث"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 text-white/70 ${briefLoading ? "animate-spin" : ""}`} />
                        </button>
                    </div>

                    {briefLoading && !brief && (
                        <div className="flex items-center gap-2 text-white/50 text-sm py-2">
                            <Sparkles className="w-4 h-4 text-[#D1795F] animate-pulse" />
                            جارٍ تحضير موجز يومك...
                        </div>
                    )}

                    {brief && (
                        <>
                            <p data-testid="morning-brief-summary" className="text-sm text-white/90 leading-relaxed font-body mb-4 relative">
                                {brief.summary}
                            </p>
                            {brief.focus?.length > 0 && (
                                <div className="space-y-2 relative">
                                    <div className="text-[10px] text-white/50 font-heading font-bold mb-1">أولويات اليوم</div>
                                    {brief.focus.map((f, i) => {
                                        const engineColors = { crm: "#D1795F", tasks: "#C3E0A5", content: "#57769D" };
                                        const engineIcons = { crm: Briefcase, tasks: CheckSquare, content: Video };
                                        const engineRoutes = {
                                            crm: f.ref_id ? `/crm/deals/${f.ref_id}` : "/crm",
                                            tasks: f.ref_id ? `/tasks/task/${f.ref_id}` : "/tasks",
                                            content: f.ref_id ? `/content/item/${f.ref_id}` : "/content",
                                        };
                                        const tone = engineColors[f.engine] || "#D1795F";
                                        const Icon = engineIcons[f.engine] || Sparkles;
                                        const to = engineRoutes[f.engine] || "/workspace";
                                        return (
                                            <button
                                                key={i}
                                                data-testid={`morning-focus-${i}`}
                                                onClick={() => nav(to)}
                                                className="w-full text-start bg-black/40 hover:bg-black/60 border border-white/10 rounded-xl p-3 flex items-start gap-3 transition group"
                                            >
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${tone}25`, color: tone }}>
                                                    <Icon className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-heading font-semibold text-white line-clamp-1">{f.title}</div>
                                                    {f.why && <div className="text-[10px] text-white/50 mt-0.5 line-clamp-2 font-body">{f.why}</div>}
                                                </div>
                                                <ArrowLeft className="w-4 h-4 text-white/40 group-hover:text-[#D1795F] group-hover:-translate-x-1 transition flex-shrink-0 mt-1" />
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Onboarding */}
                {data.is_new_user && (
                    <div className="rounded-2xl bg-gradient-to-br from-[#D1795F]/20 to-transparent border border-[#D1795F]/40 p-5">
                        <div className="flex items-start gap-3 mb-3">
                            <Sparkles className="w-6 h-6 text-[#D1795F] flex-shrink-0 mt-0.5" fill="#D1795F" />
                            <div>
                                <h3 className="font-heading font-bold text-lg">أهلاً بك في Amora</h3>
                                <p className="text-sm text-white/70 mt-1 font-body leading-relaxed">
                                    ابدأ رحلتك في 3 خطوات بسيطة — واحدة كل مرة.
                                </p>
                            </div>
                        </div>
                        <div className="space-y-2 mt-4">
                            <button onClick={() => nav("/crm/clients?new=1")} data-testid="onboard-step-1" className="w-full text-start bg-black/40 hover:bg-black/60 border border-white/10 rounded-xl p-3 flex items-center gap-3 transition">
                                <div className="w-8 h-8 rounded-full bg-[#D1795F] text-white flex items-center justify-center text-sm font-heading font-black">1</div>
                                <div className="flex-1"><div className="text-sm font-heading font-semibold text-white">أضف أول عميل</div><div className="text-[10px] text-white/50">في CRM</div></div>
                                <ArrowLeft className="w-4 h-4 text-white/40" />
                            </button>
                            <button onClick={() => nav("/tasks/boards?new=1")} data-testid="onboard-step-2" className="w-full text-start bg-black/40 hover:bg-black/60 border border-white/10 rounded-xl p-3 flex items-center gap-3 transition">
                                <div className="w-8 h-8 rounded-full bg-white/10 text-white/60 flex items-center justify-center text-sm font-heading font-black">2</div>
                                <div className="flex-1"><div className="text-sm font-heading font-semibold text-white">أنشئ أول لوحة مهام</div><div className="text-[10px] text-white/50">في Tasks</div></div>
                                <ArrowLeft className="w-4 h-4 text-white/40" />
                            </button>
                            <button onClick={() => nav("/content/ai")} data-testid="onboard-step-3" className="w-full text-start bg-black/40 hover:bg-black/60 border border-white/10 rounded-xl p-3 flex items-center gap-3 transition">
                                <div className="w-8 h-8 rounded-full bg-white/10 text-white/60 flex items-center justify-center text-sm font-heading font-black">3</div>
                                <div className="flex-1"><div className="text-sm font-heading font-semibold text-white">ولّد أفكار محتوى بالذكاء</div><div className="text-[10px] text-white/50">في Content OS</div></div>
                                <ArrowLeft className="w-4 h-4 text-white/40" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-2">
                    <Kpi icon={Users} label="عملاء" value={data.quick_stats.clients} tone="#D1795F" onClick={() => nav("/crm/clients")} />
                    <Kpi icon={Briefcase} label="صفقات" value={data.quick_stats.active_deals} tone="#57769D" onClick={() => nav("/crm/deals")} />
                    <Kpi icon={CheckSquare} label="مهام" value={data.quick_stats.tasks_active} tone="#C3E0A5" onClick={() => nav("/tasks")} />
                    <Kpi icon={Video} label="محتوى" value={data.quick_stats.content_pending} tone="#F59E0B" onClick={() => nav("/content")} />
                </div>

                {/* Today's Focus */}
                {(data.overdue_tasks.length + data.due_today_tasks.length + data.upcoming_content.length + data.stale_deals.length) > 0 && (
                    <div>
                        <h3 className="font-heading font-bold text-base mb-3 flex items-center gap-2">
                            <CalIcon className="w-4 h-4 text-[#D1795F]" />
                            تركيز اليوم
                        </h3>
                        <div className="space-y-2">
                            {data.overdue_tasks.slice(0, 3).map((t) => (
                                <div key={t.id} onClick={() => nav(`/tasks/task/${t.id}`)} className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-red-500/20 transition">
                                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm text-white font-heading font-semibold truncate">{t.title}</div>
                                        <div className="text-[10px] text-red-400">متأخرة • {new Date(t.due_date).toLocaleDateString('ar')}</div>
                                    </div>
                                </div>
                            ))}
                            {data.due_today_tasks.slice(0, 3).map((t) => (
                                <div key={t.id} onClick={() => nav(`/tasks/task/${t.id}`)} className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-amber-500/20 transition">
                                    <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm text-white font-heading font-semibold truncate">{t.title}</div>
                                        <div className="text-[10px] text-amber-400">للأخير اليوم</div>
                                    </div>
                                </div>
                            ))}
                            {data.upcoming_content.slice(0, 3).map((c) => (
                                <div key={c.id} onClick={() => nav(`/content/item/${c.id}`)} className="bg-[#57769D]/10 border border-[#57769D]/30 rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-[#57769D]/20 transition">
                                    <Rocket className="w-4 h-4 text-[#57769D] flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm text-white font-heading font-semibold truncate">{c.title}</div>
                                        <div className="text-[10px] text-[#57769D]">محتوى قادم • {c.platform}</div>
                                    </div>
                                </div>
                            ))}
                            {data.stale_deals.slice(0, 3).map((d) => (
                                <div key={d.id} onClick={() => nav(`/crm/deals/${d.id}`)} className="bg-[#D1795F]/10 border border-[#D1795F]/30 rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-[#D1795F]/20 transition">
                                    <TrendingUp className="w-4 h-4 text-[#D1795F] flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm text-white font-heading font-semibold truncate">{d.title}</div>
                                        <div className="text-[10px] text-[#D1795F]">تحتاج متابعة • ${d.value.toLocaleString()} • {d.client?.name}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Engines Quick Access */}
                <div>
                    <h3 className="font-heading font-bold text-base mb-3">أدوات عملك</h3>
                    <div className="grid grid-cols-1 gap-2">
                        <EngineCard icon={Briefcase} title="CRM — العملاء والصفقات" subtitle="أدر علاقاتك التجارية" to="/crm" tone="#D1795F" />
                        <EngineCard icon={Video} title="Content OS — نظام تشغيل المحتوى" subtitle="خطط، اكتب، انشر بذكاء" to="/content" tone="#57769D" />
                        <EngineCard icon={CheckSquare} title="Tasks — المهام والمشاريع" subtitle="نظّم فريقك بسهولة" to="/tasks" tone="#C3E0A5" />
                        {user?.role === "super_admin" && (
                            <EngineCard icon={ShieldAlert} title="لوحة المدير" subtitle="إدارة المنصة والمستخدمين" to="/admin" tone="#EF4444" />
                        )}
                    </div>
                </div>
            </div>

            {/* Floating Quick Add */}
            <button
                data-testid="quick-add-fab"
                onClick={() => setShowQuickAdd(true)}
                className="fixed bottom-24 left-4 z-40 w-14 h-14 rounded-full bg-[#D1795F] shadow-2xl shadow-[#D1795F]/40 flex items-center justify-center hover:bg-[#B86648] active:scale-95 transition"
            >
                <Plus className="w-6 h-6 text-white" />
            </button>

            {/* Quick Add Sheet */}
            {showQuickAdd && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center" onClick={() => setShowQuickAdd(false)}>
                    <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#0F0F0F] border-t border-white/10 rounded-t-3xl p-5">
                        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4" />
                        <h3 className="font-heading font-bold text-lg mb-4">ماذا تريد أن تُنشئ؟</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { icon: Users, label: "عميل", to: "/crm/clients?new=1", color: "#D1795F" },
                                { icon: Briefcase, label: "صفقة", to: "/crm/deals", color: "#57769D" },
                                { icon: Video, label: "محتوى", to: "/content/kanban?new=1", color: "#F59E0B" },
                                { icon: CheckSquare, label: "مهمة", to: "/tasks/boards", color: "#C3E0A5" },
                            ].map((opt) => (
                                <button
                                    key={opt.label}
                                    data-testid={`quick-add-${opt.label}`}
                                    onClick={() => { setShowQuickAdd(false); nav(opt.to); }}
                                    className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-2 transition"
                                >
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: opt.color }}>
                                        <opt.icon className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="text-sm font-heading font-bold text-white">{opt.label}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
