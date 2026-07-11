import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import {
    Heart,
    Sparkles,
    Compass,
    Rocket,
    Users,
    TrendingUp,
    Palette,
    Video,
    Megaphone,
    Target,
    ArrowLeft,
    Play,
    Star,
    Quote,
    Building2,
    Brain,
    GraduationCap,
    Briefcase,
    Globe,
    ChevronDown,
    Mail,
    Phone,
    MessageCircle,
    Zap,
    Clock,
    Database,
    Layers,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const IMAGES = {
    hero: "https://images.unsplash.com/photo-1601506521793-dc748fc80b67?auto=format&fit=crop&w=1920&q=80",
    about: "https://images.unsplash.com/photo-1555436169-20e93ea9a7ff?auto=format&fit=crop&w=1600&q=80",
    offer: "https://images.unsplash.com/photo-1614036742146-6e9bb0a163d5?auto=format&fit=crop&w=1200&q=80",
    testimonial: "https://images.unsplash.com/photo-1582805661610-2193349833df?auto=format&fit=crop&w=800&q=80",
    vision: "https://images.unsplash.com/photo-1663900108404-a05e8bf82cda?auto=format&fit=crop&w=1600&q=80",
    contact: "https://images.unsplash.com/photo-1637979910474-38e3ad8d5cab?auto=format&fit=crop&w=1600&q=80",
};

// ═══════════════════════════════════════════════════════════════
// Top Navigation
// ═══════════════════════════════════════════════════════════════
function TopNav() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <nav
            data-testid="landing-topnav"
            className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
                scrolled ? "bg-black/90 backdrop-blur-xl border-b border-white/10 py-3" : "bg-transparent py-5"
            }`}
        >
            <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
                <Link to="/" data-testid="landing-logo" className="flex items-center gap-2 group">
                    <div className="w-9 h-9 rounded-xl bg-[#D1795F] flex items-center justify-center shadow-lg shadow-[#D1795F]/20 group-hover:scale-110 transition-transform">
                        <Heart className="w-5 h-5 text-black" fill="black" />
                    </div>
                    <span className="font-heading font-black text-2xl text-white tracking-tight">Ruaa</span>
                </Link>

                <div className="hidden md:flex items-center gap-8 text-sm font-body">
                    <a href="#manifesto" className="text-white/70 hover:text-white transition-colors">
                        من نحن
                    </a>
                    <a href="#offer" className="text-white/70 hover:text-white transition-colors">
                        ماذا نقدم
                    </a>
                    <a href="#stories" className="text-white/70 hover:text-white transition-colors">
                        قصص نجاح
                    </a>
                    <a href="#vision" className="text-white/70 hover:text-white transition-colors">
                        رؤية 2030
                    </a>
                    <a href="#contact" className="text-white/70 hover:text-white transition-colors">
                        تواصل
                    </a>
                </div>

                <div className="flex items-center gap-3">
                    {user ? (
                        <button
                            data-testid="landing-open-app"
                            onClick={() => navigate("/feed")}
                            className="bg-[#D1795F] text-white font-bold font-heading rounded-full px-5 py-2 hover:bg-[#B86648] transition-all active:scale-95 text-sm"
                        >
                            دخول المنصة
                        </button>
                    ) : (
                        <>
                            <button
                                data-testid="landing-nav-login"
                                onClick={() => navigate("/auth")}
                                className="text-white/80 hover:text-white text-sm font-body hidden sm:inline"
                            >
                                تسجيل الدخول
                            </button>
                            <button
                                data-testid="landing-nav-cta"
                                onClick={() => navigate("/auth")}
                                className="bg-[#D1795F] text-white font-bold font-heading rounded-full px-5 py-2 hover:bg-[#B86648] transition-all active:scale-95 text-sm"
                            >
                                ابدأ قصتك
                            </button>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}

// ═══════════════════════════════════════════════════════════════
// Hero Section
// ═══════════════════════════════════════════════════════════════
function Hero() {
    const navigate = useNavigate();
    const { scrollY } = useScroll();
    const y = useTransform(scrollY, [0, 500], [0, 150]);
    const opacity = useTransform(scrollY, [0, 400], [1, 0]);

    return (
        <section className="relative min-h-screen w-full overflow-hidden bg-black">
            {/* Background image with parallax */}
            <motion.div style={{ y }} className="absolute inset-0">
                <img src={IMAGES.hero} alt="" className="w-full h-full object-cover opacity-40" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black" />
                <div className="absolute inset-0 bg-gradient-to-l from-transparent via-black/30 to-black/70" />
            </motion.div>

            {/* Animated grid overlay */}
            <div className="absolute inset-0 opacity-[0.06]"
                style={{
                    backgroundImage:
                        "linear-gradient(rgba(227,255,0,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(227,255,0,0.5) 1px, transparent 1px)",
                    backgroundSize: "80px 80px",
                }}
            />

            {/* Yellow glow */}
            <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-[#D1795F]/20 blur-[120px]" />
            <div className="absolute bottom-0 -left-20 w-[400px] h-[400px] rounded-full bg-[#D1795F]/10 blur-[100px]" />

            <motion.div
                style={{ opacity }}
                className="relative z-10 max-w-6xl mx-auto px-6 pt-40 pb-24 min-h-screen flex flex-col justify-center"
            >
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="inline-flex items-center gap-2 self-start bg-white/5 border border-white/10 backdrop-blur-md rounded-full px-4 py-2 mb-8"
                >
                    <span className="w-2 h-2 rounded-full bg-[#D1795F] animate-pulse" />
                    <span className="text-white/80 text-sm font-body">وكالة تسويق رقمية × نظام تشغيل إبداعي</span>
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 0.2 }}
                    className="font-heading font-black text-5xl sm:text-7xl lg:text-8xl text-white leading-[1.05] tracking-tight mb-6"
                >
                    ندشن
                    <span className="text-[#D1795F] block sm:inline"> قصة حب </span>
                    <br className="hidden sm:block" />
                    جديدة مع
                    <br className="hidden sm:block" />
                    <span className="italic font-light">عميلك.</span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                    className="text-lg sm:text-2xl text-white/70 font-body max-w-2xl leading-relaxed mb-10"
                >
                    لسنا مجرد وكالة، ولسنا مجرد منصة.
                    <br />
                    نحن الشريك الذي يحوّل شغفك إلى قصة تُروى، وعلامتك إلى ذكرى لا تُنسى في قلب عميلك.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.7 }}
                    className="flex flex-wrap items-center gap-4"
                >
                    <button
                        data-testid="hero-primary-cta"
                        onClick={() => navigate("/auth")}
                        className="group relative bg-[#D1795F] text-white font-bold font-heading rounded-full px-8 py-4 hover:bg-[#B86648] transition-all active:scale-95 text-lg flex items-center gap-2 shadow-2xl shadow-[#D1795F]/30"
                    >
                        <span>ابدأ قصة حبك الجديدة</span>
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    </button>

                    <button
                        data-testid="hero-secondary-cta"
                        onClick={() => navigate("/feed")}
                        className="bg-white/5 border border-white/20 backdrop-blur-md text-white font-medium font-heading rounded-full px-8 py-4 hover:bg-white/10 transition-all active:scale-95 text-lg flex items-center gap-2"
                    >
                        <Play className="w-4 h-4" fill="white" />
                        <span>اكتشف المنصة</span>
                    </button>
                </motion.div>

                {/* Trust indicators */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 1.2 }}
                    className="mt-16 flex flex-wrap items-center gap-8 text-white/50 text-sm font-body"
                >
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#D1795F]" />
                        <span>محتوى إبداعي</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#D1795F]" />
                        <span>مجتمع نابض</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Rocket className="w-4 h-4 text-[#D1795F]" />
                        <span>حاضنة مشاريع</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Brain className="w-4 h-4 text-[#D1795F]" />
                        <span>ذكاء اصطناعي</span>
                    </div>
                </motion.div>
            </motion.div>

            {/* Scroll indicator */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
            >
                <motion.div
                    animate={{ y: [0, 10, 0] }}
                    transition={{ repeat: Infinity, duration: 1.8 }}
                    className="flex flex-col items-center gap-2 text-white/40"
                >
                    <span className="text-xs font-body">اكتشف</span>
                    <ChevronDown className="w-5 h-5" />
                </motion.div>
            </motion.div>
        </section>
    );
}

// ═══════════════════════════════════════════════════════════════
// Manifesto Section (About)
// ═══════════════════════════════════════════════════════════════
function Manifesto() {
    return (
        <section id="manifesto" className="relative bg-[#0A0A0A] py-32 overflow-hidden">
            <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
                <motion.div
                    initial={{ opacity: 0, x: 40 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.8 }}
                    className="order-2 lg:order-1"
                >
                    <div className="inline-flex items-center gap-2 bg-[#D1795F]/10 border border-[#D1795F]/20 rounded-full px-4 py-1.5 mb-6">
                        <Heart className="w-4 h-4 text-[#D1795F]" fill="#D1795F" />
                        <span className="text-[#D1795F] text-sm font-heading font-semibold">فلسفتنا</span>
                    </div>

                    <h2 className="font-heading font-black text-4xl sm:text-5xl lg:text-6xl text-white leading-tight mb-8">
                        لا نبني منصة.
                        <br />
                        <span className="text-[#D1795F]">نُطلق قصصاً</span> لا تُنسى.
                    </h2>

                    <div className="space-y-6 text-white/70 font-body text-lg leading-relaxed">
                        <p>
                            نحن لا نبني <span className="text-white/40 line-through">TikTok عربي</span>، ولا{" "}
                            <span className="text-white/40 line-through">Fiverr عربي</span>، ولا{" "}
                            <span className="text-white/40 line-through">Upwork عربي</span>.
                        </p>
                        <p className="text-white text-xl">
                            نحن نبني منصة تجمع أفضل ما في هذه العوالم، داخل نظام واحد يخدم رحلة المبدع{" "}
                            <span className="text-[#D1795F] font-semibold">منذ الفكرة، حتى بناء الشركة.</span>
                        </p>
                        <p>
                            نؤمن أن كل علامة تجارية تستحق أن تُروى قصتها، وكل عميل يستحق أن يشعر بأنه في قصة حب حقيقية مع الخدمة
                            التي يتلقاها. لهذا نحن هنا — لنكون الشريك الذي يفهم رؤيتك، لا مجرد منفّذ لخدماتك.
                        </p>
                    </div>

                    <div className="mt-10 grid grid-cols-3 gap-4">
                        {[
                            { n: "٨", l: "مبادئ نلتزم بها" },
                            { n: "١٤", l: "محرك متكامل" },
                            { n: "٥", l: "سنوات رؤية" },
                        ].map((s, i) => (
                            <div key={i} className="border-r border-white/10 pr-4 first:border-r-0 last:pr-0">
                                <div className="text-4xl font-black font-heading text-[#D1795F]">{s.n}</div>
                                <div className="text-sm text-white/50 font-body mt-1">{s.l}</div>
                            </div>
                        ))}
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: -40 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.8 }}
                    className="order-1 lg:order-2 relative"
                >
                    <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                        <img src={IMAGES.about} alt="فريق Ruaa" className="w-full h-[560px] object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                        <div className="absolute bottom-8 right-8 left-8">
                            <p className="text-white text-xl font-heading font-bold leading-snug">
                                "شركاؤك في الرحلة، لا مجرد مقدّمي خدمة."
                            </p>
                        </div>
                    </div>
                    {/* Decorative accents */}
                    <div className="absolute -top-6 -left-6 w-24 h-24 rounded-2xl bg-[#D1795F] flex items-center justify-center rotate-6 shadow-2xl shadow-[#D1795F]/20">
                        <Sparkles className="w-10 h-10 text-black" />
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

// ═══════════════════════════════════════════════════════════════
// What We Offer Section
// ═══════════════════════════════════════════════════════════════
function Offer() {
    const services = [
        {
            icon: Palette,
            title: "بناء الهوية البصرية",
            headline: "نصمّم هوية تعبّر عن روحك، وتأسر جمهورك.",
            body: "من الشعار إلى نظام الألوان إلى الأسلوب البصري — نخلق هوية بصرية متكاملة تحكي قصتك في كل نقطة اتصال مع عميلك.",
        },
        {
            icon: Video,
            title: "إنتاج المحتوى",
            headline: "نصنع محتوى يلامس القلوب قبل الشاشات.",
            body: "فيديوهات، ريلز، تصوير احترافي، سيناريو — فريق إبداعي متكامل يحوّل رسالتك إلى محتوى مؤثر ينتشر بشغف.",
        },
        {
            icon: Megaphone,
            title: "التسويق الرقمي",
            headline: "نروي قصتك في العالم الرقمي بأسلوب لا يُنسى.",
            body: "حملات ذكية، إدارة منصات، إعلانات مدروسة، محتوى تفاعلي — كل حرف وكل صورة تخدم بناء علاقة عاطفية مع جمهورك.",
        },
        {
            icon: TrendingUp,
            title: "استراتيجيات النمو",
            headline: "نرسم لك طريقاً نحو نمو مستدام لا انفجارات مؤقتة.",
            body: "تحليل بيانات، دراسة سوق، استشارات نمو، بناء قنوات — نصنع لك خطة نمو تتوافق مع رؤيتك وقيمك.",
        },
    ];

    return (
        <section id="offer" className="relative bg-black py-32 overflow-hidden">
            <div className="max-w-7xl mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center max-w-3xl mx-auto mb-20"
                >
                    <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6">
                        <Target className="w-4 h-4 text-[#D1795F]" />
                        <span className="text-white/80 text-sm font-heading font-semibold">ماذا نقدم</span>
                    </div>

                    <h2 className="font-heading font-black text-4xl sm:text-5xl lg:text-6xl text-white leading-tight mb-6">
                        لا نبيع خدمات.
                        <br />
                        <span className="text-[#D1795F]">نصنع تحوّلات.</span>
                    </h2>

                    <p className="text-white/60 font-body text-lg leading-relaxed">
                        كل خدمة نقدّمها هي وعد بتحوّل حقيقي — من مجرد "عميل يشتري" إلى "شريك يحبّك".
                    </p>
                </motion.div>

                <div className="grid md:grid-cols-2 gap-6">
                    {services.map((s, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.2 }}
                            transition={{ duration: 0.6, delay: i * 0.1 }}
                            className="group relative bg-gradient-to-br from-[#141414] to-[#0A0A0A] border border-white/10 rounded-3xl p-8 lg:p-10 hover:border-[#D1795F]/40 transition-all overflow-hidden"
                        >
                            <div className="absolute -top-20 -left-20 w-40 h-40 rounded-full bg-[#D1795F]/0 group-hover:bg-[#D1795F]/10 blur-3xl transition-all duration-700" />

                            <div className="relative z-10">
                                <div className="w-14 h-14 rounded-2xl bg-[#D1795F]/10 border border-[#D1795F]/30 flex items-center justify-center mb-6 group-hover:bg-[#D1795F] transition-colors">
                                    <s.icon className="w-7 h-7 text-[#D1795F] group-hover:text-black transition-colors" />
                                </div>

                                <p className="text-white/50 text-sm font-body mb-2">{s.title}</p>
                                <h3 className="font-heading font-bold text-2xl lg:text-3xl text-white leading-tight mb-4">
                                    {s.headline}
                                </h3>
                                <p className="text-white/60 font-body leading-relaxed">{s.body}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Featured image */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="mt-16 relative rounded-3xl overflow-hidden border border-white/10 h-[400px]"
                >
                    <img src={IMAGES.offer} alt="إبداع" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black via-black/50 to-transparent" />
                    <div className="absolute inset-0 flex items-center">
                        <div className="max-w-xl p-12">
                            <p className="text-[#D1795F] font-heading font-semibold text-sm mb-3">وعدنا لك</p>
                            <h3 className="font-heading font-black text-3xl lg:text-4xl text-white leading-tight">
                                لا تشتري خدمة تصميم. استثمر في هوية تعبّر عن شغفك، وتُلهم جمهورك.
                            </h3>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

// ═══════════════════════════════════════════════════════════════
// Love Stories (Testimonials)
// ═══════════════════════════════════════════════════════════════
function LoveStories() {
    const stories = [
        {
            name: "أحمد الشريف",
            role: "مؤسس، Alba Cafe",
            image: IMAGES.testimonial,
            challenge: "كان مقهانا يذوب في الحشد — لا هوية، لا صوت، لا قصة.",
            solution: "أعادت Ruaa تعريف علامتنا: من الشعار إلى الرسائل التسويقية، من كل جدار في المقهى إلى كل ريل على انستقرام.",
            result: "الزيارات ارتفعت 210%، لكن الأهم — الناس صاروا يأتون لأنهم يحبّون القصة، لا فقط القهوة.",
            metric: "+210%",
            label: "زيارات شهرية",
        },
        {
            name: "منال الحربي",
            role: "مصمّمة، Studio Nur",
            image: IMAGES.testimonial,
            challenge: "أعمالي جميلة، لكن لا أحد يعرفني. كنت أشعر أنني أعمل في الظل.",
            solution: "ساعدتني Ruaa في بناء بروفايل قوي، محتوى فيديو أسبوعي، وصفقات مع عملاء من مستوى مختلف.",
            result: "خلال 4 أشهر، تحوّلت من مصمّمة مستقلة إلى استوديو بفريق من 5 أشخاص.",
            metric: "5×",
            label: "نمو الفريق",
        },
        {
            name: "خالد الجهني",
            role: "رائد أعمال، LamsaTech",
            image: IMAGES.testimonial,
            challenge: "فكرة رائعة، لكن لا أعرف من أين أبدأ. تِهت بين عشرات الأدوات والاستشاريين.",
            solution: "حاضنة Ruaa أخذت بيدي عبر 7 مراحل واضحة — من الفكرة إلى الإطلاق، مع مجتمع يدعمني في كل خطوة.",
            result: "أطلقت أول MVP خلال 3 أشهر، وحصلت على أول جولة تمويل من مستثمر رأيت مشروعي على المنصة.",
            metric: "3 أشهر",
            label: "من الفكرة للإطلاق",
        },
    ];

    return (
        <section id="stories" className="relative bg-[#0A0A0A] py-32 overflow-hidden">
            <div className="max-w-7xl mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center max-w-3xl mx-auto mb-20"
                >
                    <div className="inline-flex items-center gap-2 bg-[#D1795F]/10 border border-[#D1795F]/20 rounded-full px-4 py-1.5 mb-6">
                        <Heart className="w-4 h-4 text-[#D1795F]" fill="#D1795F" />
                        <span className="text-[#D1795F] text-sm font-heading font-semibold">قصص حب حقيقية</span>
                    </div>

                    <h2 className="font-heading font-black text-4xl sm:text-5xl lg:text-6xl text-white leading-tight mb-6">
                        لكل نجاح قصة.
                        <br />
                        <span className="text-[#D1795F]">وكل قصة تبدأ بحبّ.</span>
                    </h2>
                </motion.div>

                <div className="space-y-8">
                    {stories.map((story, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.2 }}
                            transition={{ duration: 0.6, delay: i * 0.1 }}
                            className={`grid lg:grid-cols-5 gap-8 items-center bg-gradient-to-br from-[#141414] to-[#0A0A0A] border border-white/10 rounded-3xl p-8 lg:p-12 hover:border-[#D1795F]/30 transition-all ${
                                i % 2 === 1 ? "lg:direction-rtl" : ""
                            }`}
                        >
                            <div className="lg:col-span-2 flex flex-col items-start gap-6">
                                <div className="relative">
                                    <img
                                        src={story.image}
                                        alt={story.name}
                                        className="w-24 h-24 rounded-2xl object-cover border border-white/10"
                                    />
                                    <div className="absolute -bottom-2 -left-2 bg-[#D1795F] rounded-full w-10 h-10 flex items-center justify-center">
                                        <Quote className="w-5 h-5 text-black" />
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-white font-heading font-bold text-xl">{story.name}</h4>
                                    <p className="text-white/50 font-body text-sm mt-1">{story.role}</p>
                                </div>
                                <div className="bg-[#D1795F]/10 border border-[#D1795F]/20 rounded-2xl px-6 py-4">
                                    <div className="text-[#D1795F] font-heading font-black text-3xl">{story.metric}</div>
                                    <div className="text-white/60 font-body text-xs mt-1">{story.label}</div>
                                </div>
                            </div>

                            <div className="lg:col-span-3 space-y-5">
                                <div>
                                    <p className="text-white/40 font-body text-xs uppercase tracking-widest mb-2">التحدي</p>
                                    <p className="text-white/80 font-body text-lg leading-relaxed">{story.challenge}</p>
                                </div>
                                <div>
                                    <p className="text-[#D1795F] font-body text-xs uppercase tracking-widest mb-2">الحل الإبداعي</p>
                                    <p className="text-white font-body text-lg leading-relaxed">{story.solution}</p>
                                </div>
                                <div className="bg-white/5 border-r-2 border-[#D1795F] pr-4 py-2">
                                    <p className="text-white/60 font-body text-xs uppercase tracking-widest mb-2">النتيجة</p>
                                    <p className="text-white font-heading font-bold text-xl leading-relaxed">{story.result}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ═══════════════════════════════════════════════════════════════
// Vision 2030 Timeline
// ═══════════════════════════════════════════════════════════════
function Vision() {
    const roadmap = [
        { year: "١", title: "السوق × المجتمعات", desc: "ربط المواهب بالعملاء عبر Marketplace وبناء مجتمعات نابضة.", icon: Users, active: true },
        { year: "٢", title: "الحاضنة × الأكاديمية × AI", desc: "احتضان الأفكار، تعليم المهارات، ودمج الذكاء الاصطناعي في كل وظيفة.", icon: Brain },
        { year: "٣", title: "نظام تشغيل الأعمال", desc: "CRM، إدارة محتوى، مهام، فوترة — كل ما تحتاجه شركة إبداعية.", icon: Briefcase },
        { year: "٤", title: "المركز الإبداعي", desc: "منصة إبداعية عالمية تربط المواهب العربية بالعالم.", icon: Globe },
        { year: "٥", title: "الاندماج مع المقر الفعلي", desc: "توأم رقمي كامل: احجز قاعة، افتح مساحة، اصنع محتوى — من أي مكان.", icon: Building2 },
    ];

    return (
        <section id="vision" className="relative py-32 overflow-hidden bg-black">
            <div className="absolute inset-0">
                <img src={IMAGES.vision} alt="" className="w-full h-full object-cover opacity-20" />
                <div className="absolute inset-0 bg-gradient-to-b from-black via-black/80 to-black" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center max-w-3xl mx-auto mb-20"
                >
                    <div className="inline-flex items-center gap-2 bg-[#D1795F]/10 border border-[#D1795F]/20 rounded-full px-4 py-1.5 mb-6">
                        <Rocket className="w-4 h-4 text-[#D1795F]" />
                        <span className="text-[#D1795F] text-sm font-heading font-semibold">رؤية ٢٠٣٠</span>
                    </div>

                    <h2 className="font-heading font-black text-4xl sm:text-5xl lg:text-6xl text-white leading-tight mb-6">
                        نبني اليوم،
                        <br />
                        <span className="text-[#D1795F]">لخمس سنوات قادمة.</span>
                    </h2>
                    <p className="text-white/60 font-body text-lg leading-relaxed">
                        خارطة طريق واضحة نحو نظام بيئي إبداعي كامل — يبدأ بربط المواهب، وينتهي بنظام تشغيل شامل يدمج الرقمي بالواقع.
                    </p>
                </motion.div>

                <div className="relative">
                    {/* Vertical line */}
                    <div className="hidden lg:block absolute right-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-[#D1795F] via-[#D1795F]/30 to-transparent translate-x-1/2" />

                    <div className="space-y-12 lg:space-y-24">
                        {roadmap.map((r, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.3 }}
                                transition={{ duration: 0.6, delay: i * 0.1 }}
                                className={`grid lg:grid-cols-2 gap-8 items-center ${i % 2 === 1 ? "lg:direction-rtl" : ""}`}
                            >
                                <div className={i % 2 === 0 ? "lg:text-end" : "lg:text-start"}>
                                    <div
                                        className={`inline-flex items-center gap-4 mb-4 ${
                                            i % 2 === 0 ? "lg:flex-row-reverse" : ""
                                        }`}
                                    >
                                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black font-heading text-3xl ${
                                            r.active
                                                ? "bg-[#D1795F] text-white"
                                                : "bg-white/5 border border-white/20 text-white"
                                        }`}>
                                            {r.year}
                                        </div>
                                        <div className="text-white/40 text-sm font-body">السنة</div>
                                    </div>
                                    <h3 className="font-heading font-bold text-3xl text-white mb-3">{r.title}</h3>
                                    <p className="text-white/60 font-body leading-relaxed max-w-md lg:inline-block">
                                        {r.desc}
                                    </p>
                                    {r.active && (
                                        <div className="mt-4">
                                            <span className="inline-flex items-center gap-2 bg-[#D1795F]/10 border border-[#D1795F]/30 text-[#D1795F] rounded-full px-3 py-1 text-xs font-body">
                                                <span className="w-1.5 h-1.5 rounded-full bg-[#D1795F] animate-pulse" />
                                                نحن هنا الآن
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className={`hidden lg:flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                                    <div className="w-24 h-24 rounded-3xl bg-[#141414] border border-white/10 flex items-center justify-center">
                                        <r.icon className="w-10 h-10 text-[#D1795F]" />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

// ═══════════════════════════════════════════════════════════════
// Ruaa Principles
// ═══════════════════════════════════════════════════════════════
function Principles() {
    const principles = [
        { icon: TrendingUp, text: "تُساعد شخصاً على النمو" },
        { icon: Users, text: "تبني مجتمعاً" },
        { icon: Heart, text: "تزيد التعاون" },
        { icon: Sparkles, text: "تدعم الاقتصاد الإبداعي" },
        { icon: Globe, text: "تربط الرقمي بالواقع" },
        { icon: Clock, text: "توفّر الوقت" },
        { icon: Database, text: "تعتمد على البيانات" },
        { icon: Layers, text: "قابلة للتوسّع" },
    ];

    return (
        <section className="relative bg-[#0A0A0A] py-32 overflow-hidden">
            <div className="max-w-7xl mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center max-w-3xl mx-auto mb-16"
                >
                    <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6">
                        <Zap className="w-4 h-4 text-[#D1795F]" />
                        <span className="text-white/80 text-sm font-heading font-semibold">مبادئنا</span>
                    </div>

                    <h2 className="font-heading font-black text-4xl sm:text-5xl text-white leading-tight mb-6">
                        كل ميزة نبنيها،
                        <br />
                        <span className="text-[#D1795F]">تحقّق أحدها على الأقل.</span>
                    </h2>
                </motion.div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {principles.map((p, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true, amount: 0.5 }}
                            transition={{ duration: 0.4, delay: i * 0.05 }}
                            className="group bg-[#141414] border border-white/10 rounded-2xl p-6 hover:border-[#D1795F]/40 hover:bg-[#161616] transition-all cursor-default"
                        >
                            <div className="w-12 h-12 rounded-xl bg-[#D1795F]/10 border border-[#D1795F]/30 flex items-center justify-center mb-4 group-hover:bg-[#D1795F] transition-colors">
                                <p.icon className="w-6 h-6 text-[#D1795F] group-hover:text-black transition-colors" />
                            </div>
                            <p className="text-white font-heading font-semibold text-lg leading-snug">{p.text}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ═══════════════════════════════════════════════════════════════
// Contact / Final CTA
// ═══════════════════════════════════════════════════════════════
function Contact() {
    const [form, setForm] = useState({ name: "", email: "", story: "" });
    const [submitting, setSubmitting] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (!form.name || !form.email || !form.story) {
            toast.error("الرجاء تعبئة جميع الحقول");
            return;
        }
        setSubmitting(true);
        try {
            await axios.post(`${BACKEND_URL}/api/leads`, form);
            toast.success("وصلتنا رسالتك ❤️  سنتواصل معك قريباً");
            setForm({ name: "", email: "", story: "" });
        } catch (err) {
            toast.error("حدث خطأ. حاول مرة أخرى.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <section id="contact" className="relative py-32 overflow-hidden bg-black">
            <div className="absolute inset-0">
                <img src={IMAGES.contact} alt="" className="w-full h-full object-cover opacity-30" />
                <div className="absolute inset-0 bg-gradient-to-b from-black via-black/70 to-black" />
            </div>

            {/* Glow accents */}
            <div className="absolute top-1/2 -translate-y-1/2 right-0 w-[600px] h-[600px] rounded-full bg-[#D1795F]/10 blur-[150px]" />

            <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    <div className="inline-flex items-center gap-2 bg-[#D1795F]/10 border border-[#D1795F]/20 rounded-full px-4 py-1.5 mb-6">
                        <MessageCircle className="w-4 h-4 text-[#D1795F]" />
                        <span className="text-[#D1795F] text-sm font-heading font-semibold">لنتحدّث</span>
                    </div>

                    <h2 className="font-heading font-black text-4xl sm:text-5xl lg:text-7xl text-white leading-[1.1] mb-8">
                        ما هي قصة الحب
                        <br />
                        التي تريد أن
                        <br />
                        <span className="text-[#D1795F]">تُدشّنها؟</span>
                    </h2>

                    <p className="text-white/60 font-body text-lg max-w-2xl mx-auto mb-12 leading-relaxed">
                        شاركنا رؤيتك، وسنبدأ سوياً بالخطوة الأولى.
                        <br />
                        لسنا هنا لبيع خدمة — نحن هنا للاستماع.
                    </p>
                </motion.div>

                <motion.form
                    onSubmit={submit}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="bg-[#0A0A0A]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-8 lg:p-10 text-start"
                >
                    <div className="grid sm:grid-cols-2 gap-4 mb-4">
                        <input
                            data-testid="contact-name"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="اسمك"
                            className="bg-[#141414] border border-white/10 rounded-xl px-5 py-4 text-white placeholder-white/40 focus:border-[#D1795F] focus:ring-1 focus:ring-[#D1795F] outline-none font-body"
                        />
                        <input
                            data-testid="contact-email"
                            value={form.email}
                            type="email"
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            placeholder="بريدك الإلكتروني"
                            className="bg-[#141414] border border-white/10 rounded-xl px-5 py-4 text-white placeholder-white/40 focus:border-[#D1795F] focus:ring-1 focus:ring-[#D1795F] outline-none font-body"
                        />
                    </div>
                    <textarea
                        data-testid="contact-story"
                        value={form.story}
                        onChange={(e) => setForm({ ...form, story: e.target.value })}
                        placeholder="احكِ لنا: ما هي قصة الحب التي تريد أن تدشّنها مع عملائك؟"
                        rows={5}
                        className="w-full bg-[#141414] border border-white/10 rounded-xl px-5 py-4 text-white placeholder-white/40 focus:border-[#D1795F] focus:ring-1 focus:ring-[#D1795F] outline-none font-body resize-none"
                    />
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-6 text-white/50 text-sm font-body">
                            <a href="mailto:hello@ruaa.co" className="flex items-center gap-2 hover:text-white transition-colors">
                                <Mail className="w-4 h-4" />
                                hello@ruaa.co
                            </a>
                            <a href="tel:+966500000000" className="flex items-center gap-2 hover:text-white transition-colors">
                                <Phone className="w-4 h-4" />
                                +966 50 000 0000
                            </a>
                        </div>
                        <button
                            data-testid="contact-submit"
                            type="submit"
                            disabled={submitting}
                            className="bg-[#D1795F] text-white font-bold font-heading rounded-full px-8 py-4 hover:bg-[#B86648] transition-all active:scale-95 flex items-center gap-2 disabled:opacity-60 shadow-2xl shadow-[#D1795F]/20"
                        >
                            {submitting ? "جارٍ الإرسال..." : "أرسل قصتي"}
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    </div>
                </motion.form>
            </div>
        </section>
    );
}

// ═══════════════════════════════════════════════════════════════
// Footer
// ═══════════════════════════════════════════════════════════════
function Footer() {
    return (
        <footer className="bg-[#050505] border-t border-white/10 py-12">
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid md:grid-cols-4 gap-8">
                    <div className="md:col-span-2">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-9 h-9 rounded-xl bg-[#D1795F] flex items-center justify-center">
                                <Heart className="w-5 h-5 text-black" fill="black" />
                            </div>
                            <span className="font-heading font-black text-2xl text-white">Ruaa</span>
                        </div>
                        <p className="text-white/50 font-body leading-relaxed max-w-md">
                            وكالة تسويق رقمية × نظام تشغيل إبداعي.
                            <br />
                            ندشّن قصص حب جديدة بين العلامات وعملائها.
                        </p>
                    </div>
                    <div>
                        <h4 className="text-white font-heading font-semibold mb-4">المنصة</h4>
                        <ul className="space-y-3 text-white/50 text-sm font-body">
                            <li><Link to="/feed" className="hover:text-white">المحتوى</Link></li>
                            <li><Link to="/marketplace" className="hover:text-white">السوق</Link></li>
                            <li><Link to="/communities" className="hover:text-white">المجتمعات</Link></li>
                            <li><Link to="/incubator" className="hover:text-white">الحاضنة</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-white font-heading font-semibold mb-4">تواصل</h4>
                        <ul className="space-y-3 text-white/50 text-sm font-body">
                            <li><a href="#manifesto" className="hover:text-white">من نحن</a></li>
                            <li><a href="#stories" className="hover:text-white">قصص نجاح</a></li>
                            <li><a href="#vision" className="hover:text-white">رؤية 2030</a></li>
                            <li><a href="#contact" className="hover:text-white">تواصل معنا</a></li>
                        </ul>
                    </div>
                </div>
                <div className="mt-12 pt-8 border-t border-white/5 flex flex-wrap items-center justify-between gap-4 text-white/40 text-sm font-body">
                    <p>© {new Date().getFullYear()} Ruaa. كل الحقوق محفوظة.</p>
                    <p className="italic">صُنع بحب ❤️ في الوطن العربي</p>
                </div>
            </div>
        </footer>
    );
}

// ═══════════════════════════════════════════════════════════════
// Main Landing Page
// ═══════════════════════════════════════════════════════════════
export default function Landing() {
    useEffect(() => {
        document.documentElement.style.scrollBehavior = "smooth";
        return () => {
            document.documentElement.style.scrollBehavior = "";
        };
    }, []);

    return (
        <div className="bg-black text-white min-h-screen font-body">
            <TopNav />
            <Hero />
            <Manifesto />
            <Offer />
            <LoveStories />
            <Vision />
            <Principles />
            <Contact />
            <Footer />
        </div>
    );
}
