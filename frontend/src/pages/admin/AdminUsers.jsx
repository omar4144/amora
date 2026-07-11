import { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Search, Ban, Check, ChevronDown } from "lucide-react";

export default function AdminUsers() {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [q, setQ] = useState("");
    const [openMenu, setOpenMenu] = useState(null);

    const load = () => api.get("/admin/users").then((r) => setUsers(r.data));
    useEffect(() => {
        load();
        api.get("/admin/roles").then((r) => setRoles(r.data));
    }, []);

    const filtered = useMemo(() => {
        if (!q.trim()) return users;
        const s = q.toLowerCase();
        return users.filter((u) => [u.name, u.username, u.email].some((v) => (v||"").toLowerCase().includes(s)));
    }, [q, users]);

    const changeRole = async (u, newRole) => {
        try {
            await api.put(`/admin/users/${u.id}/role`, { role: newRole });
            toast.success("تم تغيير الدور");
            setOpenMenu(null);
            await load();
        } catch (e) { toast.error(e.response?.data?.detail || "خطأ"); }
    };

    const toggleBan = async (u) => {
        const reason = u.is_banned ? "" : window.prompt("سبب الحظر:", "") || "";
        try {
            await api.put(`/admin/users/${u.id}/ban`, { banned: !u.is_banned, reason });
            toast.success(u.is_banned ? "تم رفع الحظر" : "تم الحظر");
            await load();
        } catch (e) { toast.error(e.response?.data?.detail || "خطأ"); }
    };

    return (
        <div data-testid="admin-users" className="p-4 space-y-4">
            <div className="relative">
                <Search className="w-4 h-4 text-white/40 absolute right-3 top-1/2 -translate-y-1/2" />
                <input data-testid="admin-search" placeholder="بحث..." value={q} onChange={(e) => setQ(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder-white/40 focus:border-[#D1795F] outline-none" />
            </div>

            <div className="space-y-2">
                <div className="text-xs text-white/50 font-body">{filtered.length} مستخدم</div>
                {filtered.map((u) => (
                    <div key={u.id} data-testid={`admin-user-${u.id}`} className={`bg-white/5 border rounded-2xl p-3 ${u.is_banned ? "border-red-500/30" : "border-white/10"}`}>
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 text-sm font-heading font-bold text-white">
                                {u.name?.[0] || "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-heading font-bold text-white truncate">{u.name}</span>
                                    <span className="text-[10px] text-white/50">@{u.username}</span>
                                    {u.is_banned && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">محظور</span>}
                                </div>
                                <div className="text-[11px] text-white/50 mt-0.5 truncate">{u.email}</div>
                                <div className="flex items-center gap-2 mt-2">
                                    <div className="relative">
                                        <button onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)} className="flex items-center gap-1 px-2 py-1 rounded-lg border font-heading font-semibold text-[11px]" style={{ backgroundColor: `${u.role_meta.color}20`, borderColor: `${u.role_meta.color}60`, color: u.role_meta.color }}>
                                            {u.role_meta.name} <ChevronDown className="w-3 h-3" />
                                        </button>
                                        {openMenu === u.id && (
                                            <div className="absolute top-full mt-1 right-0 bg-[#0F0F0F] border border-white/20 rounded-xl p-1 z-10 min-w-[160px] shadow-2xl">
                                                {roles.map((r) => (
                                                    <button key={r.key} onClick={() => changeRole(u, r.key)} className="w-full text-start px-3 py-2 rounded-lg hover:bg-white/5 text-xs font-heading flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: r.color }} />
                                                        {r.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => toggleBan(u)} className={`px-2 py-1 rounded-lg text-[11px] font-heading font-semibold flex items-center gap-1 ${u.is_banned ? "bg-[#C3E0A5]/20 text-[#C3E0A5] border border-[#C3E0A5]/40" : "bg-red-500/10 text-red-400 border border-red-500/30"}`}>
                                        {u.is_banned ? <><Check className="w-3 h-3" /> رفع الحظر</> : <><Ban className="w-3 h-3" /> حظر</>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
