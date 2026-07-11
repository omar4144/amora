import { useEffect, useState } from "react";
import { useNavigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { Briefcase, Users, KanbanSquare, Activity, LayoutDashboard, ArrowRight } from "lucide-react";

// Shared CRM shell layout — top-tab nav + Outlet
export default function CRMShell() {
    const nav = useNavigate();
    const location = useLocation();

    const tabs = [
        { to: "/crm", icon: LayoutDashboard, label: "لوحة التحكم", end: true },
        { to: "/crm/clients", icon: Users, label: "العملاء" },
        { to: "/crm/deals", icon: KanbanSquare, label: "الصفقات" },
        { to: "/crm/activities", icon: Activity, label: "الأنشطة" },
    ];

    return (
        <div data-testid="crm-shell" className="pb-24 min-h-[100dvh]">
            {/* Header */}
            <div className="px-4 pt-6 pb-3 border-b border-white/5 sticky top-0 bg-black/95 backdrop-blur-xl z-30">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-[#D1795F] flex items-center justify-center">
                            <Briefcase className="w-5 h-5 text-black" />
                        </div>
                        <div>
                            <h1 className="font-heading font-black text-lg leading-none">CRM</h1>
                            <p className="text-[10px] text-white/50 font-body">مركز إدارة علاقاتك التجارية</p>
                        </div>
                    </div>
                </div>
                {/* Tabs */}
                <div className="flex gap-1 overflow-x-auto -mx-4 px-4 scrollbar-none">
                    {tabs.map((t) => (
                        <NavLink
                            key={t.to}
                            to={t.to}
                            end={t.end}
                            data-testid={`crm-tab-${t.to.split('/').pop()||'dashboard'}`}
                            className={({ isActive }) =>
                                `flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-heading font-semibold whitespace-nowrap transition ${
                                    isActive
                                        ? "bg-[#D1795F] text-white"
                                        : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
                                }`
                            }
                        >
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
