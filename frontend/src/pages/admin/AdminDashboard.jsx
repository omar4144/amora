import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Users, Video, ShoppingCart, DollarSign, Building2, KanbanSquare } from "lucide-react";

function Stat({ icon: Icon, label, value, sublabel, color = "#D1795F" }) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2" style={{ backgroundColor: `${color}20`, color }}>
                <Icon className="w-4.5 h-4.5" />
            </div>
            <div className="text-2xl font-black font-heading text-white">{value}</div>
            <div className="text-xs text-white/60 font-body mt-1">{label}</div>
            {sublabel && <div className="text-[10px] text-white/40 font-body mt-1">{sublabel}</div>}
        </div>
    );
}

export default function AdminDashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("/admin/dashboard").then((r) => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
    }, []);

    if (loading || !data) return <div className="p-8 text-white/50 text-center">جارٍ التحميل...</div>;

    return (
        <div data-testid="admin-dashboard" className="p-4 space-y-6">
            {/* KPIs */}
            <div>
                <h3 className="font-heading font-bold text-base mb-3">إحصاءات المنصة</h3>
                <div className="grid grid-cols-2 gap-3">
                    <Stat icon={Users} label="المستخدمون" value={data.users.total} sublabel={`${data.users.banned} محظور`} />
                    <Stat icon={DollarSign} label="إجمالي الإيرادات" value={`$${data.business.gross_revenue}`} sublabel={`رسوم $${data.business.platform_fees}`} color="#C3E0A5" />
                    <Stat icon={Video} label="الفيديوهات" value={data.content.videos} color="#57769D" />
                    <Stat icon={ShoppingCart} label="الطلبات" value={data.business.orders_total} sublabel={`${data.business.orders_paid} مدفوعة`} />
                    <Stat icon={Building2} label="المجتمعات" value={data.community.communities} color="#57769D" />
                    <Stat icon={KanbanSquare} label="مهام ومحتوى" value={data.business.tasks + data.content.content_items} />
                </div>
            </div>

            {/* Users by role */}
            <div>
                <h3 className="font-heading font-bold text-base mb-3">المستخدمون حسب الدور</h3>
                <div className="space-y-2">
                    {data.users.by_role.filter(r => r.count > 0).map((r) => (
                        <div key={r.key} className="bg-white/5 border border-white/10 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                                    <span className="text-sm font-heading font-semibold text-white">{r.name}</span>
                                </div>
                                <span className="text-sm font-heading font-bold" style={{ color: r.color }}>{r.count}</span>
                            </div>
                            <div className="h-1 bg-black/40 rounded-full overflow-hidden">
                                <div className="h-full transition-all" style={{ backgroundColor: r.color, width: `${Math.min(100, (r.count/data.users.total)*100)}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Business modules */}
            <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                    <div className="text-xl font-black font-heading text-[#D1795F]">{data.business.crm_clients}</div>
                    <div className="text-[10px] text-white/50">عملاء CRM</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                    <div className="text-xl font-black font-heading text-[#57769D]">{data.business.crm_deals}</div>
                    <div className="text-[10px] text-white/50">صفقات</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                    <div className="text-xl font-black font-heading text-[#C3E0A5]">{data.community.leads}</div>
                    <div className="text-[10px] text-white/50">Leads</div>
                </div>
            </div>
        </div>
    );
}
