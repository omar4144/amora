import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { ChevronRight, ChevronLeft } from "lucide-react";

const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

export default function ContentCalendar() {
    const now = new Date();
    const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const nav = useNavigate();

    useEffect(() => {
        api.get(`/content/calendar?year=${ym.y}&month=${ym.m}`).then((r) => { setData(r.data); setLoading(false); }).catch(() => { setLoading(false); nav("/auth"); });
    }, [ym, nav]);

    const days = useMemo(() => {
        const first = new Date(ym.y, ym.m - 1, 1);
        const last = new Date(ym.y, ym.m, 0);
        const startWeekday = first.getDay(); // Sun=0 (we'll treat Sat as start for Arab week)
        const totalDays = last.getDate();
        // Arabic week starts Saturday (6). Shift so Sat=0
        const startOffset = (startWeekday + 1) % 7; // Sun(0) -> Sun index=1, Sat(6)->Sat index=0
        const cells = [];
        for (let i = 0; i < startOffset; i++) cells.push(null);
        for (let d = 1; d <= totalDays; d++) cells.push(d);
        return cells;
    }, [ym]);

    const prev = () => setYm(ym.m === 1 ? { y: ym.y - 1, m: 12 } : { y: ym.y, m: ym.m - 1 });
    const next = () => setYm(ym.m === 12 ? { y: ym.y + 1, m: 1 } : { y: ym.y, m: ym.m + 1 });

    const getItems = (d) => {
        if (!d || !data) return [];
        const key = `${ym.y}-${String(ym.m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        return data.days[key] || [];
    };

    if (loading) return <div className="p-8 text-white/50 text-center">جارٍ التحميل...</div>;

    return (
        <div data-testid="content-calendar" className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button data-testid="cal-prev" onClick={prev} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button>
                <div className="text-center">
                    <h2 className="font-heading font-black text-lg text-white">{AR_MONTHS[ym.m - 1]} {ym.y}</h2>
                    <p className="text-[10px] text-white/50 font-body">{data?.count || 0} منشور في هذا الشهر</p>
                </div>
                <button data-testid="cal-next" onClick={next} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
            </div>

            {/* Weekday header (Arabic starts Sat) */}
            <div className="grid grid-cols-7 gap-1 text-[10px] text-white/40 font-body text-center">
                {["س","ح","ن","ث","ر","خ","ج"].map((d) => <div key={d}>{d}</div>)}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-1">
                {days.map((d, i) => {
                    const items = getItems(d);
                    return (
                        <div key={i} className={`aspect-square rounded-lg border ${d ? "bg-white/5 border-white/10" : "opacity-0"} p-1 relative overflow-hidden`}>
                            {d && (
                                <>
                                    <div className="text-[10px] text-white/60 font-heading font-semibold">{d}</div>
                                    <div className="absolute inset-x-1 bottom-1 space-y-0.5">
                                        {items.slice(0, 2).map((it) => (
                                            <div
                                                key={it.id}
                                                onClick={() => nav(`/content/item/${it.id}`)}
                                                className="text-[7px] leading-tight bg-[#D1795F]/20 border-r border-[#D1795F] text-white truncate px-1 py-0.5 rounded cursor-pointer"
                                            >
                                                {it.title}
                                            </div>
                                        ))}
                                        {items.length > 2 && <div className="text-[7px] text-[#D1795F] font-body">+{items.length - 2}</div>}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="pt-4 text-[10px] text-white/40 text-center font-body">
                المحتوى يظهر حسب تاريخ الجدولة أو النشر
            </div>
        </div>
    );
}
