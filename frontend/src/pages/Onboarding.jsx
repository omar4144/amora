import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { toast } from "sonner";
import {
    Briefcase, Video, CheckSquare, Sparkles,
    ArrowLeft, ArrowRight, Users2, ShoppingBag, MessageCircle, GraduationCap,
    ChevronRight,
} from "lucide-react";

const GOALS = [
    { key: "crm",     icon: Briefcase,   title: "إدارة العملاء والصفقات", desc: "أرغب في تتبع عملائي وإتمام صفقاتي بذكاء" },
    { key: "content", icon: Video,       title: "إنتاج ونشر محتوى إبداعي", desc: "أرغب في التخطيط والنشر عبر منصات التواصل" },
    { key: "tasks",   icon: CheckSquare, title: "تنظيم فريقي ومهامي",       desc: "أرغب في لوحات كانبان ومهام مشتركة" },
    { key: "all",     icon: Sparkles,    title: "كل ما سبق",                desc: "أدير أعمالي بالكامل من مكان واحد" },
];

const INTERESTS = [
    { key: "social",      icon: Users2,        label: "التواصل الاجتماعي" },
    { key: "marketplace", icon: ShoppingBag,   label: "بيع وشراء الخدمات" },
    { key: "community",   icon: MessageCircle, label: "مجتمعات متخصصة" },
    { key: "academy",     icon: GraduationCap, label: "التعلّم والتطوّر" },
];

const LEVELS = [
    { key: "beginner",    label: "مبتدئ",     desc: "أخطو أولى خطواتي" },
    { key: "intermediate", label: "متوسط",    desc: "لديّ خبرة سنة أو أكثر" },
    { key: "pro",          label: "محترف",    desc: "أعمل في هذا المجال منذ سنوات" },
];

export default function Onboarding() {
    const { user, setUser } = useAuth();
    const [step, setStep] = useState(0);
    const [primaryGoal, setPrimaryGoal] = useState("");
    const [interests, setInterests] = useState([]);
    const [level, setLevel] = useState("");
    const [busy, setBusy] = useState(false);
    const nav = useNavigate();

    const toggleInterest = (k) => {
        setInterests((prev) => prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]);
    };

    const next = () => {
        if (step === 1 && !primaryGoal) return toast.error("اختر هدفك الأساسي");
        if (step === 3 && !level) return toast.error("اختر مستوى خبرتك");
        setStep((s) => s + 1);
    };
    const back = () => setStep((s) => Math.max(0, s - 1));

    const finish = async () => {
        if (!primaryGoal) return toast.error("اختر هدفك الأساسي");
        if (!level) return toast.error("اختر مستوى خبرتك");
        setBusy(true);
        try {
            const r = await api.post("/auth/onboarding", { primary_goal: primaryGoal, interests, experience_level: level });
            setUser({ ...(user || {}), onboarding_completed: true, primary_goal: primaryGoal, interests, experience_level: level });
            toast.success("أهلاً بك في Amora ✨");
            nav(r.data.next_route || "/workspace");
        } catch (e) {
            toast.error(e.response?.data?.detail || "خطأ");
        } finally { setBusy(false); }
    };

    const skip = async () => {
        try {
            await api.post("/auth/onboarding", { primary_goal: "all", interests: [], experience_level: "intermediate" });
            setUser({ ...(user || {}), onboarding_completed: true });
        } catch { /* silent */ }
        nav("/workspace");
    };

    const totalSteps = 4;
    const progress = ((step + 1) / totalSteps) * 100;

    return (
        <div data-testid="onboarding-page" className="min-h-[100dvh] bg-gradient-to-br from-[#0A0A0A] via-[#141414] to-[#1a0e0a] text-white font-body relative overflow-hidden">
            {/* Ambient orbs */}
            <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#D1795F]/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-16 w-96 h-96 rounded-full bg-[#57769D]/10 blur-3xl pointer-events-none" />

            {/* Progress bar */}
            <div className="sticky top-0 z-10 backdrop-blur-md bg-black/40 border-b border-white/5">
                <div className="max-w-md mx-auto p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <img src="/amora-logo.png" alt="Amora" className="w-8 h-8 rounded-lg" />
                        <span className="font-heading font-black text-lg">Amora</span>
                    </div>
                    <button
                        data-testid="onboarding-skip"
                        onClick={skip}
                        className="text-[10px] text-white/50 hover:text-white/80 font-heading transition"
                    >تخطّي</button>
                </div>
                <div className="max-w-md mx-auto px-4 pb-3">
                    <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#D1795F] to-[#57769D] transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="text-[10px] text-white/40 mt-1 font-heading">الخطوة {step + 1} من {totalSteps}</div>
                </div>
            </div>

            <div className="max-w-md mx-auto p-5 space-y-6 relative">
                {step === 0 && (
                    <StepWelcome name={user?.name} onNext={next} />
                )}

                {step === 1 && (
                    <StepGoal value={primaryGoal} onChange={setPrimaryGoal} />
                )}

                {step === 2 && (
                    <StepInterests values={interests} onToggle={toggleInterest} />
                )}

                {step === 3 && (
                    <StepLevel value={level} onChange={setLevel} />
                )}

                {/* Nav buttons */}
                {step > 0 && (
                    <div className="pt-2 pb-6 flex items-center gap-3">
                        <button
                            data-testid="onboarding-back"
                            onClick={back}
                            className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl py-3 text-sm text-white/70 font-heading font-bold flex items-center justify-center gap-1"
                        >
                            <ArrowRight className="w-4 h-4" /> السابق
                        </button>
                        {step < totalSteps - 1 ? (
                            <button
                                data-testid="onboarding-next"
                                onClick={next}
                                className="flex-[2] bg-[#D1795F] hover:bg-[#B86648] rounded-2xl py-3 text-sm text-white font-heading font-bold flex items-center justify-center gap-1 active:scale-95 transition"
                            >
                                التالي <ArrowLeft className="w-4 h-4" />
                            </button>
                        ) : (
                            <button
                                data-testid="onboarding-finish"
                                onClick={finish}
                                disabled={busy}
                                className="flex-[2] bg-gradient-to-r from-[#D1795F] to-[#57769D] rounded-2xl py-3 text-sm text-white font-heading font-black flex items-center justify-center gap-1 active:scale-95 transition disabled:opacity-60"
                            >
                                {busy ? "جارٍ التجهيز..." : "ابدأ رحلتي"} <Sparkles className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}


function StepWelcome({ name, onNext }) {
    return (
        <div data-testid="step-welcome" className="pt-8 space-y-6 text-center">
            <div className="mx-auto w-24 h-24 rounded-3xl overflow-hidden shadow-2xl shadow-[#D1795F]/30 animate-[fadeIn_0.6s_ease-out]">
                <img src="/amora-logo.png" alt="Amora" className="w-full h-full object-cover" />
            </div>
            <div className="space-y-2">
                <h1 className="font-heading font-black text-3xl leading-tight">
                    مرحباً<span className="text-[#D1795F]">،</span> {name || "بك"}
                </h1>
                <p className="text-sm text-white/60 leading-relaxed font-body max-w-xs mx-auto">
                    أنا <span className="text-[#D1795F] font-heading font-bold">Amora</span> — نظام تشغيلك الإبداعي.<br />
                    دعني أفهمك في أقل من دقيقة لأخصّص كل شيء لك.
                </p>
            </div>
            <button
                data-testid="onboarding-start"
                onClick={onNext}
                className="w-full bg-gradient-to-r from-[#D1795F] to-[#57769D] hover:from-[#B86648] rounded-2xl py-4 text-sm text-white font-heading font-black flex items-center justify-center gap-2 active:scale-95 transition"
            >
                هيّا نبدأ <ArrowLeft className="w-4 h-4" />
            </button>
        </div>
    );
}


function StepGoal({ value, onChange }) {
    return (
        <div data-testid="step-goal" className="space-y-4 pt-4 animate-[fadeIn_0.4s_ease-out]">
            <div>
                <h2 className="font-heading font-black text-2xl">ما هدفك الأساسي؟</h2>
                <p className="text-xs text-white/50 mt-1 font-body">سنُخصّص لوحتك حسب هذا الاختيار</p>
            </div>
            <div className="space-y-2.5">
                {GOALS.map((g) => {
                    const Icon = g.icon;
                    const active = value === g.key;
                    return (
                        <button
                            key={g.key}
                            data-testid={`goal-${g.key}`}
                            onClick={() => onChange(g.key)}
                            className={`w-full text-start rounded-2xl p-4 border transition group ${
                                active
                                    ? "bg-gradient-to-br from-[#D1795F]/20 to-[#D1795F]/5 border-[#D1795F]"
                                    : "bg-white/[0.03] border-white/10 hover:border-white/25 hover:bg-white/5"
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition ${active ? "bg-[#D1795F] text-white" : "bg-white/5 text-white/60 group-hover:bg-white/10"}`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-heading font-bold text-sm text-white">{g.title}</div>
                                    <div className="text-[11px] text-white/50 mt-0.5 font-body">{g.desc}</div>
                                </div>
                                {active && <ChevronRight className="w-4 h-4 text-[#D1795F] mt-2 rotate-180" />}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}


function StepInterests({ values, onToggle }) {
    return (
        <div data-testid="step-interests" className="space-y-4 pt-4 animate-[fadeIn_0.4s_ease-out]">
            <div>
                <h2 className="font-heading font-black text-2xl">ما يستهويك أيضاً؟</h2>
                <p className="text-xs text-white/50 mt-1 font-body">اختر مجالات فرعية (اختياري)</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
                {INTERESTS.map((it) => {
                    const Icon = it.icon;
                    const active = values.includes(it.key);
                    return (
                        <button
                            key={it.key}
                            data-testid={`interest-${it.key}`}
                            onClick={() => onToggle(it.key)}
                            className={`aspect-square rounded-2xl p-3 border transition flex flex-col items-center justify-center gap-2 ${
                                active
                                    ? "bg-[#57769D]/15 border-[#57769D]"
                                    : "bg-white/[0.03] border-white/10 hover:border-white/25"
                            }`}
                        >
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${active ? "bg-[#57769D] text-white" : "bg-white/5 text-white/60"}`}>
                                <Icon className="w-5 h-5" />
                            </div>
                            <div className="text-xs font-heading font-bold text-center text-white leading-tight">{it.label}</div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}


function StepLevel({ value, onChange }) {
    return (
        <div data-testid="step-level" className="space-y-4 pt-4 animate-[fadeIn_0.4s_ease-out]">
            <div>
                <h2 className="font-heading font-black text-2xl">أخبرنا عن مستواك</h2>
                <p className="text-xs text-white/50 mt-1 font-body">لنُقدّم لك ما يناسبك</p>
            </div>
            <div className="space-y-2.5">
                {LEVELS.map((lv, i) => {
                    const active = value === lv.key;
                    return (
                        <button
                            key={lv.key}
                            data-testid={`level-${lv.key}`}
                            onClick={() => onChange(lv.key)}
                            className={`w-full text-start rounded-2xl p-4 border transition ${
                                active
                                    ? "bg-gradient-to-r from-[#C3E0A5]/15 to-transparent border-[#C3E0A5]"
                                    : "bg-white/[0.03] border-white/10 hover:border-white/25"
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-heading font-black text-sm ${active ? "bg-[#C3E0A5] text-black" : "bg-white/5 text-white/60"}`}>
                                    {i + 1}
                                </div>
                                <div>
                                    <div className="font-heading font-bold text-sm text-white">{lv.label}</div>
                                    <div className="text-[11px] text-white/50 font-body">{lv.desc}</div>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
