import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Flag, Filter, ChevronDown, Inbox, ShieldAlert, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

const STATUS_META = {
    pending:      { label: "قيد الانتظار", color: "#F59E0B", bg: "#F59E0B20" },
    under_review: { label: "قيد المراجعة",  color: "#57769D", bg: "#57769D20" },
    resolved:     { label: "تمت المعالجة",  color: "#C3E0A5", bg: "#C3E0A520" },
    dismissed:    { label: "مرفوض",         color: "#6B7280", bg: "#6B728020" },
};

const REASON_LABEL = {
    spam: "رسائل مزعجة",
    harassment: "تحرش",
    hate_speech: "خطاب كراهية",
    nudity: "غير لائق",
    violence: "عنف",
    misinformation: "معلومات مضللة",
    copyright: "حقوق ملكية",
    scam: "احتيال",
    other: "أخرى",
};

const TARGET_LABEL = {
    video: "فيديو",
    user: "مستخدم",
    comment: "تعليق",
    message: "رسالة",
    service: "خدمة",
    community_post: "منشور مجتمع",
};

export default function AdminReports() {
    const [reports, setReports] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState("pending");
    const [expanded, setExpanded] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const [r, s] = await Promise.all([
                api.get(`/admin/reports${statusFilter ? `?status=${statusFilter}` : ""}`),
                api.get("/admin/reports/stats"),
            ]);
            setReports(r.data);
            setStats(s.data);
        } catch {
            /* silent */
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line

    const resolve = async (reportId, newStatus, action = "none") => {
        try {
            await api.put(`/admin/reports/${reportId}`, { status: newStatus, action, admin_notes: "" });
            toast.success("تم تحديث البلاغ");
            setReports((rs) => rs.filter((r) => r.id !== reportId));
            load();
        } catch {
            toast.error("تعذّر تحديث البلاغ");
        }
    };

    if (loading) return <div className="p-8 text-white/50 text-center">جارٍ التحميل...</div>;

    return (
        <div data-testid="admin-reports" className="p-4 space-y-4">
            <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-red-500 flex items-center justify-center">
                    <ShieldAlert className="w-4 h-4 text-white" />
                </div>
                <div>
                    <h3 className="font-heading font-black text-base text-white">البلاغات</h3>
                    <p className="text-[10px] text-white/50 font-body">راجع محتوى مُبلَّغ عنه واتّخذ الإجراء المناسب</p>
                </div>
            </div>

            {/* Stats overview */}
            {stats && (
                <div className="grid grid-cols-4 gap-2">
                    {[
                        ["pending", stats.pending],
                        ["under_review", stats.under_review],
                        ["resolved", stats.resolved],
                        ["dismissed", stats.dismissed],
                    ].map(([key, val]) => {
                        const meta = STATUS_META[key];
                        return (
                            <button
                                key={key}
                                data-testid={`stat-${key}`}
                                onClick={() => setStatusFilter(key)}
                                className={`p-3 rounded-xl border text-start transition ${
                                    statusFilter === key ? "border-white/40 bg-white/[0.06]" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                                }`}
                            >
                                <div className="text-lg font-heading font-black" style={{ color: meta.color }}>{val}</div>
                                <div className="text-[10px] text-white/60 font-body mt-0.5">{meta.label}</div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Status filter (mirror) */}
            <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 scrollbar-none">
                <button
                    data-testid="filter-all"
                    onClick={() => setStatusFilter("")}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-heading font-semibold whitespace-nowrap border transition ${
                        statusFilter === "" ? "bg-white text-black border-white" : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
                    }`}
                >
                    <Filter className="w-3 h-3" />
                    الكل
                </button>
                {Object.entries(STATUS_META).map(([key, meta]) => (
                    <button
                        key={key}
                        data-testid={`filter-${key}`}
                        onClick={() => setStatusFilter(key)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-heading font-semibold whitespace-nowrap border transition ${
                            statusFilter === key ? "text-white border-transparent" : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
                        }`}
                        style={statusFilter === key ? { backgroundColor: meta.color } : {}}
                    >
                        {meta.label}
                    </button>
                ))}
            </div>

            {reports.length === 0 && (
                <div className="py-16 text-center" data-testid="reports-empty">
                    <Inbox className="w-10 h-10 text-white/20 mx-auto mb-3" />
                    <p className="text-white/50 text-sm">لا توجد بلاغات مطابقة</p>
                </div>
            )}

            <div className="space-y-2">
                {reports.map((r) => {
                    const sMeta = STATUS_META[r.status] || STATUS_META.pending;
                    const isOpen = expanded === r.id;
                    return (
                        <div
                            key={r.id}
                            data-testid={`report-${r.id}`}
                            className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
                        >
                            <button
                                onClick={() => setExpanded(isOpen ? null : r.id)}
                                className="w-full p-4 text-start hover:bg-white/[0.02] transition flex items-start gap-3"
                            >
                                <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                                    <Flag className="w-4 h-4 text-red-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                        <span
                                            className="text-[10px] font-heading font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                                            style={{ color: sMeta.color, backgroundColor: sMeta.bg }}
                                        >
                                            {sMeta.label}
                                        </span>
                                        <span className="text-[10px] font-heading font-bold px-2 py-0.5 rounded-full flex-shrink-0 bg-white/5 text-white/70">
                                            {TARGET_LABEL[r.target_type] || r.target_type}
                                        </span>
                                        <span className="text-[10px] font-heading font-bold px-2 py-0.5 rounded-full flex-shrink-0 bg-red-500/10 text-red-400">
                                            {REASON_LABEL[r.reason] || r.reason}
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-white/60 truncate">
                                        {r.reporter?.name || r.reporter_username || "—"} • {new Date(r.created_at).toLocaleString("ar")}
                                    </div>
                                    <div className="text-[11px] text-white/40 mt-0.5 truncate">target: {r.target_id}</div>
                                </div>
                                <ChevronDown className={`w-4 h-4 text-white/40 transition ${isOpen ? "rotate-180" : ""}`} />
                            </button>
                            {isOpen && (
                                <div className="px-4 pb-4 border-t border-white/5 pt-3" data-testid={`report-detail-${r.id}`}>
                                    {r.details && (
                                        <p className="text-sm text-white/90 leading-relaxed font-body whitespace-pre-wrap mb-3 bg-white/[0.03] rounded-xl p-3 border border-white/5">
                                            {r.details}
                                        </p>
                                    )}
                                    {r.status !== "resolved" && r.status !== "dismissed" && (
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                data-testid={`resolve-remove-${r.id}`}
                                                onClick={() => resolve(r.id, "resolved", "content_removed")}
                                                className="text-[11px] bg-red-500 hover:bg-red-600 text-white rounded-full px-3 py-1.5 font-heading font-bold transition flex items-center gap-1"
                                            >
                                                <CheckCircle2 className="w-3 h-3" />
                                                معالجة + حذف
                                            </button>
                                            <button
                                                data-testid={`resolve-warn-${r.id}`}
                                                onClick={() => resolve(r.id, "resolved", "user_warned")}
                                                className="text-[11px] bg-amber-500 hover:bg-amber-600 text-white rounded-full px-3 py-1.5 font-heading font-bold transition"
                                            >
                                                تحذير المستخدم
                                            </button>
                                            <button
                                                data-testid={`resolve-ban-${r.id}`}
                                                onClick={() => {
                                                    if (window.confirm("حظر المستخدم نهائياً؟")) resolve(r.id, "resolved", "user_banned");
                                                }}
                                                className="text-[11px] bg-red-900 hover:bg-red-950 text-white rounded-full px-3 py-1.5 font-heading font-bold transition"
                                            >
                                                حظر المستخدم
                                            </button>
                                            <button
                                                data-testid={`dismiss-${r.id}`}
                                                onClick={() => resolve(r.id, "dismissed", "none")}
                                                className="text-[11px] bg-white/10 hover:bg-white/20 text-white rounded-full px-3 py-1.5 font-heading font-bold transition flex items-center gap-1"
                                            >
                                                <XCircle className="w-3 h-3" />
                                                رفض البلاغ
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
