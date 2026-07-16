import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Shield, History, ShieldAlert, Mail, Flag } from "lucide-react";
import api from "@/lib/api";

export default function AdminShell() {
    const [perms, setPerms] = useState(null);
    const nav = useNavigate();

    useEffect(() => {
        api.get("/admin/me/permissions").then((r) => {
            setPerms(r.data);
            if (!r.data.capabilities.includes("admin.view_platform_stats")) {
                nav("/feed", { replace: true });
            }
        }).catch(() => nav("/auth"));
    }, [nav]);

    const tabs = [
        { to: "/admin", icon: LayoutDashboard, label: "لوحة التحكم", end: true },
        { to: "/admin/users", icon: Users, label: "المستخدمون" },
        { to: "/admin/leads", icon: Mail, label: "تواصل معنا" },
        { to: "/admin/reports", icon: Flag, label: "البلاغات" },
        { to: "/admin/audit", icon: History, label: "سجل الأحداث" },
    ];

    if (!perms) return <div className="p-8 text-white/50 text-center">جارٍ التحميل...</div>;

    return (
        <div data-testid="admin-shell" className="pb-24 min-h-[100dvh]">
            <div className="px-4 pt-6 pb-3 border-b border-white/5 sticky top-0 bg-black/95 backdrop-blur-xl z-30">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-[#EF4444] flex items-center justify-center">
                            <ShieldAlert className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="font-heading font-black text-lg leading-none">لوحة المدير</h1>
                            <p className="text-[10px] text-white/50 font-body">{perms.role_meta.name} • {perms.capabilities.length} صلاحية</p>
                        </div>
                    </div>
                </div>
                <div className="flex gap-1 overflow-x-auto -mx-4 px-4 scrollbar-none">
                    {tabs.map((t) => (
                        <NavLink key={t.to} to={t.to} end={t.end}
                            data-testid={`admin-tab-${t.to.split('/').pop()||'dashboard'}`}
                            className={({ isActive }) =>
                                `flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-heading font-semibold whitespace-nowrap transition ${
                                    isActive ? "bg-[#D1795F] text-white" : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
                                }`
                            }>
                            <t.icon className="w-3.5 h-3.5" />
                            {t.label}
                        </NavLink>
                    ))}
                </div>
            </div>
            <Outlet />
        </div>
    );
}
