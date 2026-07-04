import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ChevronRight, Crown } from "lucide-react";

export default function TeamDetail() {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [t, setT] = useState(null);

    const load = () => api.get(`/teams/${id}`).then((r) => setT(r.data));
    useEffect(load, [id]);

    const join = async () => {
        if (!user) return navigate("/auth");
        await api.post(`/teams/${id}/join`);
        load();
    };

    if (!t) return <div className="p-8 text-center text-neutral-500">جارٍ التحميل...</div>;
    const isOwner = user && user.id === t.owner_id;

    return (
        <div className="p-6 pt-8 font-body pb-24" data-testid="team-page">
            <button onClick={() => navigate(-1)} className="text-neutral-400 mb-4 flex items-center gap-1 text-sm"><ChevronRight className="w-4 h-4" /> رجوع</button>
            <span className="text-xs bg-[#E3FF00]/20 text-[#E3FF00] px-2 py-1 rounded-full">{t.kind}</span>
            <h1 className="text-2xl font-heading font-black mt-3 mb-2">{t.name}</h1>
            <p className="text-neutral-300 leading-relaxed mb-4">{t.description}</p>
            <div className="text-xs text-neutral-500 mb-6">بقيادة @{t.owner?.username} · {t.members_count} عضو</div>

            {!isOwner && (
                <button onClick={join} data-testid="join-team-btn" className={`w-full rounded-full py-3 font-heading font-bold mb-6 ${t.joined ? "bg-white/10" : "bg-[#E3FF00] text-black"}`}>
                    {t.joined ? "عضو ✓ (اضغط للخروج)" : "انضم للفريق"}
                </button>
            )}

            <h3 className="font-heading font-bold mb-3">الأعضاء</h3>
            <div className="space-y-2">
                {t.members?.map((m) => (
                    <Link key={m.id} to={`/u/${m.user?.username}`} className="flex items-center gap-3 bg-[#141414] border border-[#262626] rounded-2xl p-3 hover:border-[#E3FF00] transition" data-testid={`member-${m.user?.username}`}>
                        <div className="w-10 h-10 rounded-full bg-[#E3FF00] flex items-center justify-center text-black font-heading font-black">{m.user?.name?.[0]}</div>
                        <div className="flex-1">
                            <div className="font-heading font-bold text-sm">{m.user?.name}</div>
                            <div className="text-xs text-neutral-500">@{m.user?.username}</div>
                        </div>
                        {m.role === "owner" && <Crown className="w-4 h-4 text-[#E3FF00]" />}
                    </Link>
                ))}
            </div>
        </div>
    );
}
