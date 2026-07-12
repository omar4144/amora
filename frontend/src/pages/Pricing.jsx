import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { Sparkles, Check, Zap, Crown, ArrowRight } from "lucide-react";

const ICONS = { free: Sparkles, pro: Zap, business: Crown };
const TONES = { free: "#94A3B8", pro: "#D1795F", business: "#57769D" };

export default function Pricing() {
    const [plans, setPlans] = useState([]);
    const [busy, setBusy] = useState("");
    const [current, setCurrent] = useState(null);
    const nav = useNavigate();

    useEffect(() => {
        api.get("/billing/plans").then((r) => setPlans(r.data));
        api.get("/billing/me").then((r) => setCurrent(r.data)).catch(() => {});
    }, []);

    const upgrade = async (planKey) => {
        setBusy(planKey);
        try {
            const r = await api.post("/billing/checkout", { plan: planKey, origin_url: window.location.origin });
            window.location.href = r.data.url;
        } catch (e) {
            toast.error(e.response?.data?.detail || "تعذّر بدء عملية الدفع");
            setBusy("");
        }
    };

    return (
        <div data-testid="pricing-page" className="p-4 pb-24 space-y-5 min-h-[100dvh]">
            <div className="text-center pt-4">
                <h1 className="font-heading font-black text-2xl text-white">اختر خطتك</h1>
                <p className="text-sm text-white/60 mt-1 font-body">استفد من قوة الذكاء الاصطناعي والفواتير الاحترافية</p>
            </div>

            <div className="space-y-3">
                {plans.map((p) => {
                    const Icon = ICONS[p.key] || Sparkles;
                    const tone = TONES[p.key] || "#D1795F";
                    const isCurrent = current?.plan?.key === p.key;
                    const isFree = p.key === "free";
                    return (
                        <div
                            key={p.key}
                            data-testid={`plan-${p.key}`}
                            className={`bg-gradient-to-br from-white/5 to-white/[0.02] border rounded-3xl p-5 relative overflow-hidden ${isCurrent ? "border-[#D1795F]" : "border-white/10"}`}
                        >
                            {isCurrent && (
                                <div className="absolute top-3 left-3 text-[10px] bg-[#D1795F] text-white px-2 py-0.5 rounded-full font-heading font-bold">
                                    خطتك الحالية
                                </div>
                            )}
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${tone}25`, color: tone }}>
                                    <Icon className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-heading font-black text-xl text-white">{p.name}</h3>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-heading font-black" style={{ color: tone }}>${p.price_usd}</span>
                                        {p.price_usd > 0 && <span className="text-xs text-white/50">/شهر</span>}
                                    </div>
                                </div>
                            </div>

                            <ul className="space-y-2 mb-4">
                                {p.features.map((f, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-white/80 font-body">
                                        <Check className="w-4 h-4 text-[#C3E0A5] flex-shrink-0 mt-0.5" />
                                        <span>{f}</span>
                                    </li>
                                ))}
                            </ul>

                            {!isFree && !isCurrent && (
                                <button
                                    data-testid={`upgrade-${p.key}`}
                                    onClick={() => upgrade(p.key)}
                                    disabled={busy === p.key}
                                    className="w-full font-heading font-bold rounded-xl py-3 text-sm text-white transition active:scale-95 flex items-center justify-center gap-2"
                                    style={{ backgroundColor: tone }}
                                >
                                    {busy === p.key ? "جارٍ التحويل..." : `ارقِ إلى ${p.name}`}
                                    {busy !== p.key && <ArrowRight className="w-3.5 h-3.5 rotate-180" />}
                                </button>
                            )}
                            {isCurrent && (
                                <button onClick={() => nav("/billing")} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 text-sm text-white/70 font-heading font-bold">
                                    إدارة الاشتراك
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
