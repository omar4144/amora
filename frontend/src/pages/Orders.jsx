import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { Package, CheckCircle2, Clock, DollarSign, User, Star } from "lucide-react";
import { OpenDisputeButton } from "@/pages/disputes/Disputes";

const STATUS_LABELS = {
    pending_payment: { label: "بانتظار الدفع", color: "text-yellow-400", icon: Clock },
    paid: { label: "مدفوع", color: "text-blue-400", icon: DollarSign },
    delivered: { label: "تم التسليم", color: "text-green-400", icon: CheckCircle2 },
    completed: { label: "مكتمل", color: "text-green-400", icon: CheckCircle2 },
};

const ReviewModal = ({ order, onClose, onSubmit }) => {
    const [rating, setRating] = useState(5);
    const [text, setText] = useState("");
    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-2xl p-6" data-testid="review-modal">
                <h3 className="font-heading font-black text-xl mb-4">قيّم الخدمة</h3>
                <div className="flex justify-center gap-2 mb-4">
                    {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} data-testid={`star-${n}`} onClick={() => setRating(n)}>
                            <Star className={`w-9 h-9 ${n <= rating ? "text-[#D1795F] fill-[#D1795F]" : "text-neutral-700"}`} />
                        </button>
                    ))}
                </div>
                <textarea
                    data-testid="review-text"
                    value={text} onChange={(e) => setText(e.target.value)}
                    rows={3} placeholder="اكتب تعليقك..."
                    className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#D1795F] focus:outline-none resize-none mb-4"
                />
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 bg-white/10 rounded-full py-3 font-heading font-bold">إلغاء</button>
                    <button data-testid="submit-review" onClick={() => onSubmit(rating, text)} className="flex-1 bg-[#D1795F] text-white rounded-full py-3 font-heading font-bold">إرسال</button>
                </div>
            </div>
        </div>
    );
};

const OrderCard = ({ o, isCreator, onDeliver, onPay, onReview }) => {
    const s = STATUS_LABELS[o.status] || STATUS_LABELS.pending_payment;
    const Icon = s.icon;
    return (
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 mb-3" data-testid={`order-${o.id}`}>
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                    <div className="font-heading font-bold">{o.service?.title || "خدمة"}</div>
                    <div className="text-xs text-neutral-500 mt-1 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {isCreator ? `العميل: @${o.client?.username}` : `المصمم: @${o.creator?.username}`}
                    </div>
                </div>
                <div className="text-[#D1795F] font-heading font-black text-xl">${o.amount}</div>
            </div>
            <div className={`flex items-center gap-1 text-sm ${s.color} mb-3`}>
                <Icon className="w-4 h-4" />
                {s.label}
            </div>
            {o.notes && <div className="text-sm text-neutral-400 bg-black/40 rounded-lg p-2 mb-3">{o.notes}</div>}
            {!isCreator && o.payment_status === "unpaid" && (
                <button
                    onClick={() => onPay(o.id)}
                    data-testid={`pay-btn-${o.id}`}
                    className="w-full bg-[#D1795F] text-white font-heading font-bold rounded-full py-2.5 hover:bg-[#B86648] transition"
                >
                    دفع ${o.amount}
                </button>
            )}
            {!isCreator && o.status === "delivered" && !o.reviewed && (
                <button
                    onClick={() => onReview(o)}
                    data-testid={`review-btn-${o.id}`}
                    className="w-full bg-white/10 hover:bg-white/20 text-white font-heading font-bold rounded-full py-2.5 transition mt-2 flex items-center justify-center gap-2"
                >
                    <Star className="w-4 h-4" />
                    قيّم الخدمة
                </button>
            )}
            {isCreator && o.status === "paid" && (
                <button
                    onClick={() => onDeliver(o.id)}
                    data-testid={`deliver-btn-${o.id}`}
                    className="w-full bg-[#D1795F] text-white font-heading font-bold rounded-full py-2.5 hover:bg-[#B86648] transition"
                >
                    تأكيد التسليم
                </button>
            )}
            {!isCreator && (o.status === "paid" || o.status === "delivered") && !o.disputed && (
                <div className="mt-2">
                    <OpenDisputeButton orderId={o.id} onOpened={() => window.location.reload()} />
                </div>
            )}
            {o.disputed && o.dispute_id && (
                <a href={`/disputes/${o.dispute_id}`} data-testid={`view-dispute-${o.id}`} className="mt-2 block text-center text-xs bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg py-2">
                    عرض النزاع
                </a>
            )}
        </div>
    );
};

export default function Orders() {
    const [tab, setTab] = useState("as_client");
    const [data, setData] = useState({ as_client: [], as_creator: [] });
    const [params, setParams] = useSearchParams();
    const [reviewOrder, setReviewOrder] = useState(null);

    const load = async () => {
        const r = await api.get("/orders/my");
        // Merge reviewed flag
        const reviews = await api.get("/orders/reviewed-ids").catch(() => ({ data: [] }));
        const reviewedSet = new Set(reviews.data || []);
        const mark = (arr) => arr.map((o) => ({ ...o, reviewed: reviewedSet.has(o.id) }));
        setData({ as_client: mark(r.data.as_client), as_creator: mark(r.data.as_creator) });
    };

    useEffect(() => {
        load();
        const sid = params.get("session_id");
        if (sid) {
            toast.loading("جارٍ التحقق من الدفع...", { id: "pay" });
            const poll = async (attempts = 0) => {
                if (attempts >= 8) {
                    toast.error("انتهت مهلة التحقق", { id: "pay" });
                    return;
                }
                try {
                    const res = await api.get(`/payments/status/${sid}`);
                    if (res.data.payment_status === "paid") {
                        toast.success("تم الدفع بنجاح!", { id: "pay" });
                        load();
                        params.delete("session_id");
                        setParams(params);
                        return;
                    }
                    if (res.data.status === "expired") {
                        toast.error("انتهت صلاحية الجلسة", { id: "pay" });
                        return;
                    }
                    setTimeout(() => poll(attempts + 1), 2000);
                } catch {
                    setTimeout(() => poll(attempts + 1), 2000);
                }
            };
            poll();
        }
    }, []);

    const pay = async (orderId) => {
        try {
            const res = await api.post("/payments/checkout", {
                order_id: orderId,
                origin_url: window.location.origin,
            });
            window.location.href = res.data.url;
        } catch (err) {
            toast.error(err?.response?.data?.detail || "خطأ في الدفع");
        }
    };

    const deliver = async (orderId) => {
        try {
            await api.post(`/orders/${orderId}/deliver`);
            toast.success("تم تأكيد التسليم");
            load();
        } catch {
            toast.error("خطأ");
        }
    };

    const submitReview = async (rating, text) => {
        try {
            await api.post("/reviews", { order_id: reviewOrder.id, rating, text });
            toast.success("شكراً لتقييمك");
            setReviewOrder(null);
            load();
        } catch (err) {
            toast.error(err?.response?.data?.detail || "خطأ");
        }
    };

    const list = data[tab] || [];

    return (
        <div className="p-6 pt-8 font-body" data-testid="orders-page">
            <div className="flex items-center gap-2 mb-6">
                <Package className="w-6 h-6 text-[#D1795F]" />
                <h1 className="text-3xl font-heading font-black">طلباتي</h1>
            </div>

            <div className="flex gap-2 bg-neutral-900 p-1 rounded-full mb-6">
                <button
                    data-testid="tab-as-client"
                    onClick={() => setTab("as_client")}
                    className={`flex-1 py-2 rounded-full font-heading font-bold text-sm transition ${tab === "as_client" ? "bg-[#D1795F] text-white" : "text-neutral-400"}`}
                >
                    طلبت ({data.as_client.length})
                </button>
                <button
                    data-testid="tab-as-creator"
                    onClick={() => setTab("as_creator")}
                    className={`flex-1 py-2 rounded-full font-heading font-bold text-sm transition ${tab === "as_creator" ? "bg-[#D1795F] text-white" : "text-neutral-400"}`}
                >
                    استلمت ({data.as_creator.length})
                </button>
            </div>

            {list.length === 0 && (
                <div className="text-center py-16 text-neutral-500">لا توجد طلبات بعد</div>
            )}
            {list.map((o) => (
                <OrderCard key={o.id} o={o} isCreator={tab === "as_creator"} onDeliver={deliver} onPay={pay} onReview={setReviewOrder} />
            ))}

            {reviewOrder && <ReviewModal order={reviewOrder} onClose={() => setReviewOrder(null)} onSubmit={submitReview} />}
        </div>
    );
}
