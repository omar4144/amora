import { useEffect, useState } from "react";
import { X, Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

/**
 * Reusable "report content / user" modal.
 * Usage: <ReportModal targetType="video" targetId={v.id} onClose={...} />
 * targetType ∈ {video, user, comment, message, service, community_post}
 */
export default function ReportModal({ targetType, targetId, targetLabel, onClose }) {
    const [reasons, setReasons] = useState([]);
    const [reason, setReason] = useState("");
    const [details, setDetails] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api.get("/moderation/meta").then((r) => setReasons(r.data.reasons || []));
    }, []);

    const submit = async () => {
        if (!reason) return toast.error("اختر سبب الإبلاغ");
        setBusy(true);
        try {
            await api.post("/reports", {
                target_type: targetType,
                target_id: targetId,
                reason,
                details: details.trim(),
            });
            toast.success("تم إرسال البلاغ. سنراجعه قريباً.");
            onClose?.();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "تعذّر إرسال البلاغ");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={onClose}
            data-testid="report-modal"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5"
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center">
                            <Flag className="w-4 h-4 text-red-400" />
                        </div>
                        <div>
                            <h3 className="font-heading font-black text-base text-white">الإبلاغ عن المحتوى</h3>
                            {targetLabel && <p className="text-[11px] text-white/50">{targetLabel}</p>}
                        </div>
                    </div>
                    <button data-testid="close-report" onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 transition">
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                <p className="text-xs text-white/60 mb-3 font-body leading-relaxed">
                    اختر السبب الأكثر ملاءمة. جميع البلاغات سرّية ونراجعها يدوياً.
                </p>

                <div className="space-y-1.5 mb-4 max-h-56 overflow-y-auto">
                    {reasons.map((r) => (
                        <label
                            key={r.key}
                            data-testid={`report-reason-${r.key}`}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                                reason === r.key
                                    ? "bg-red-500/10 border-red-500/40"
                                    : "bg-white/[0.03] border-white/10 hover:bg-white/5"
                            }`}
                        >
                            <input
                                type="radio"
                                name="reason"
                                checked={reason === r.key}
                                onChange={() => setReason(r.key)}
                                className="accent-red-500"
                            />
                            <span className="text-sm text-white font-body">{r.label}</span>
                        </label>
                    ))}
                </div>

                <textarea
                    data-testid="report-details"
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="تفاصيل إضافية (اختياري)"
                    rows={3}
                    maxLength={2000}
                    className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/40 focus:border-red-500/50 focus:outline-none resize-none mb-4"
                />

                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-full py-2.5 font-heading font-bold text-sm transition"
                    >
                        إلغاء
                    </button>
                    <button
                        data-testid="submit-report"
                        onClick={submit}
                        disabled={busy || !reason}
                        className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-full py-2.5 font-heading font-bold text-sm transition flex items-center justify-center gap-2"
                    >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
                        إرسال البلاغ
                    </button>
                </div>
            </div>
        </div>
    );
}
