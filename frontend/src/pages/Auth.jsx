import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Sparkles, Check } from "lucide-react";
import { ROLES, LOOKING_FOR } from "@/constants/roles";

export default function Auth() {
    const [mode, setMode] = useState("login");
    const [step, setStep] = useState(1); // signup only: 1 form, 2 role, 3 looking_for
    const [form, setForm] = useState({ email: "", password: "", name: "", username: "", role: "creator", looking_for: [] });
    const [loading, setLoading] = useState(false);
    const { login, signup } = useAuth();
    const navigate = useNavigate();

    const toggleLF = (item) => {
        setForm((f) => ({ ...f, looking_for: f.looking_for.includes(item) ? f.looking_for.filter((x) => x !== item) : [...f.looking_for, item] }));
    };

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (mode === "login") { await login(form.email, form.password); }
            else { await signup(form); }
            toast.success("أهلاً بك في رؤى");
            navigate("/feed");
        } catch (err) {
            toast.error(err?.response?.data?.detail || "حدث خطأ ما");
        } finally { setLoading(false); }
    };

    return (
        <div className="min-h-[100dvh] w-full max-w-md mx-auto bg-black text-white flex flex-col justify-center p-6 font-body relative overflow-hidden">
            <div className="absolute -top-20 -start-20 w-64 h-64 rounded-full bg-[#E3FF00]/10 blur-3xl" />
            <div className="absolute -bottom-20 -end-20 w-64 h-64 rounded-full bg-[#E3FF00]/5 blur-3xl" />

            <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-8 h-8 text-[#E3FF00]" />
                    <h1 className="text-4xl font-heading font-black">رؤى</h1>
                    <span className="text-xs text-neutral-500 self-end mb-2">Ru'ya</span>
                </div>
                <p className="text-neutral-400 mb-8 font-body">
                    المنصة الرقمية للمواهب والمشاريع والشركات
                </p>

                <div className="flex gap-2 bg-neutral-900 p-1 rounded-full mb-8">
                    <button
                        data-testid="tab-login"
                        onClick={() => setMode("login")}
                        className={`flex-1 py-2 rounded-full font-heading font-bold text-sm transition-all ${
                            mode === "login" ? "bg-[#E3FF00] text-black" : "text-neutral-400"
                        }`}
                    >
                        تسجيل الدخول
                    </button>
                    <button
                        data-testid="tab-signup"
                        onClick={() => setMode("signup")}
                        className={`flex-1 py-2 rounded-full font-heading font-bold text-sm transition-all ${
                            mode === "signup" ? "bg-[#E3FF00] text-black" : "text-neutral-400"
                        }`}
                    >
                        إنشاء حساب
                    </button>
                </div>

                <form onSubmit={submit} className="flex flex-col gap-4">
                    {mode === "signup" && step === 1 && (
                        <>
                            <input data-testid="input-name" placeholder="الاسم الكامل" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-[#141414] border border-[#262626] rounded-xl px-4 py-3.5 text-white placeholder-neutral-500 focus:border-[#E3FF00] focus:outline-none transition" />
                            <input data-testid="input-username" placeholder="اسم المستخدم (بالإنجليزية)" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, "") })} required pattern="[a-z0-9_]{3,20}" className="bg-[#141414] border border-[#262626] rounded-xl px-4 py-3.5 text-white placeholder-neutral-500 focus:border-[#E3FF00] focus:outline-none transition" />
                        </>
                    )}
                    {(mode === "login" || (mode === "signup" && step === 1)) && (
                        <>
                            <input data-testid="input-email" type="email" placeholder="البريد الإلكتروني" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="bg-[#141414] border border-[#262626] rounded-xl px-4 py-3.5 text-white placeholder-neutral-500 focus:border-[#E3FF00] focus:outline-none transition" />
                            <input data-testid="input-password" type="password" placeholder="كلمة المرور" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} className="bg-[#141414] border border-[#262626] rounded-xl px-4 py-3.5 text-white placeholder-neutral-500 focus:border-[#E3FF00] focus:outline-none transition" />
                        </>
                    )}

                    {mode === "signup" && step === 2 && (
                        <div>
                            <div className="text-sm text-neutral-400 mb-3 font-heading font-bold">من أنت؟</div>
                            <div className="grid grid-cols-2 gap-2 max-h-[380px] overflow-y-auto no-scrollbar">
                                {ROLES.map((r) => (
                                    <button type="button" key={r.id} data-testid={`role-${r.id}`} onClick={() => setForm({ ...form, role: r.id })} className={`text-start px-3 py-3 rounded-xl border font-heading font-bold text-sm transition ${form.role === r.id ? "bg-[#E3FF00] text-black border-[#E3FF00]" : "bg-[#141414] border-[#262626] hover:border-white/30"}`}>{r.label}</button>
                                ))}
                            </div>
                        </div>
                    )}

                    {mode === "signup" && step === 3 && (
                        <div>
                            <div className="text-sm text-neutral-400 mb-3 font-heading font-bold">ما الذي تبحث عنه؟ <span className="text-neutral-600">(يمكن اختيار أكثر من واحد)</span></div>
                            <div className="grid grid-cols-2 gap-2">
                                {LOOKING_FOR.map((item) => {
                                    const active = form.looking_for.includes(item);
                                    return (
                                        <button type="button" key={item} data-testid={`lf-${item}`} onClick={() => toggleLF(item)} className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl border font-heading font-bold text-sm transition ${active ? "bg-[#E3FF00] text-black border-[#E3FF00]" : "bg-[#141414] border-[#262626]"}`}>
                                            {active && <Check className="w-3 h-3" />} {item}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {mode === "signup" && step < 3 ? (
                        <button type="button" data-testid="next-step" onClick={() => setStep(step + 1)} disabled={step === 1 && (!form.email || !form.password || !form.name || !form.username)} className="bg-[#E3FF00] text-black font-heading font-bold rounded-full py-3.5 hover:bg-[#CCEA00] transition active:scale-95 disabled:opacity-50 mt-2">
                            التالي →
                        </button>
                    ) : (
                        <button data-testid="submit-auth" type="submit" disabled={loading} className="bg-[#E3FF00] text-black font-heading font-bold rounded-full py-3.5 hover:bg-[#CCEA00] transition-all active:scale-95 disabled:opacity-60 mt-2">
                            {loading ? "..." : mode === "login" ? "دخول" : "إنشاء حساب"}
                        </button>
                    )}
                </form>

                <Link to="/" className="block text-center mt-6 text-neutral-500 text-sm hover:text-white transition" data-testid="skip-auth">
                    تصفح بدون تسجيل →
                </Link>
            </div>
        </div>
    );
}
