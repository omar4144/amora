import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api, { API } from "@/lib/api";
import { toast } from "sonner";
import { Calendar, MapPin, QrCode, Plus, X as XIcon, Edit3, Trash2, DollarSign } from "lucide-react";

const AMENITIES = [
    { key: "wifi", label: "واي فاي" },
    { key: "projector", label: "بروجكتر" },
    { key: "whiteboard", label: "سبورة" },
    { key: "coffee", label: "قهوة" },
    { key: "parking", label: "موقف" },
    { key: "sound_system", label: "نظام صوتي" },
    { key: "camera_setup", label: "كاميرا" },
    { key: "green_screen", label: "شاشة خضراء" },
];

const CATEGORIES = [
    { key: "studio", label: "استوديو" },
    { key: "meeting_room", label: "قاعة اجتماعات" },
    { key: "office", label: "مكتب مشترك" },
    { key: "event_hall", label: "قاعة فعاليات" },
];

export function MySpaces() {
    const [spaces, setSpaces] = useState([]);
    const [show, setShow] = useState(false);
    const [editing, setEditing] = useState(null);
    const nav = useNavigate();

    const load = useCallback(() => api.get("/booking/my-spaces").then((r) => setSpaces(r.data)).catch(() => {}), []);
    useEffect(() => { load(); }, [load]);

    const save = async (form) => {
        try {
            if (editing) {
                await api.put(`/booking/spaces/${editing.id}`, form);
                toast.success("تم التحديث");
            } else {
                await api.post("/booking/spaces", form);
                toast.success("تم إنشاء المساحة");
            }
            setShow(false);
            setEditing(null);
            load();
        } catch (e) {
            toast.error(e.response?.data?.detail || "خطأ");
        }
    };

    const remove = async (s) => {
        if (!window.confirm(`حذف "${s.name}"؟ الحجوزات المدفوعة ستبقى.`)) return;
        await api.delete(`/booking/spaces/${s.id}`);
        toast.success("محذوفة");
        load();
    };

    return (
        <div className="p-4 pt-14 pb-24 space-y-4" data-testid="my-spaces-page">
            <div className="flex items-center justify-between">
                <h1 className="font-heading font-black text-2xl text-white">مساحاتي</h1>
                <button data-testid="new-space-btn" onClick={() => { setEditing(null); setShow(true); }} className="bg-[#D1795F] text-white font-heading font-bold rounded-xl px-4 py-2 text-sm flex items-center gap-1">
                    <Plus className="w-4 h-4" /> مساحة
                </button>
            </div>

            {spaces.length === 0 && (
                <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl">
                    <div className="text-4xl mb-2 opacity-40">🏛️</div>
                    <div className="text-sm text-white/50">أضف أول مساحة للإيجار</div>
                </div>
            )}

            <div className="space-y-2">
                {spaces.map((s) => (
                    <div key={s.id} data-testid={`my-space-${s.id}`} className="bg-white/5 border border-white/10 rounded-2xl p-3">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="font-heading font-bold text-sm text-white truncate">{s.name}</div>
                                <div className="text-[10px] text-white/50 flex items-center gap-1 mt-0.5"><MapPin className="w-2.5 h-2.5" /> {s.location}</div>
                                <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                                    <span className="text-[#D1795F] font-heading font-bold">${s.price_per_hour}/ساعة</span>
                                    <span className="text-white/50 flex items-center gap-1"><Calendar className="w-3 h-3" /> {s.bookings_count || 0} حجز</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <button onClick={() => nav(`/booking/spaces/${s.id}/manage`)} className="w-8 h-8 rounded-full bg-[#57769D]/20 hover:bg-[#57769D]/30 flex items-center justify-center" title="الحجوزات">
                                    <Calendar className="w-3.5 h-3.5 text-[#8BA6D0]" />
                                </button>
                                <button onClick={() => { setEditing(s); setShow(true); }} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center">
                                    <Edit3 className="w-3.5 h-3.5 text-white/70" />
                                </button>
                                <button onClick={() => remove(s)} className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center">
                                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {show && <SpaceFormModal initial={editing} onClose={() => { setShow(false); setEditing(null); }} onSave={save} />}
        </div>
    );
}


function SpaceFormModal({ initial, onClose, onSave }) {
    const [form, setForm] = useState(initial || {
        name: "", description: "", location: "", address: "",
        price_per_hour: 50, capacity: 4, category: "studio", amenities: [],
    });
    const toggleA = (k) => setForm({ ...form, amenities: form.amenities.includes(k) ? form.amenities.filter((x) => x !== k) : [...form.amenities, k] });
    const submit = (e) => {
        e.preventDefault();
        if (!form.name.trim() || !form.location.trim()) return toast.error("الاسم والموقع مطلوبان");
        onSave(form);
    };
    return (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
            <form onSubmit={submit} onClick={(e) => e.stopPropagation()} data-testid="space-form" className="w-full max-w-md bg-[#0F0F0F] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 space-y-3 max-h-[92vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                    <h3 className="font-heading font-black text-lg">{initial ? "تعديل المساحة" : "مساحة جديدة"}</h3>
                    <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><XIcon className="w-4 h-4" /></button>
                </div>
                <input data-testid="space-name" required placeholder="اسم المساحة" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none" />
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none">
                    {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
                <input data-testid="space-location" required placeholder="المدينة والحي" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none" />
                <input placeholder="العنوان التفصيلي (اختياري)" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none" />
                <textarea placeholder="وصف المساحة" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none resize-none" />
                <div className="grid grid-cols-2 gap-2">
                    <input type="number" step="0.01" min="0" placeholder="السعر / ساعة" value={form.price_per_hour} onChange={(e) => setForm({ ...form, price_per_hour: parseFloat(e.target.value) || 0 })} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none" />
                    <input type="number" min="1" placeholder="السعة" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 1 })} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none" />
                </div>
                <div>
                    <p className="text-xs text-white/50 mb-2">المرافق</p>
                    <div className="grid grid-cols-3 gap-1.5">
                        {AMENITIES.map((a) => (
                            <button key={a.key} type="button" onClick={() => toggleA(a.key)} className={`text-[10px] px-2 py-1.5 rounded-lg border transition ${form.amenities.includes(a.key) ? "bg-[#57769D]/20 border-[#57769D] text-white" : "bg-white/5 border-white/10 text-white/60"}`}>{a.label}</button>
                        ))}
                    </div>
                </div>
                <button data-testid="space-save" type="submit" className="w-full bg-[#D1795F] text-white font-heading font-bold rounded-xl py-3 active:scale-95">
                    {initial ? "تحديث" : "إنشاء"}
                </button>
            </form>
        </div>
    );
}


export function MyBookings() {
    const [items, setItems] = useState([]);
    const nav = useNavigate();
    useEffect(() => { api.get("/booking/my-bookings").then((r) => setItems(r.data)).catch(() => {}); }, []);

    const showQr = (bId) => {
        const token = localStorage.getItem("token");
        fetch(`${API}/booking/bookings/${bId}/qr`, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.blob())
            .then((b) => window.open(URL.createObjectURL(b), "_blank"))
            .catch(() => toast.error("تعذّر جلب QR"));
    };

    return (
        <div className="p-4 pt-14 pb-24 space-y-3" data-testid="my-bookings-page">
            <h1 className="font-heading font-black text-2xl text-white">حجوزاتي</h1>
            {items.length === 0 && <div className="text-center py-16 text-white/40">لا حجوزات بعد. <button onClick={() => nav("/booking")} className="text-[#D1795F] hover:underline">تصفّح</button></div>}
            {items.map((b) => (
                <div key={b.id} data-testid={`booking-${b.id}`} className="bg-white/5 border border-white/10 rounded-2xl p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="min-w-0 flex-1">
                            <div className="font-heading font-bold text-sm text-white truncate">{b.space?.name}</div>
                            <div className="text-[10px] text-white/50 flex items-center gap-1 mt-0.5"><MapPin className="w-2.5 h-2.5" /> {b.space?.location}</div>
                        </div>
                        <StatusBadge status={b.status} />
                    </div>
                    <div className="text-[11px] text-white/60 mt-1 flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        {new Date(b.start_time).toLocaleString("ar")}
                        <span className="text-white/30">→</span>
                        {new Date(b.end_time).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-[#D1795F] font-heading font-black text-sm flex items-center"><DollarSign className="w-3 h-3" />{b.amount}</span>
                        {b.status === "confirmed" && (
                            <button data-testid={`qr-btn-${b.id}`} onClick={() => showQr(b.id)} className="text-[11px] bg-[#57769D]/20 text-[#8BA6D0] border border-[#57769D]/30 rounded-full px-3 py-1 flex items-center gap-1">
                                <QrCode className="w-3 h-3" /> عرض QR
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}


function StatusBadge({ status }) {
    const m = {
        pending:   { c: "#F59E0B", l: "بانتظار الدفع" },
        confirmed: { c: "#C3E0A5", l: "مؤكد" },
        attended:  { c: "#57769D", l: "تم الحضور" },
        cancelled: { c: "#EF4444", l: "ملغى" },
    }[status] || { c: "#94A3B8", l: status };
    return <span className="text-[10px] px-2 py-0.5 rounded-full font-heading font-bold text-black" style={{ backgroundColor: m.c }}>{m.l}</span>;
}


export function BookingSuccess() {
    const [params] = useSearchParams();
    const [state, setState] = useState({ status: "polling", booking: null });
    const sid = params.get("session_id");
    const nav = useNavigate();

    const poll = useCallback(async (attempts = 0) => {
        if (!sid) return nav("/booking");
        if (attempts >= 10) { setState({ status: "timeout", booking: null }); return; }
        try {
            const r = await api.get(`/booking/status/${sid}`);
            if (r.data.payment_status === "paid") {
                setState({ status: "confirmed", booking: r.data.booking });
                return;
            }
            setTimeout(() => poll(attempts + 1), 2000);
        } catch { setTimeout(() => poll(attempts + 1), 2000); }
    }, [sid, nav]);

    useEffect(() => { poll(); }, [poll]);

    return (
        <div className="p-4 pt-14 pb-24 min-h-[100dvh] flex flex-col items-center justify-center text-center" data-testid="booking-success">
            {state.status === "polling" && (
                <>
                    <div className="w-14 h-14 rounded-full border-4 border-[#D1795F] border-t-transparent animate-spin mb-4" />
                    <div className="text-white/80 font-heading font-bold">جارٍ تأكيد الحجز...</div>
                </>
            )}
            {state.status === "confirmed" && (
                <>
                    <div className="text-6xl mb-3">🎉</div>
                    <h1 className="font-heading font-black text-2xl text-white">تم تأكيد حجزك!</h1>
                    <p className="text-sm text-white/60 mt-2 mb-6">استخدم رمز QR لدخول المساحة</p>
                    <button data-testid="go-to-bookings" onClick={() => nav("/booking/my-bookings")} className="bg-[#D1795F] text-white font-heading font-bold rounded-xl px-6 py-3">
                        عرض حجوزاتي
                    </button>
                </>
            )}
            {state.status === "timeout" && (
                <>
                    <div className="text-4xl mb-3">⚠️</div>
                    <div className="text-white/80">انتهت مهلة التحقق — راجع حجوزاتك</div>
                    <button onClick={() => nav("/booking/my-bookings")} className="mt-4 text-[#D1795F] hover:underline">إلى حجوزاتي</button>
                </>
            )}
        </div>
    );
}
