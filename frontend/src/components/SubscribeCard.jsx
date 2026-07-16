import { useEffect, useState } from "react";
import { Sparkles, Check, Loader2, Crown, X } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import MoyasarCheckout from "./MoyasarCheckout";

/**
 * Renders the subscribe CTA on a creator's profile.
 * Also handles the creator's own plan-editing flow when isOwner=true.
 */
export default function SubscribeCard({ creatorUsername, creatorId, isOwner }) {
    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mySubs, setMySubs] = useState([]);
    const [busy, setBusy] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [checkoutIntent, setCheckoutIntent] = useState(null);
    const { user } = useAuth();

    const loadPlan = () => {
        setLoading(true);
        api.get(`/creators/${creatorUsername}/subscription-plan`)
            .then((r) => setPlan(r.data))
            .catch(() => setPlan(null))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadPlan();
        if (user && !isOwner) {
            api.get("/subscriptions/me").then((r) => setMySubs(r.data || [])).catch(() => {});
        }
    }, [creatorUsername, user, isOwner]);

    const activeSub = mySubs.find(
        (s) => s.creator_username === creatorUsername && ["active", "pending"].includes(s.status)
    );

    const subscribe = async () => {
        if (!user) return toast.error("سجّل دخول للاشتراك");
        setBusy(true);
        try {
            const r = await api.post(`/creators/${creatorUsername}/subscribe`, { method: "creditcard" });
            setCheckoutIntent(r.data.intent);
        } catch (e) {
            toast.error(e?.response?.data?.detail?.message || e?.response?.data?.detail || "تعذّر إنشاء الاشتراك");
        } finally {
            setBusy(false);
        }
    };

    if (loading) return null;

    // OWNER without a plan → show call-to-action
    if (isOwner && !plan) {
        return (
            <>
                <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-2xl p-4" data-testid="setup-plan-cta">
                    <div className="flex items-center gap-3">
                        <Crown className="w-6 h-6 text-purple-400 flex-shrink-0" />
                        <div className="flex-1">
                            <div className="font-heading font-black text-white text-sm">فعّل خطّة اشتراك شهرية</div>
                            <div className="text-[11px] text-white/60 mt-0.5">اسمح لمعجبيك بدعمك شهرياً واستمتع بدخل ثابت.</div>
                        </div>
                        <button
                            data-testid="open-edit-plan"
                            onClick={() => setShowEdit(true)}
                            className="text-xs bg-purple-500 hover:bg-purple-600 text-white rounded-full px-3 py-1.5 font-heading font-bold transition"
                        >
                            ابدأ
                        </button>
                    </div>
                </div>
                {showEdit && <PlanEditModal existing={null} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); loadPlan(); }} />}
            </>
        );
    }

    if (!plan) return null; // fan viewing profile without a plan → hide

    return (
        <>
            <div
                data-testid="subscribe-card"
                className="bg-gradient-to-br from-purple-500/15 via-transparent to-pink-500/15 border border-purple-500/30 rounded-2xl p-4 relative overflow-hidden"
            >
                <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative">
                    <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <div className="font-heading font-black text-white text-sm">{plan.title}</div>
                                <div className="text-[10px] text-white/50">دعم شهري متجدّد</div>
                            </div>
                        </div>
                        <div className="text-end">
                            <div className="font-heading font-black text-white text-xl leading-none">{plan.price_sar}</div>
                            <div className="text-[10px] text-white/50">ريال / شهر</div>
                        </div>
                    </div>

                    {plan.perks?.length > 0 && (
                        <ul className="space-y-1.5 mb-4">
                            {plan.perks.map((p, i) => (
                                <li key={i} className="text-[12px] text-white/80 font-body flex items-center gap-2">
                                    <Check className="w-3.5 h-3.5 text-[#C3E0A5] flex-shrink-0" />
                                    <span>{p}</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    {isOwner ? (
                        <button
                            data-testid="edit-plan-btn"
                            onClick={() => setShowEdit(true)}
                            className="w-full bg-white/10 hover:bg-white/20 text-white rounded-full py-2.5 font-heading font-bold text-sm transition"
                        >
                            تعديل الخطّة
                        </button>
                    ) : activeSub ? (
                        <div className="w-full bg-[#C3E0A5]/15 border border-[#C3E0A5]/30 text-[#C3E0A5] rounded-full py-2.5 font-heading font-bold text-sm text-center" data-testid="already-subscribed">
                            أنت مشترك ✨
                        </div>
                    ) : (
                        <button
                            data-testid="subscribe-btn"
                            onClick={subscribe}
                            disabled={busy}
                            className="w-full bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-60 text-white rounded-full py-2.5 font-heading font-black text-sm transition flex items-center justify-center gap-2"
                        >
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            اشترك الآن
                        </button>
                    )}
                </div>
            </div>

            {showEdit && (
                <PlanEditModal
                    existing={plan}
                    onClose={() => setShowEdit(false)}
                    onSaved={() => { setShowEdit(false); loadPlan(); }}
                />
            )}

            {checkoutIntent && (
                <MoyasarCheckout
                    open
                    intent={checkoutIntent}
                    onClose={() => setCheckoutIntent(null)}
                />
            )}
        </>
    );
}

function PlanEditModal({ existing, onClose, onSaved }) {
    const [price, setPrice] = useState(existing?.price_sar || 49);
    const [title, setTitle] = useState(existing?.title || "اشتراك شهري");
    const [perks, setPerks] = useState(existing?.perks?.length ? existing.perks : ["محتوى حصري شهري", "تواصل مباشر معي"]);
    const [active, setActive] = useState(existing?.active !== false);
    const [busy, setBusy] = useState(false);

    const addPerk = () => setPerks([...perks, ""]);
    const removePerk = (i) => setPerks(perks.filter((_, idx) => idx !== i));
    const updatePerk = (i, v) => setPerks(perks.map((p, idx) => (idx === i ? v : p)));

    const save = async () => {
        if (price < 5 || price > 5000) return toast.error("السعر بين 5 و 5000 ريال");
        setBusy(true);
        try {
            await api.put("/creators/me/subscription-plan", {
                price_sar: parseInt(price, 10),
                title: title.trim(),
                perks: perks.map((p) => p.trim()).filter(Boolean),
                active,
            });
            toast.success("تم حفظ خطّة الاشتراك");
            onSaved();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "تعذّر الحفظ");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose} data-testid="plan-edit-modal">
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-heading font-black text-base text-white">خطّة الاشتراك</h3>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 transition" data-testid="close-plan-edit">
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="text-[11px] text-white/60 font-heading font-bold mb-1 block">العنوان</label>
                        <input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="plan-title" className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-purple-500/50 focus:outline-none" />
                    </div>
                    <div>
                        <label className="text-[11px] text-white/60 font-heading font-bold mb-1 block">السعر الشهري (ريال)</label>
                        <input type="number" min="5" max="5000" value={price} onChange={(e) => setPrice(e.target.value)} data-testid="plan-price" className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-purple-500/50 focus:outline-none" />
                    </div>
                    <div>
                        <label className="text-[11px] text-white/60 font-heading font-bold mb-1 block">ماذا يحصل المشترك؟</label>
                        <div className="space-y-1.5">
                            {perks.map((p, i) => (
                                <div key={i} className="flex gap-1.5" data-testid={`perk-row-${i}`}>
                                    <input value={p} onChange={(e) => updatePerk(i, e.target.value)} placeholder="مثال: محتوى حصري أسبوعي" className="flex-1 bg-[#141414] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/40 focus:border-purple-500/50 focus:outline-none" />
                                    <button onClick={() => removePerk(i)} className="px-3 bg-white/5 hover:bg-red-500/20 border border-white/10 rounded-xl transition">
                                        <X className="w-3.5 h-3.5 text-white/60" />
                                    </button>
                                </div>
                            ))}
                            {perks.length < 8 && (
                                <button onClick={addPerk} data-testid="add-perk" className="text-xs text-purple-400 hover:text-purple-300 font-heading font-bold py-1">
                                    + إضافة ميزة
                                </button>
                            )}
                        </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer" data-testid="plan-active-wrapper">
                        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} data-testid="plan-active" className="accent-purple-500 w-4 h-4" />
                        الخطّة مفعّلة (يمكن للمعجبين الاشتراك)
                    </label>
                </div>

                <button
                    data-testid="save-plan"
                    onClick={save}
                    disabled={busy}
                    className="mt-5 w-full bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-60 text-white rounded-full py-3 font-heading font-black transition flex items-center justify-center gap-2"
                >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    حفظ الخطّة
                </button>
            </div>
        </div>
    );
}
