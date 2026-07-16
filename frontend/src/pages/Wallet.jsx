import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import {
    Wallet as WalletIcon, ArrowUpCircle, Heart, Users, ShoppingBag,
    Building2, ChevronLeft, TrendingUp, Loader2, X,
} from "lucide-react";

export default function Wallet() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showPayout, setShowPayout] = useState(false);
    const nav = useNavigate();

    const load = () => {
        setLoading(true);
        api.get("/wallet")
            .then((r) => { setData(r.data); setLoading(false); })
            .catch(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);

    if (loading) {
        return (
            <div className="min-h-[100dvh] bg-black flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-white/50" />
            </div>
        );
    }

    const balance = data?.balance || {};
    const breakdown = balance.breakdown || {};

    return (
        <div className="min-h-[100dvh] bg-black text-white pb-24" data-testid="wallet-page">
            {/* Header hero */}
            <div className="bg-gradient-to-br from-[#D1795F] via-[#C3E0A5]/40 to-[#57769D] px-5 pt-12 pb-8 relative overflow-hidden">
                <div className="absolute inset-0 bg-black/40" />
                <div className="relative">
                    <button
                        onClick={() => nav(-1)}
                        data-testid="wallet-back"
                        className="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center mb-6 hover:bg-black/60 transition"
                    >
                        <ChevronLeft className="w-5 h-5 rotate-180" />
                    </button>
                    <div className="flex items-center gap-2 mb-2">
                        <WalletIcon className="w-4 h-4 text-white/80" />
                        <span className="text-xs text-white/80 font-heading font-bold">محفظتي</span>
                    </div>
                    <div className="text-4xl font-heading font-black" data-testid="wallet-available">
                        {balance.available_sar?.toLocaleString("ar") || 0} <span className="text-lg opacity-70">ريال</span>
                    </div>
                    <p className="text-xs text-white/70 mt-1 font-body">الرصيد المتاح للسحب</p>

                    <button
                        data-testid="request-payout-btn"
                        onClick={() => setShowPayout(true)}
                        disabled={(balance.available_sar || 0) < 50}
                        className="mt-4 bg-white text-black font-heading font-black rounded-full px-6 py-2.5 flex items-center gap-2 hover:bg-white/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ArrowUpCircle className="w-4 h-4" />
                        اسحب إلى حسابي البنكي
                    </button>
                    {(balance.available_sar || 0) < 50 && (
                        <p className="text-[10px] text-white/60 mt-2">الحد الأدنى للسحب 50 ريال</p>
                    )}
                </div>
            </div>

            {/* Breakdown */}
            <div className="px-4 -mt-4 relative">
                <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-4">
                    <h3 className="font-heading font-black text-sm mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-[#C3E0A5]" />
                        تفصيل الأرباح
                    </h3>
                    <div className="space-y-3">
                        <BreakdownRow icon={Heart} label="الإكراميات" value={breakdown.tips_sar || 0} color="#EF4444" testid="breakdown-tips" />
                        <BreakdownRow icon={Users} label="الاشتراكات" value={breakdown.subscriptions_sar || 0} color="#8B5CF6" testid="breakdown-subs" />
                        <BreakdownRow icon={ShoppingBag} label="الخدمات والطلبات" value={breakdown.services_sar || 0} color="#D1795F" testid="breakdown-services" />
                    </div>
                </div>
            </div>

            {/* Recent tips */}
            {data?.recent_tips?.length > 0 && (
                <div className="px-4 mt-6">
                    <h3 className="font-heading font-black text-sm mb-3 flex items-center gap-2">
                        <Heart className="w-4 h-4 text-red-400" />
                        آخر الإكراميات
                    </h3>
                    <div className="space-y-2">
                        {data.recent_tips.map((t) => (
                            <div key={t.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3" data-testid={`tip-row-${t.id}`}>
                                <div className="w-9 h-9 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                                    <Heart className="w-4 h-4 text-red-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-heading font-bold text-white truncate">
                                        @{t.sender_username || "مستخدم"}
                                    </div>
                                    {t.message && <div className="text-[11px] text-white/60 truncate">{t.message}</div>}
                                    <div className="text-[10px] text-white/40 mt-0.5">{new Date(t.created_at).toLocaleDateString("ar")}</div>
                                </div>
                                <div className="font-heading font-black text-sm text-[#C3E0A5]">
                                    +{(t.creator_earnings_halalas / 100).toFixed(0)} <span className="text-[10px]">ر.س</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Payouts history */}
            <div className="px-4 mt-6">
                <h3 className="font-heading font-black text-sm mb-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-white/70" />
                    طلبات السحب
                </h3>
                {(!data?.payouts || data.payouts.length === 0) ? (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                        <p className="text-white/50 text-sm">لم تقم بأي طلب سحب بعد</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {data.payouts.map((p) => (
                            <PayoutRow key={p.id} p={p} />
                        ))}
                    </div>
                )}
            </div>

            {showPayout && (
                <PayoutModal
                    availableSar={balance.available_sar || 0}
                    onClose={() => setShowPayout(false)}
                    onSuccess={() => { setShowPayout(false); load(); }}
                />
            )}
        </div>
    );
}

function BreakdownRow({ icon: Icon, label, value, color, testid }) {
    return (
        <div className="flex items-center gap-3" data-testid={testid}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}20`, color }}>
                <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 text-sm text-white/80 font-body">{label}</div>
            <div className="font-heading font-black text-white">
                {value.toLocaleString("ar")} <span className="text-[10px] opacity-60">ر.س</span>
            </div>
        </div>
    );
}

function PayoutRow({ p }) {
    const statusMeta = {
        pending:    { label: "قيد المراجعة", color: "#F59E0B", bg: "#F59E0B20" },
        processing: { label: "قيد التحويل",   color: "#57769D", bg: "#57769D20" },
        paid:       { label: "تم التحويل",    color: "#C3E0A5", bg: "#C3E0A520" },
        failed:     { label: "فشل",           color: "#EF4444", bg: "#EF444420" },
    };
    const meta = statusMeta[p.status] || statusMeta.pending;
    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3" data-testid={`payout-${p.id}`}>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-heading font-black text-white text-sm">{p.amount_sar.toLocaleString("ar")} ر.س</span>
                    <span className="text-[10px] font-heading font-bold px-2 py-0.5 rounded-full" style={{ color: meta.color, backgroundColor: meta.bg }}>
                        {meta.label}
                    </span>
                </div>
                <div className="text-[10px] text-white/50 truncate ltr:font-mono">{p.iban}</div>
                <div className="text-[10px] text-white/40">{new Date(p.created_at).toLocaleDateString("ar")}</div>
            </div>
        </div>
    );
}

function PayoutModal({ availableSar, onClose, onSuccess }) {
    const [amount, setAmount] = useState("");
    const [iban, setIban] = useState("SA");
    const [name, setName] = useState("");
    const [mobile, setMobile] = useState("");
    const [city, setCity] = useState("Riyadh");
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        const amt = parseInt(amount, 10);
        if (!amt || amt < 50) return toast.error("الحد الأدنى للسحب 50 ريال");
        if (amt > availableSar) return toast.error(`الرصيد المتاح ${availableSar} ريال فقط`);
        if (!iban.startsWith("SA") || iban.length < 15) return toast.error("رقم آيبان غير صالح");
        if (!name.trim()) return toast.error("أدخل اسم المستفيد");
        if (!mobile.trim()) return toast.error("أدخل رقم الجوال");
        setBusy(true);
        try {
            await api.post("/wallet/payout", {
                amount_sar: amt,
                iban: iban.replace(/\s/g, ""),
                beneficiary_name: name.trim(),
                mobile: mobile.trim(),
                city: city.trim(),
            });
            toast.success("تم إرسال طلب السحب — ستصلك التحويلات خلال 1-3 أيام عمل");
            onSuccess();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "تعذّر إرسال الطلب");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={onClose}
            data-testid="payout-modal"
        >
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-[#C3E0A5]/20 flex items-center justify-center">
                            <ArrowUpCircle className="w-4 h-4 text-[#C3E0A5]" />
                        </div>
                        <div>
                            <h3 className="font-heading font-black text-base text-white">سحب إلى حسابي البنكي</h3>
                            <p className="text-[11px] text-white/50">الرصيد المتاح: {availableSar.toLocaleString("ar")} ريال</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 transition" data-testid="close-payout">
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                <div className="space-y-3">
                    <Field label="المبلغ (ريال)" testid="payout-amount">
                        <input type="number" min="50" max={availableSar} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="مثال: 500" data-testid="payout-amount-input" className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/40 focus:border-[#C3E0A5]/50 focus:outline-none" />
                    </Field>
                    <Field label="رقم الآيبان (يبدأ بـ SA)" testid="payout-iban">
                        <input type="text" value={iban} onChange={(e) => setIban(e.target.value.toUpperCase().replace(/\s/g, ""))} placeholder="SA00 0000 0000 0000 0000 0000" data-testid="payout-iban-input" dir="ltr" className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/40 focus:border-[#C3E0A5]/50 focus:outline-none font-mono" />
                    </Field>
                    <Field label="اسم المستفيد (كما في البنك)" testid="payout-name">
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} data-testid="payout-name-input" className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-[#C3E0A5]/50 focus:outline-none" />
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                        <Field label="رقم الجوال" testid="payout-mobile">
                            <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="05XXXXXXXX" data-testid="payout-mobile-input" dir="ltr" className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/40 focus:border-[#C3E0A5]/50 focus:outline-none font-mono" />
                        </Field>
                        <Field label="المدينة" testid="payout-city">
                            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} data-testid="payout-city-input" className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-[#C3E0A5]/50 focus:outline-none" />
                        </Field>
                    </div>
                </div>

                <button
                    data-testid="submit-payout"
                    onClick={submit}
                    disabled={busy}
                    className="mt-5 w-full bg-[#C3E0A5] hover:bg-[#B0D090] disabled:opacity-60 text-black rounded-full py-3 font-heading font-black transition flex items-center justify-center gap-2"
                >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpCircle className="w-4 h-4" />}
                    {busy ? "لحظة..." : "إرسال طلب السحب"}
                </button>

                <p className="text-[10px] text-white/40 text-center mt-3 leading-relaxed">
                    التحويل خلال 1-3 أيام عمل. تُحتسب رسوم البنك (إن وُجدت) على حسابك.
                </p>
            </div>
        </div>
    );
}

function Field({ label, testid, children }) {
    return (
        <div data-testid={testid}>
            <label className="text-[11px] text-white/60 font-heading font-bold mb-1 block">{label}</label>
            {children}
        </div>
    );
}
