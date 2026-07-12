import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import {
    ArrowRight, Building2, Mail, Phone, Briefcase, Video, CheckSquare,
    StickyNote, Users2, Tag, Edit3, Trash2, DollarSign, Calendar as CalIcon,
    Sparkles,
} from "lucide-react";

const TABS = [
    { key: "deals",      label: "الصفقات",    icon: Briefcase },
    { key: "content",    label: "المحتوى",     icon: Video },
    { key: "tasks",      label: "المهام",      icon: CheckSquare },
    { key: "activities", label: "النشاطات",    icon: StickyNote },
];

export default function CRMClientDetail() {
    const { id } = useParams();
    const nav = useNavigate();
    const [client, setClient] = useState(null);
    const [related, setRelated] = useState({ deals: [], content: [], tasks: [], activities: [] });
    const [tab, setTab] = useState("deals");
    const [loading, setLoading] = useState(true);

    const load = async () => {
        try {
            const [c, r] = await Promise.all([
                api.get(`/crm/clients/${id}`),
                api.get(`/workspace/related?client_id=${id}`),
            ]);
            setClient(c.data);
            setRelated(r.data);
        } catch {
            toast.error("تعذّر تحميل العميل");
            nav("/crm/clients");
        } finally { setLoading(false); }
    };
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

    const remove = async () => {
        if (!window.confirm(`حذف العميل "${client.name}"؟ ستُحذف كل الصفقات والنشاطات المرتبطة.`)) return;
        await api.delete(`/crm/clients/${id}`);
        toast.success("محذوف");
        nav("/crm/clients");
    };

    if (loading || !client) return <div className="p-8 text-white/50 text-center">جارٍ التحميل...</div>;

    const counts = {
        deals: related.deals.length,
        content: related.content.length,
        tasks: related.tasks.length,
        activities: related.activities.length,
    };

    return (
        <div data-testid="crm-client-detail" className="p-4 space-y-5">
            <button onClick={() => nav("/crm/clients")} className="text-xs text-white/60 flex items-center gap-1">
                <ArrowRight className="w-3 h-3" /> رجوع للعملاء
            </button>

            {/* Header card */}
            <div className="bg-gradient-to-br from-[#D1795F]/10 via-[#141414] to-[#0A0A0A] border border-[#D1795F]/20 rounded-2xl p-5 relative overflow-hidden">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-14 h-14 rounded-2xl bg-[#D1795F] text-white flex items-center justify-center flex-shrink-0 font-heading font-black text-xl">
                            {client.name?.[0] || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="font-heading font-black text-xl text-white truncate">{client.name}</h1>
                            {client.company && (
                                <div className="flex items-center gap-1 text-xs text-white/60 mt-0.5">
                                    <Building2 className="w-3 h-3" /> {client.company}
                                    {client.industry && <span className="text-white/40">• {client.industry}</span>}
                                </div>
                            )}
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-heading font-bold ${
                                    client.status === "active" ? "bg-[#C3E0A5]/10 text-[#C3E0A5]" : "bg-white/10 text-white/60"
                                }`}>{client.status}</span>
                                {client.source && <span className="text-[10px] text-white/50 flex items-center gap-1"><Tag className="w-2.5 h-2.5" /> {client.source}</span>}
                            </div>
                        </div>
                    </div>
                    <button data-testid="delete-client-btn" onClick={remove} className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center flex-shrink-0">
                        <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                </div>

                <div className="flex flex-wrap gap-3 text-[11px] text-white/60 mb-3">
                    {client.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {client.email}</span>}
                    {client.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {client.phone}</span>}
                </div>

                {client.notes && (
                    <div className="text-sm text-white/70 bg-black/30 rounded-xl p-3 mt-3 font-body flex items-start gap-2">
                        <StickyNote className="w-3.5 h-3.5 text-[#D1795F] flex-shrink-0 mt-0.5" />
                        <span>{client.notes}</span>
                    </div>
                )}
            </div>

            {/* Cross-engine tabs */}
            <div>
                <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
                    {TABS.map((t) => {
                        const Icon = t.icon;
                        const active = tab === t.key;
                        return (
                            <button
                                key={t.key}
                                data-testid={`client-tab-${t.key}`}
                                onClick={() => setTab(t.key)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl whitespace-nowrap text-xs font-heading font-bold transition ${
                                    active
                                        ? "bg-[#D1795F] text-white"
                                        : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {t.label}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-white/10"}`}>
                                    {counts[t.key]}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="mt-3 space-y-2">
                    {tab === "deals" && (
                        <>
                            {related.deals.length === 0 && <Empty label="لا توجد صفقات مع هذا العميل بعد" cta="إضافة صفقة" onCta={() => nav("/crm/deals")} />}
                            {related.deals.map((d) => (
                                <button
                                    key={d.id}
                                    data-testid={`related-deal-${d.id}`}
                                    onClick={() => nav(`/crm/deals/${d.id}`)}
                                    className="w-full text-start bg-white/5 border border-white/10 rounded-2xl p-3 hover:border-[#D1795F]/40 transition"
                                >
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <div className="font-heading font-bold text-sm text-white truncate flex-1">{d.title}</div>
                                        <div className="flex items-center gap-1 text-[#D1795F] font-heading font-black text-sm flex-shrink-0">
                                            <DollarSign className="w-3.5 h-3.5" />
                                            {d.value?.toLocaleString?.() || d.value || 0}
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-white/50">{d.stage} • {d.probability}%</div>
                                </button>
                            ))}
                        </>
                    )}

                    {tab === "content" && (
                        <>
                            {related.content.length === 0 && <Empty label="لا يوجد محتوى مرتبط بهذا العميل" cta="أنشئ محتوى" onCta={() => nav("/content/kanban")} />}
                            {related.content.map((c) => (
                                <button
                                    key={c.id}
                                    data-testid={`related-content-${c.id}`}
                                    onClick={() => nav(`/content/item/${c.id}`)}
                                    className="w-full text-start bg-white/5 border border-white/10 rounded-2xl p-3 hover:border-[#57769D]/40 transition"
                                >
                                    <div className="font-heading font-bold text-sm text-white truncate mb-0.5">{c.title}</div>
                                    <div className="text-[10px] text-white/50">{c.platform} • {c.status}</div>
                                </button>
                            ))}
                        </>
                    )}

                    {tab === "tasks" && (
                        <>
                            {related.tasks.length === 0 && <Empty label="لا توجد مهام مرتبطة" cta="أضف مهمة" onCta={() => nav("/tasks/boards")} />}
                            {related.tasks.map((t) => (
                                <button
                                    key={t.id}
                                    data-testid={`related-task-${t.id}`}
                                    onClick={() => nav(`/tasks/task/${t.id}`)}
                                    className="w-full text-start bg-white/5 border border-white/10 rounded-2xl p-3 hover:border-[#C3E0A5]/40 transition"
                                >
                                    <div className="font-heading font-bold text-sm text-white truncate mb-0.5">{t.title}</div>
                                    <div className="text-[10px] text-white/50 flex items-center gap-2">
                                        <span>{t.status}</span>
                                        {t.due_date && <span className="flex items-center gap-1"><CalIcon className="w-2.5 h-2.5" /> {new Date(t.due_date).toLocaleDateString('ar')}</span>}
                                    </div>
                                </button>
                            ))}
                        </>
                    )}

                    {tab === "activities" && (
                        <>
                            {related.activities.length === 0 && <Empty label="لا توجد نشاطات بعد" />}
                            {related.activities.map((a) => (
                                <div key={a.id} className="bg-white/5 border border-white/10 rounded-2xl p-3">
                                    <div className="font-heading font-bold text-sm text-white truncate">{a.title}</div>
                                    {a.description && <div className="text-xs text-white/60 mt-1 font-body">{a.description}</div>}
                                    <div className="text-[10px] text-white/40 mt-1">{a.type} • {new Date(a.created_at).toLocaleString('ar')}</div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function Empty({ label, cta, onCta }) {
    return (
        <div className="text-center py-10 border border-dashed border-white/10 rounded-2xl">
            <div className="text-sm text-white/40 mb-2">{label}</div>
            {cta && (
                <button onClick={onCta} className="text-xs text-[#D1795F] hover:underline font-heading font-bold inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> {cta}
                </button>
            )}
        </div>
    );
}
