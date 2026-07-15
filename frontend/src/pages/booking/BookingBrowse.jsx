import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { MapPin, Users2, Star, Plus, Search, DollarSign, Clock } from "lucide-react";

const CAT_ICONS = { studio: "🎬", meeting_room: "💼", office: "🏢", event_hall: "🎉" };

export default function BookingBrowse() {
    const [spaces, setSpaces] = useState([]);
    const [meta, setMeta] = useState({ categories: [], amenities: [] });
    const [cat, setCat] = useState("");
    const [q, setQ] = useState("");
    const [debounced, setDebounced] = useState("");
    const nav = useNavigate();

    useEffect(() => { api.get("/booking/meta").then((r) => setMeta(r.data)); }, []);
    useEffect(() => { const t = setTimeout(() => setDebounced(q), 300); return () => clearTimeout(t); }, [q]);

    const load = () => {
        const params = new URLSearchParams();
        if (cat) params.set("category", cat);
        if (debounced) params.set("q", debounced);
        api.get(`/booking/spaces?${params.toString()}`).then((r) => setSpaces(r.data)).catch(() => {});
    };
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [cat, debounced]);

    return (
        <div className="p-4 pt-14 pb-24 space-y-4" data-testid="booking-browse">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-heading font-black text-2xl text-white">احجز مساحتك</h1>
                    <p className="text-xs text-white/50">استوديوهات، قاعات، مكاتب</p>
                </div>
                <button data-testid="my-spaces-btn" onClick={() => nav("/booking/my-spaces")} className="bg-white/5 border border-white/10 hover:border-[#D1795F] rounded-xl px-3 py-2 text-xs font-heading font-bold flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> مساحاتي
                </button>
            </div>

            <div className="relative">
                <Search className="w-4 h-4 text-white/40 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                    data-testid="booking-search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="ابحث بالاسم أو الموقع..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder-white/40 focus:border-[#D1795F] outline-none"
                />
            </div>

            <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
                <FilterChip active={!cat} onClick={() => setCat("")} label="الكل" testId="cat-all" />
                {meta.categories.map((c) => (
                    <FilterChip key={c.key} testId={`cat-${c.key}`} active={cat === c.key} onClick={() => setCat(cat === c.key ? "" : c.key)} label={`${CAT_ICONS[c.key] || "📍"} ${c.label}`} />
                ))}
            </div>

            <div className="flex items-center justify-between pt-1">
                <div className="text-xs text-white/50">{spaces.length} مساحة</div>
                <button data-testid="my-bookings-btn" onClick={() => nav("/booking/my-bookings")} className="text-[11px] text-[#D1795F] hover:underline flex items-center gap-1">
                    <Clock className="w-3 h-3" /> حجوزاتي
                </button>
            </div>

            {spaces.length === 0 && (
                <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl">
                    <div className="text-4xl mb-2 opacity-40">🏛️</div>
                    <div className="text-sm text-white/50 mb-3">{debounced || cat ? "لا نتائج" : "لا توجد مساحات بعد"}</div>
                    <button onClick={() => nav("/booking/spaces/new")} className="text-xs text-[#D1795F] hover:underline font-heading font-bold">
                        كن أول من يعرض مساحته →
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 gap-3">
                {spaces.map((s) => (
                    <SpaceCard key={s.id} space={s} onClick={() => nav(`/booking/spaces/${s.id}`)} />
                ))}
            </div>
        </div>
    );
}

function FilterChip({ active, onClick, label, testId }) {
    return (
        <button data-testid={testId} onClick={onClick} className={`text-[11px] px-3 py-1.5 rounded-full whitespace-nowrap font-heading font-bold ${active ? "bg-[#D1795F] text-white" : "bg-white/5 text-white/60 border border-white/10"}`}>
            {label}
        </button>
    );
}

function SpaceCard({ space, onClick }) {
    return (
        <button data-testid={`space-${space.id}`} onClick={onClick} className="text-start bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#D1795F]/40 rounded-2xl p-3 transition">
            <div className="flex items-start gap-3">
                <div className="w-16 h-16 rounded-xl flex-shrink-0 bg-gradient-to-br from-[#D1795F]/20 to-[#57769D]/20 flex items-center justify-center text-2xl">
                    {space.images?.[0] ? <img src={space.images[0]} alt="" className="w-full h-full object-cover rounded-xl" /> : (CAT_ICONS[space.category] || "🏛️")}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-heading font-bold text-sm text-white truncate">{space.name}</div>
                    <div className="text-[10px] text-white/50 flex items-center gap-1 mt-0.5"><MapPin className="w-2.5 h-2.5" /> {space.location}</div>
                    <div className="flex items-center gap-3 mt-1.5">
                        <div className="text-[#D1795F] font-heading font-black text-sm flex items-center gap-0.5">
                            <DollarSign className="w-3 h-3" />{space.price_per_hour}<span className="text-[9px] text-white/40 mr-0.5">/ساعة</span>
                        </div>
                        <div className="text-[10px] text-white/50 flex items-center gap-1"><Users2 className="w-2.5 h-2.5" /> {space.capacity}</div>
                        {space.rating && <div className="text-[10px] text-amber-400 flex items-center gap-0.5"><Star className="w-2.5 h-2.5 fill-amber-400" /> {space.rating.toFixed(1)}</div>}
                    </div>
                </div>
            </div>
        </button>
    );
}
