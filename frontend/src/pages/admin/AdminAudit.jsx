import { useEffect, useState } from "react";
import api from "@/lib/api";
import { UserCog, Ban, Check } from "lucide-react";

const ICONS = { change_role: UserCog, ban: Ban, unban: Check };
const LABELS = { change_role: "تغيير دور", ban: "حظر", unban: "رفع حظر" };

export default function AdminAudit() {
    const [logs, setLogs] = useState([]);
    useEffect(() => { api.get("/admin/audit").then((r) => setLogs(r.data)); }, []);

    return (
        <div data-testid="admin-audit" className="p-4 space-y-2">
            {logs.length === 0 && <div className="text-center py-16 text-white/40 text-sm">لا يوجد أحداث</div>}
            {logs.map((l) => {
                const Icon = ICONS[l.action] || UserCog;
                return (
                    <div key={l.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#D1795F]/10 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-4 h-4 text-[#D1795F]" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm text-white font-heading font-semibold">
                                {LABELS[l.action] || l.action}
                            </div>
                            <div className="text-[11px] text-white/60 font-body mt-0.5">
                                @{l.actor?.username || "?"} → @{l.target?.username || "?"}
                                {l.meta?.new_role && ` • → ${l.meta.new_role}`}
                                {l.meta?.reason && ` • "${l.meta.reason}"`}
                            </div>
                            <div className="text-[10px] text-white/40 mt-1">{new Date(l.created_at).toLocaleString('ar')}</div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
