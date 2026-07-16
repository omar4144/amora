import { useEffect, useRef, useState } from "react";
import { X, Loader2, ShieldCheck } from "lucide-react";
import api from "@/lib/api";

const MOYASAR_JS = "https://cdn.moyasar.com/mpf/1.15.0/mpf.js";
const MOYASAR_CSS = "https://cdn.moyasar.com/mpf/1.15.0/mpf.css";

let _cssLoaded = false;
let _jsLoading = null;

function loadMoyasarJs() {
    if (window.Moyasar) return Promise.resolve();
    if (_jsLoading) return _jsLoading;
    if (!_cssLoaded) {
        const l = document.createElement("link");
        l.rel = "stylesheet";
        l.href = MOYASAR_CSS;
        document.head.appendChild(l);
        _cssLoaded = true;
    }
    _jsLoading = new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = MOYASAR_JS;
        s.async = true;
        s.onload = res;
        s.onerror = rej;
        document.body.appendChild(s);
    });
    return _jsLoading;
}

/**
 * Reusable Moyasar checkout drawer.
 *
 * Props:
 *   open (bool), onClose ()
 *   amountSar (number)
 *   description (string)
 *   callbackUrl (absolute URL — where Moyasar redirects post-3DS)
 *   methods (["creditcard","applepay","stcpay"])
 *   saveCard (bool) — for subscriptions
 *   title (string)
 */
export default function MoyasarCheckout({
    open, onClose, amountSar, description, callbackUrl,
    methods = ["creditcard", "applepay", "stcpay"], saveCard = false, title = "الدفع الآمن",
}) {
    const formRef = useRef(null);
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState("");
    const [publishableKey, setPublishableKey] = useState("");
    const [providerEnabled, setProviderEnabled] = useState(true);

    // Fetch backend config once
    useEffect(() => {
        if (!open) return;
        api.get("/moyasar/config")
            .then((r) => {
                setPublishableKey(r.data.publishable_key || "");
                setProviderEnabled(!!r.data.enabled);
            })
            .catch(() => setError("تعذّر تحميل بيانات بوّابة الدفع"));
    }, [open]);

    // Init Moyasar form
    useEffect(() => {
        if (!open || !publishableKey || !formRef.current) return;
        let mounted = true;
        setBusy(true);
        setError("");

        loadMoyasarJs()
            .then(() => {
                if (!mounted || !window.Moyasar || !formRef.current) return;
                formRef.current.innerHTML = "";
                try {
                    window.Moyasar.init({
                        element: formRef.current,
                        amount: amountSar * 100,
                        currency: "SAR",
                        description,
                        publishable_api_key: publishableKey,
                        callback_url: callbackUrl,
                        methods,
                        supported_networks: ["mada", "visa", "mastercard"],
                        credit_card: { save_card: saveCard },
                        apple_pay: { country: "SA", label: "Amora" },
                        language: "ar",
                        on_completed: () => {},
                    });
                    setBusy(false);
                } catch (e) {
                    setError("خطأ في تهيئة نموذج الدفع");
                    setBusy(false);
                }
            })
            .catch(() => {
                setError("تعذّر الاتصال بميسر — تحقّق من الإنترنت");
                setBusy(false);
            });

        return () => { mounted = false; };
    }, [open, publishableKey, amountSar, description, callbackUrl, methods, saveCard]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={onClose}
            data-testid="moyasar-checkout"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto"
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#D1795F] to-[#C3E0A5] flex items-center justify-center">
                            <ShieldCheck className="w-4 h-4 text-black" />
                        </div>
                        <div>
                            <h3 className="font-heading font-black text-base text-white">{title}</h3>
                            <p className="text-[11px] text-white/50">{amountSar.toLocaleString("ar")} ريال · مدفوع عبر ميسر</p>
                        </div>
                    </div>
                    <button data-testid="close-checkout" onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 transition">
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {!providerEnabled ? (
                    <div className="py-10 text-center">
                        <p className="text-amber-400 text-sm font-body mb-2">بوّابة الدفع في مرحلة الإعداد</p>
                        <p className="text-white/50 text-xs">سيتم تفعيلها قريباً بواسطة فريق أمورا.</p>
                    </div>
                ) : error ? (
                    <div className="py-10 text-center">
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                ) : (
                    <>
                        {busy && (
                            <div className="py-8 flex items-center justify-center gap-2 text-white/50 text-sm">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                جارٍ تحضير النموذج...
                            </div>
                        )}
                        <div ref={formRef} className="mysr-form" data-testid="moyasar-form" />
                        <div className="mt-4 flex items-center gap-2 text-[10px] text-white/40 border-t border-white/5 pt-3">
                            <ShieldCheck className="w-3 h-3" />
                            بياناتك محميّة عبر بوّابة ميسر المرخّصة من البنك المركزي السعودي.
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
