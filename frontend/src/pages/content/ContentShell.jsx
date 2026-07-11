import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, KanbanSquare, CalendarDays, Sparkles, Video } from "lucide-react";

export default function ContentShell() {
    const tabs = [
        { to: "/content", icon: LayoutDashboard, label: "لوحة التحكم", end: true },
        { to: "/content/kanban", icon: KanbanSquare, label: "المراحل" },
        { to: "/content/calendar", icon: CalendarDays, label: "التقويم" },
        { to: "/content/ai", icon: Sparkles, label: "ذكاء إبداعي" },
    ];
    return (
        <div data-testid="content-shell" className="pb-24 min-h-[100dvh]">
            <div className="px-4 pt-6 pb-3 border-b border-white/5 sticky top-0 bg-black/95 backdrop-blur-xl z-30">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-[#E3FF00] flex items-center justify-center">
                            <Video className="w-5 h-5 text-black" />
                        </div>
                        <div>
                            <h1 className="font-heading font-black text-lg leading-none">Content OS</h1>
                            <p className="text-[10px] text-white/50 font-body">نظام تشغيل المحتوى</p>
                        </div>
                    </div>
                </div>
                <div className="flex gap-1 overflow-x-auto -mx-4 px-4 scrollbar-none">
                    {tabs.map((t) => (
                        <NavLink
                            key={t.to}
                            to={t.to}
                            end={t.end}
                            data-testid={`content-tab-${t.to.split('/').pop()||'dashboard'}`}
                            className={({ isActive }) =>
                                `flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-heading font-semibold whitespace-nowrap transition ${
                                    isActive ? "bg-[#E3FF00] text-black" : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
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
