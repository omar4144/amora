import { useState } from "react";
import { X, Heart, Loader2, CreditCard, Smartphone, Wallet as WalletIcon } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import MoyasarCheckout from "./MoyasarCheckout";

const AMOUNTS = [5, 10, 25, 50, 100, 200];
const METHODS = [
    { key: "creditcard", label: "بطاقة/مدى", icon: CreditCard },
    { key: "applepay", label: "Apple Pay", icon: Smartphone },
    { key: "stcpay", label: "STC Pay", icon: WalletIcon },
];

/**
 * Send a tip to a creator.
 * Props:
 *   creatorUsername (string) — required
 *   videoId (string) — optional
 *   onClose ()
 */
export default function TipModal({ creatorUsername, videoId, onClose }) {
    const [amount, setAmount] = useState(10);
    const [customAmount, setCustomAmount] = useState("");
    const [message, setMessage] = useState("");
    const [method, setMethod] = useState("creditcard");
    const [busy, setBusy] = useState(false);
    const [checkout, setCheckout] = useState(null); // {url, description, amount}

    const finalAmount = customAmount ? parseInt(customAmount, 10) : amount;

    const submit = async () => {
        if (!finalAmount || finalAmount < 5) return toast.error("الحد الأدنى 5 ريال");
        if (finalAmount > 5000) return toast.error("الحد الأعلى 5000 ريال");
        setBusy(true);
        try {
            const r = await api.post("/tips", {
                creator_username: creatorUsername,
                amount_sar: finalAmount,
                message: message.trim(),
                video_id: videoId || null,
                method,
                save_card: false,
            });
            // For live mode: navigate user to Moyasar hosted form via source.transaction_url
            const payment = r.data.payment;
            const url = payment?.source?.transaction_url;
            if (url) {
                toast.success("جارٍ التحويل لصفحة الدفع الآمنة...");
                window.location.href = url;
            } else {
                // Fallback: show Moyasar form embedded
                setCheckout({
                    amount: finalAmount,
                    description: `إكرامية لـ @${creatorUsername}`,
                });
            }
        } catch (e) {
            toast.error(e?.response?.data?.detail?.message || e?.response?.data?.detail || "تعذّر إنشاء الإكرامية");
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <div
                className="fixed inset-0 z-[75] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
                onClick={onClose}
                data-testid="tip-modal"
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                                <Heart className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-heading font-black text-base text-white">ادعم @{creatorUsername}</h3>
                                <p className="text-[11px] text-white/50">إكرامية سريعة كتقدير لمحتواه</p>
                            </div>
                        </div>
                        <button data-testid="close-tip" onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 transition">
                            <X className="w-5 h-5 text-white" />
                        </button>
                    </div>

                    {/* Quick amounts */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                        {AMOUNTS.map((a) => (
                            <button
                                key={a}
                                data-testid={`tip-amount-${a}`}
                                onClick={() => { setAmount(a); setCustomAmount(""); }}
                                className={`py-3 rounded-2xl border transition font-heading font-black ${
                                    !customAmount && amount === a
                                        ? "bg-gradient-to-br from-red-500 to-pink-500 text-white border-transparent shadow-lg shadow-red-500/20"
                                        : "bg-white/5 text-white border-white/10 hover:bg-white/10"
                                }`}
                            >
                                <span className="text-lg">{a}</span>
                                <span className="text-[10px] font-body opacity-70 mr-1">ر.س</span>
                            </button>
                        ))}
                    </div>

                    {/* Custom amount */}
                    <div className="mb-4">
                        <label className="text-[11px] text-white/50 font-heading font-bold mb-1 block">أو حدّد مبلغ آخر (5 - 5000)</label>
                        <input
                            data-testid="tip-custom-amount"
                            type="number"
                            min="5"
                            max="5000"
                            value={customAmount}
                            onChange={(e) => setCustomAmount(e.target.value)}
                            placeholder="مبلغ خاص"
                            className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/40 focus:border-red-500/50 focus:outline-none"
                        />
                    </div>

                    {/* Message */}
                    <textarea
                        data-testid="tip-message"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="رسالة تشجيع (اختياري)"
                        rows={2}
                        maxLength={280}
                        className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/40 focus:border-red-500/50 focus:outline-none resize-none mb-4"
                    />

                    {/* Payment method */}
                    <div className="mb-4">
                        <label className="text-[11px] text-white/50 font-heading font-bold mb-2 block">طريقة الدفع</label>
                        <div className="grid grid-cols-3 gap-1.5">
                            {METHODS.map((m) => {
                                const Icon = m.icon;
                                return (
                                    <button
                                        key={m.key}
                                        data-testid={`tip-method-${m.key}`}
                                        onClick={() => setMethod(m.key)}
                                        className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border transition ${
                                            method === m.key
                                                ? "bg-white/10 border-red-500/50"
                                                : "bg-white/[0.03] border-white/10 hover:bg-white/5"
                                        }`}
                                    >
                                        <Icon className="w-4 h-4 text-white" />
                                        <span className="text-[10px] text-white/80 font-heading font-bold">{m.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <button
                        data-testid="submit-tip"
                        onClick={submit}
                        disabled={busy || !finalAmount}
                        className="w-full bg-gradient-to-br from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 disabled:opacity-60 text-white rounded-full py-3 font-heading font-black transition flex items-center justify-center gap-2"
                    >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
                        {busy ? "لحظة..." : `أرسل ${finalAmount || 0} ريال`}
                    </button>

                    <p className="text-[10px] text-white/40 text-center mt-3">
                        تُخصم عمولة المنصّة 10% ويصل الباقي إلى المبدع مباشرةً.
                    </p>
                </div>
            </div>

            {checkout && (
                <MoyasarCheckout
                    open
                    onClose={() => { setCheckout(null); onClose?.(); }}
                    amountSar={checkout.amount}
                    description={checkout.description}
                    callbackUrl={`${window.location.origin}/wallet?tip_success=1`}
                    methods={[method]}
                />
            )}
        </>
    );
}
