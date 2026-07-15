import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { MapPin, Users2, DollarSign, Check, X, Wifi } from "lucide-react";

const AMEN_LABELS = { wifi: "واي فاي", projector: "بروجكتر", whiteboard: "سبورة", coffee: "قهوة", parking: "موقف", sound_system: "نظام صوتي", camera_setup: "كاميرا", green_screen: "شاشة خضراء" };

export default function SpaceDetail() {
    const { id } = useParams();
    const nav = useNavigate();
    const [s, setS] = useState(null);
    const [start, setStart] = useState("");
    const [end, setEnd] = useState("");
    const [avail, setAvail] = useState(null);
    const [busy, setBusy] = useState(false);
    const [notes, setNotes] = useState("");

    useEffect(() => {
        api.get(`/booking/spaces/${id}`).then((r) => setS(r.data)).catch(() => { toast.error("المساحة غير موجودة"); nav("/booking"); });
    }, [id, nav]);

    useEffect(() => {
        if (!start || !end) { setAvail(null); return; }
        api.get(`/booking/spaces/${id}/availability?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)
            .then((r) => setAvail(r.data.available))
            .catch(() => setAvail(null));
    }, [id, start, end]);

    if (!s) return <div className="p-8 text-white/50 text-center">جارٍ التحميل...</div>;

    const hours = start && end ? Math.max(0, (new Date(end) - new Date(start)) / 3600000) : 0;
    const total = (hours * (s.price_per_hour || 0)).toFixed(2);

    const book = async () => {
        if (!start || !end) return toast.error("اختر توقيت البدء والانتهاء");
        if (avail === false) return toast.error("الوقت محجوز — اختر وقتاً آخر");
        setBusy(true);
        try {
            const r = await api.post(`/booking/spaces/${id}/book`, {
                start_time: new Date(start).toISOString(),
                end_time: new Date(end).toISOString(),
                notes,
                origin_url: window.location.origin,
            });
            window.location.href = r.data.url;
        } catch (e) {
            toast.error(e.response?.data?.detail || "خطأ في إنشاء الحجز");
            setBusy(false);
        }
    };

    return (
        <div className="p-4 pt-14 pb-24 space-y-4" data-testid="space-detail">
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <div className="h-40 bg-gradient-to-br from-[#D1795F]/20 to-[#57769D]/20 flex items-center justify-center text-6xl">
                    {s.images?.[0] ? <img src={s.images[0]} alt="" className="w-full h-full object-cover" /> : "🏛️"}
                </div>
                <div className="p-4 space-y-2">
                    <h1 className="font-heading font-black text-xl text-white">{s.name}</h1>
                    <div className="text-xs text-white/60 flex items-center gap-1"><MapPin className="w-3 h-3" /> {s.location}{s.address ? ` · ${s.address}` : ""}</div>
                    <div className="flex items-center gap-3 text-xs">
                        <span className="text-[#D1795F] font-heading font-black text-lg flex items-center"><DollarSign className="w-3.5 h-3.5" />{s.price_per_hour}<span className="text-[10px] text-white/40 mr-1">/ساعة</span></span>
                        <span className="text-white/50 flex items-center gap-1"><Users2 className="w-3 h-3" /> حتى {s.capacity} أشخاص</span>
                    </div>
                    {s.description && <p className="text-sm text-white/80 leading-relaxed font-body pt-2">{s.description}</p>}
                    {s.amenities?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2">
                            {s.amenities.map((a) => (
                                <span key={a} className="text-[10px] bg-[#57769D]/15 text-[#8BA6D0] border border-[#57769D]/30 px-2 py-1 rounded-full flex items-center gap-1">
                                    <Check className="w-2.5 h-2.5" /> {AMEN_LABELS[a] || a}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Booking form */}
            <div className="bg-gradient-to-br from-[#D1795F]/10 to-transparent border border-[#D1795F]/20 rounded-2xl p-4 space-y-3">
                <h3 className="font-heading font-bold text-sm text-white">احجز الآن</h3>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[10px] text-white/50 mb-1 block">البدء</label>
                        <input data-testid="book-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none" />
                    </div>
                    <div>
                        <label className="text-[10px] text-white/50 mb-1 block">الانتهاء</label>
                        <input data-testid="book-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none" />
                    </div>
                </div>
                <textarea placeholder="ملاحظات (اختياري)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none resize-none" />
                {avail !== null && (
                    <div className={`text-[11px] flex items-center gap-1 ${avail ? "text-[#C3E0A5]" : "text-red-400"}`}>
                        {avail ? <><Check className="w-3 h-3" /> الوقت متاح</> : <><X className="w-3 h-3" /> الوقت محجوز — جرّب وقتاً آخر</>}
                    </div>
                )}
                {hours > 0 && (
                    <div className="bg-black/40 rounded-xl p-3 text-sm flex items-center justify-between">
                        <span className="text-white/60">{hours.toFixed(1)} ساعة</span>
                        <span className="text-[#D1795F] font-heading font-black text-lg">${total}</span>
                    </div>
                )}
                <button
                    data-testid="book-confirm"
                    onClick={book}
                    disabled={busy || avail === false || hours <= 0}
                    className="w-full bg-[#D1795F] hover:bg-[#B86648] disabled:opacity-50 disabled:cursor-not-allowed text-white font-heading font-bold rounded-xl py-3 text-sm active:scale-95 transition"
                >
                    {busy ? "جارٍ التحويل..." : hours > 0 ? `احجز — $${total}` : "اختر وقتاً"}
                </button>
                <p className="text-[9px] text-white/40 text-center">الدفع عبر Stripe الآمن — QR للدخول بعد الدفع</p>
            </div>

            {s.owner && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#57769D]/30 overflow-hidden flex-shrink-0 flex items-center justify-center text-white font-heading font-bold">
                        {s.owner.avatar_url ? <img src={s.owner.avatar_url} alt="" className="w-full h-full object-cover" /> : (s.owner.name?.[0] || "?")}
                    </div>
                    <div>
                        <div className="text-xs text-white/50">صاحب المساحة</div>
                        <div className="font-heading font-bold text-sm text-white">{s.owner.name}</div>
                    </div>
                </div>
            )}
        </div>
    );
}
