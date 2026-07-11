import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { StickyNote, Phone, Mail, Users2 as UsersIcon, Calendar, ArrowLeftRight } from "lucide-react";

const ACT_ICONS = { note: StickyNote, call: Phone, email: Mail, meeting: UsersIcon, task: Calendar, stage_change: ArrowLeftRight };
const ACT_LABELS = { note: "ملاحظة", call: "مكالمة", email: "بريد", meeting: "اجتماع", task: "مهمة", stage_change: "نقل مرحلة" };

export default function CRMActivities() {
    const [items, setItems] = useState([]);
    const [filter, setFilter] = useState("all");
    const nav = useNavigate();

    useEffect(() => {
        api.get("/crm/activities?limit=200").then((r) => setItems(r.data)).catch(() => nav("/auth"));
    }, [nav]);

    const filtered = filter === "all" ? items : items.filter((a) => a.type === filter);

    return (
        <div data-testid="crm-activities" className="p-4 space-y-4">
            {/* Filter */}
            <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4">
                {["all", "note", "call", "email", "meeting", "task", "stage_change"].map((t) => (
                    <button
                        key={t}
                        onClick={() => setFilter(t)}
                        className={`px-3 py-1.5 rounded-full text-[11px] whitespace-nowrap font-heading font-semibold ${
                            filter === t ? "bg-[#E3FF00] text-black" : "bg-white/5 text-white/60 border border-white/10"
                        }`}
                    >
                        {t === "all" ? "الكل" : ACT_LABELS[t]}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="space-y-2">
                {filtered.length === 0 && (
                    <div className="text-center py-16 text-white/40 text-sm">لا يوجد نشاط بعد</div>
                )}
                {filtered.map((a) => {
                    const Icon = ACT_ICONS[a.type] || StickyNote;
                    return (
                        <div key={a.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-start gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#E3FF00]/10 flex items-center justify-center flex-shrink-0">
                                <Icon className="w-4 h-4 text-[#E3FF00]" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-white font-heading font-semibold">{a.title}</p>
                                {a.description && <p className="text-xs text-white/60 font-body mt-0.5">{a.description}</p>}
                                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/40">
                                    {a.client_name && <span>👤 {a.client_name}</span>}
                                    {a.deal_title && <span>💼 {a.deal_title}</span>}
                                    <span>🕐 {new Date(a.created_at).toLocaleString('ar')}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
