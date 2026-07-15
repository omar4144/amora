import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Mail, Filter, ChevronDown, Inbox } from "lucide-react";
import { toast } from "sonner";

const STATUS_META = {
    new:        { label: "جديد", color: "#D1795F", bg: "#D1795F20" },
    in_review:  { label: "قيد المراجعة", color: "#F59E0B", bg: "#F59E0B20" },
    contacted:  { label: "تم التواصل", color: "#57769D", bg: "#57769D20" },
    won:        { label: "فرصة ناجحة", color: "#C3E0A5", bg: "#C3E0A520" },
    lost:       { label: "مغلق", color: "#6B7280", bg: "#6B728020" },
};

export default function AdminLeads() {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("");
    const [expanded, setExpanded] = useState(null);

    const load = () => {
        setLoading(true);
        api.get(`/admin/leads${filter ? `?status=${filter}` : ""}`)
            .then((r) => { setLeads(r.data); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

    const changeStatus = async (leadId, newStatus) => {
        try {
            await api.put(`/admin/leads/${leadId}/status`, { status: newStatus });
            toast.success("تم تحديث الحالة");
            setLeads((ls) => ls.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l)));
        } catch {
            toast.error("تعذّر تحديث الحالة");
        }
    };

    if (loading) return <div className="p-8 text-white/50 text-center">جارٍ التحميل...</div>;

    return (
        <div data-testid="admin-leads" className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-[#D1795F] flex items-center justify-center">
                        <Mail className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h3 className="font-heading font-black text-base text-white">تواصل معنا</h3>
                        <p className="text-[10px] text-white/50 font-body">رسائل نموذج الاتصال في الصفحة التعريفية</p>
                    </div>
                </div>
                <span data-testid="leads-count" className="text-xs bg-white/5 border border-white/10 rounded-full px-3 py-1 font-heading font-bold text-white">
                    {leads.length}
                </span>
            </div>

            {/* Status filter chips */}
            <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 scrollbar-none">
                <button
                    data-testid="filter-all"
                    onClick={() => setFilter("")}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-heading font-semibold whitespace-nowrap border transition ${
                        filter === "" ? "bg-white text-black border-white" : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
                    }`}
                >
                    <Filter className="w-3 h-3" />
                    الكل
                </button>
                {Object.entries(STATUS_META).map(([key, meta]) => (
                    <button
                        key={key}
                        data-testid={`filter-${key}`}
                        onClick={() => setFilter(key)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-heading font-semibold whitespace-nowrap border transition ${
                            filter === key ? "text-white border-transparent" : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
                        }`}
                        style={filter === key ? { backgroundColor: meta.color } : {}}
                    >
                        {meta.label}
                    </button>
                ))}
            </div>

            {leads.length === 0 && (
                <div className="py-16 text-center" data-testid="leads-empty">
                    <Inbox className="w-10 h-10 text-white/20 mx-auto mb-3" />
                    <p className="text-white/50 text-sm">لا توجد رسائل حالياً</p>
                </div>
            )}

            <div className="space-y-2">
                {leads.map((l) => {
                    const meta = STATUS_META[l.status] || STATUS_META.new;
                    const isOpen = expanded === l.id;
                    return (
                        <div
                            key={l.id}
                            data-testid={`lead-${l.id}`}
                            className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
                        >
                            <button
                                onClick={() => setExpanded(isOpen ? null : l.id)}
                                className="w-full p-4 text-start hover:bg-white/[0.02] transition flex items-start gap-3"
                            >
                                <div className="w-10 h-10 rounded-full bg-[#D1795F] flex items-center justify-center text-black font-heading font-black flex-shrink-0">
                                    {l.name?.[0] || "?"}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="font-heading font-bold text-white text-sm truncate">{l.name}</span>
                                        <span
                                            className="text-[10px] font-heading font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                                            style={{ color: meta.color, backgroundColor: meta.bg }}
                                        >
                                            {meta.label}
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-white/60 truncate">{l.email}</div>
                                    <div className="text-[11px] text-white/40 mt-0.5">
                                        {new Date(l.created_at).toLocaleString("ar")}
                                    </div>
                                </div>
                                <ChevronDown className={`w-4 h-4 text-white/40 transition ${isOpen ? "rotate-180" : ""}`} />
                            </button>
                            {isOpen && (
                                <div className="px-4 pb-4 border-t border-white/5 pt-3" data-testid={`lead-detail-${l.id}`}>
                                    <p className="text-sm text-white/90 leading-relaxed font-body whitespace-pre-wrap mb-3">{l.story}</p>
                                    <div className="flex flex-wrap gap-1.5 items-center">
                                        <span className="text-[10px] text-white/50 font-heading font-bold ml-1">تحديث الحالة:</span>
                                        {Object.entries(STATUS_META).map(([key, m]) => (
                                            <button
                                                key={key}
                                                data-testid={`lead-${l.id}-status-${key}`}
                                                onClick={() => changeStatus(l.id, key)}
                                                disabled={l.status === key}
                                                className={`text-[10px] px-2 py-1 rounded-full font-heading font-bold transition ${
                                                    l.status === key ? "opacity-100" : "opacity-60 hover:opacity-100"
                                                }`}
                                                style={{ color: m.color, backgroundColor: m.bg }}
                                            >
                                                {m.label}
                                            </button>
                                        ))}
                                    </div>
                                    <a
                                        href={`mailto:${l.email}`}
                                        className="mt-3 inline-flex items-center gap-1.5 text-xs bg-[#D1795F] text-white rounded-full px-3 py-1.5 font-heading font-bold hover:bg-[#B86648] transition"
                                    >
                                        <Mail className="w-3 h-3" />
                                        رد بالبريد
                                    </a>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
