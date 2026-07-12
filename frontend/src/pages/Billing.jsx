import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { Crown, Zap, Sparkles, ArrowLeft, Wallet } from "lucide-react";

const ICONS = { free: Sparkles, pro: Zap, business: Crown };
const TONES = { free: "#94A3B8", pro: "#D1795F", business: "#57769D" };

export default function Billing() {
    const [billing, setBilling] = useState(null);
    const [params, setParams] = useSearchParams();
    const [polling, setPolling] = useState(false);
    const nav = useNavigate();

    const load = () => api.get("/billing/me").then((r) => setBilling(r.data));
    useEffect(() => { load(); }, []);

    const pollStatus = useCallback(async (sessionId, attempts = 0) => {
        if (attempts >= 6) { setPolling(false); toast.error("انتهت مهلة التحقق — راجع لوحة الاشتراك"); return; }
        try {
            const r = await api.get(`/billing/status/${sessionId}`);
            if (r.data.payment_status === "paid") {
                toast.success("تم تفعيل خطتك بنجاح 🎉");
                setPolling(false);
                params.delete("session_id");
                setParams(params);
                load();
                return;
            }
            if (r.data.status === "expired") { toast.error("انتهت جلسة الدفع"); setPolling(false); return; }
            setTimeout(() => pollStatus(sessionId, attempts + 1), 2000);
        } catch {
            setTimeout(() => pollStatus(sessionId, attempts + 1), 2000);
        }
    }, [params, setParams]);

    useEffect(() => {
        const sid = params.get("session_id");
        if (sid) { setPolling(true); pollStatus(sid); }
    }, [params, pollStatus]);

    if (!billing) return <div className="p-8 text-white/50 text-center">جارٍ التحميل...</div>;

    const p = billing.plan;
    const Icon = ICONS[p.key] || Sparkles;
    const tone = TONES[p.key] || "#D1795F";
    const usedPct = Math.min(100, (billing.credits_used / (billing.credits_total || 1)) * 100);

    return (
        <div data-testid="billing-page" className="p-4 pb-24 space-y-5">
            {polling && (
                <div className="bg-[#D1795F]/10 border border-[#D1795F]/30 rounded-2xl p-3 text-sm text-white/80 flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-[#D1795F] border-t-transparent animate-spin" />
                    نتحقق من عملية الدفع...
                </div>
            )}

            <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-3xl p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${tone}25`, color: tone }}>
                        <Icon className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-[10px] text-white/50 font-heading font-bold">خطتك الحالية</div>
                        <h2 className="font-heading font-black text-2xl text-white">{p.name}</h2>
                        {billing.expires_at && p.key !== "free" && (
                            <div className="text-[10px] text-white/60 mt-0.5">تنتهي في {new Date(billing.expires_at).toLocaleDateString("ar")}</div>
                        )}
                    </div>
                </div>

                {/* AI credits meter */}
                <div className="bg-black/40 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Wallet className="w-3.5 h-3.5 text-[#D1795F]" />
                        <span className="text-xs text-white/60 font-heading font-bold">استخدام AI هذا الشهر</span>
                    </div>
                    <div className="flex items-baseline gap-2 mb-2">
                        <span className="font-heading font-black text-2xl text-white" data-testid="credits-used">{billing.credits_used}</span>
                        <span className="text-sm text-white/50">/ {billing.credits_total}</span>
                        <span className="text-[10px] text-white/40 mr-auto">{billing.credits_remaining} متبقٍ</span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="h-full transition-all"
                            style={{ width: `${usedPct}%`, backgroundColor: usedPct > 80 ? "#EF4444" : tone }}
                        />
                    </div>
                    {billing.credits_remaining < 5 && (
                        <div className="text-[10px] text-amber-400 mt-2">اقترب رصيدك من النفاد — رقّي خطتك.</div>
                    )}
                </div>
            </div>

            {p.key !== "business" && (
                <button
                    data-testid="see-plans-btn"
                    onClick={() => nav("/pricing")}
                    className="w-full bg-[#D1795F] hover:bg-[#B86648] text-white font-heading font-bold rounded-2xl py-3.5 text-sm flex items-center justify-center gap-2 active:scale-95 transition"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {p.key === "free" ? "شاهد الخطط المدفوعة" : "ارقِ إلى Business"}
                </button>
            )}
        </div>
    );
}
