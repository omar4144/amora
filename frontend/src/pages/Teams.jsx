import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { UsersRound, Plus, X } from "lucide-react";

const KINDS = [{ id: "team", label: "فريق" }, { id: "agency", label: "وكالة" }, { id: "studio", label: "استوديو" }, { id: "company", label: "شركة" }];

export default function Teams() {
    const [items, setItems] = useState([]);
    const [show, setShow] = useState(false);
    const [f, setF] = useState({ name: "", description: "", kind: "team" });
    const { user } = useAuth();
    const navigate = useNavigate();

    const load = () => api.get("/teams").then((r) => setItems(r.data));
    useEffect(load, []);

    const create = async (e) => {
        e.preventDefault();
        if (!user) return navigate("/auth");
        try {
            await api.post("/teams", f);
            toast.success("أنشئ الفريق");
            setShow(false); setF({ name: "", description: "", kind: "team" });
            load();
        } catch { toast.error("خطأ"); }
    };

    return (
        <div className="p-6 pt-8 font-body" data-testid="teams-page">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2"><UsersRound className="w-6 h-6 text-[#E3FF00]" /><h1 className="text-3xl font-heading font-black">الفرق</h1></div>
                <button data-testid="new-team-btn" onClick={() => user ? setShow(true) : navigate("/auth")} className="bg-[#E3FF00] text-black font-heading font-bold rounded-full px-4 py-2 text-sm flex items-center gap-1"><Plus className="w-4 h-4" /> فريق</button>
            </div>
            {items.length === 0 && <div className="text-center py-16 text-neutral-500">لا توجد فرق بعد. كن أول من ينشئ</div>}
            <div className="space-y-3">
                {items.map((t) => (
                    <Link key={t.id} to={`/teams/${t.id}`} data-testid={`team-${t.id}`} className="block bg-[#141414] border border-[#262626] hover:border-[#E3FF00] rounded-2xl p-4 transition">
                        <div className="flex items-start justify-between mb-1">
                            <h3 className="font-heading font-bold">{t.name}</h3>
                            <span className="text-[10px] bg-[#E3FF00]/20 text-[#E3FF00] px-2 py-0.5 rounded-full">{KINDS.find((k) => k.id === t.kind)?.label || t.kind}</span>
                        </div>
                        <p className="text-sm text-neutral-400 line-clamp-2 mb-2">{t.description}</p>
                        <div className="text-xs text-neutral-500">بقيادة @{t.owner?.username} · {t.members_count} عضو</div>
                    </Link>
                ))}
            </div>

            {show && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShow(false)}>
                    <form onSubmit={create} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 space-y-3" data-testid="new-team-modal">
                        <div className="flex items-center justify-between"><h3 className="font-heading font-black text-lg">إنشاء فريق</h3><button type="button" onClick={() => setShow(false)}><X className="w-5 h-5" /></button></div>
                        <input required data-testid="team-name" placeholder="اسم الفريق" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#E3FF00] focus:outline-none" />
                        <textarea required data-testid="team-desc" placeholder="ما الذي يميز فريقكم؟" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#E3FF00] focus:outline-none resize-none" />
                        <div className="grid grid-cols-4 gap-2">
                            {KINDS.map((k) => <button key={k.id} type="button" onClick={() => setF({ ...f, kind: k.id })} className={`text-xs py-2 rounded-lg font-heading font-bold ${f.kind === k.id ? "bg-[#E3FF00] text-black" : "bg-[#141414] border border-[#262626]"}`}>{k.label}</button>)}
                        </div>
                        <button data-testid="submit-team" type="submit" className="w-full bg-[#E3FF00] text-black font-heading font-bold rounded-full py-3">إنشاء</button>
                    </form>
                </div>
            )}
        </div>
    );
}
