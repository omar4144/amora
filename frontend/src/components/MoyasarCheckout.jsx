import { useEffect, useRef, useState } from "react";
import { X, Loader2, ShieldCheck } from "lucide-react";

const MOYASAR_JS = "https://cdn.moyasar.com/mpf/1.7.3/moyasar.js";
const MOYASAR_CSS = "https://cdn.moyasar.com/mpf/1.7.3/moyasar.css";

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
 * Renders Moyasar's hosted card form (Moyasar.js) using an intent
 * returned by our backend. The intent shape is:
 * {
 *   amount_halalas, description, publishable_key, callback_url,
 *   given_id, metadata, methods, save_card?
 * }
 *
 * The card data NEVER touches our servers — Moyasar.js POSTs directly
 * to Moyasar and redirects the user to `callback_url` after 3-D Secure.
 */
export default function MoyasarCheckout({ open, onClose, intent }) {
    const formRef = useRef(null);
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open || !intent || !formRef.current) return;
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
                        amount: intent.amount_halalas,
                        currency: "SAR",
                        description: intent.description,
                        publishable_api_key: intent.publishable_key,
                        callback_url: intent.callback_url,
                        methods: intent.methods && intent.methods.length ? intent.methods : ["creditcard", "applepay", "stcpay"],
                        supported_networks: ["mada", "visa", "mastercard"],
                        credit_card: { save_card: !!intent.save_card },
                        apple_pay: { country: "SA", label: "Amora" },
                        language: "ar",
                        metadata: { ...(intent.metadata || {}), given_id: intent.given_id },
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
    }, [open, intent]);

    if (!open || !intent) return null;

    const amountSar = Math.round((intent.amount_halalas || 0) / 100);

    return (
        <div
            className="fixed inset-0 z-[85] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
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
                            <h3 className="font-heading font-black text-base text-white">إتمام الدفع</h3>
                            <p className="text-[11px] text-white/50">{amountSar.toLocaleString("ar")} ريال · مؤمّن عبر ميسر</p>
                        </div>
                    </div>
                    <button data-testid="close-checkout" onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 transition">
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {error ? (
                    <div className="py-10 text-center">
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                ) : (
                    <>
                        {busy && (
                            <div className="py-8 flex items-center justify-center gap-2 text-white/50 text-sm">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                جارٍ تحضير نموذج الدفع الآمن...
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
