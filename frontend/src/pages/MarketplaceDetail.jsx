import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { ChevronRight, DollarSign, Clock, Users } from "lucide-react";

export default function MarketplaceDetail() {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [req, setReq] = useState(null);
    const [msg, setMsg] = useState("");
    const [price, setPrice] = useState("");

    const load = () => api.get(`/project-requests/${id}`).then((r) => setReq(r.data));
    useEffect(load, [id]);

    const apply = async (e) => {
        e.preventDefault();
        if (!user) return navigate("/auth");
        try {
            await api.post(`/project-requests/${id}/apply`, { message: msg, proposed_price: parseFloat(price || 0) });
            toast.success("تم إرسال طلبك");
            setMsg(""); setPrice(""); load();
        } catch (err) {
            toast.error(err?.response?.data?.detail || "خطأ");
        }
    };

    if (!req) return <div className="p-8 text-center text-neutral-500">جارٍ التحميل...</div>;
    const isOwner = user && user.id === req.user_id;

    return (
        <div className="p-6 pt-8 font-body pb-24" data-testid="request-detail">
            <button onClick={() => navigate(-1)} className="text-neutral-400 mb-4 flex items-center gap-1 text-sm"><ChevronRight className="w-4 h-4" /> رجوع</button>
            <span className="text-xs bg-[#D1795F]/20 text-[#D1795F] px-2 py-1 rounded-full">{req.category}</span>
            <h1 className="text-2xl font-heading font-black mt-3 mb-3">{req.title}</h1>
            <Link to={`/u/${req.user?.username}`} className="text-sm text-neutral-400 mb-4 block">بواسطة @{req.user?.username}</Link>
            <p className="text-neutral-300 leading-relaxed mb-6 whitespace-pre-line">{req.description}</p>

            <div className="grid grid-cols-3 gap-2 mb-6">
                <div className="bg-[#141414] border border-[#262626] rounded-xl p-3 text-center">
                    <DollarSign className="w-4 h-4 text-[#D1795F] mx-auto mb-1" />
                    <div className="text-sm font-heading font-bold">${req.budget_min}-${req.budget_max}</div>
                </div>
                <div className="bg-[#141414] border border-[#262626] rounded-xl p-3 text-center">
                    <Clock className="w-4 h-4 text-[#D1795F] mx-auto mb-1" />
                    <div className="text-sm font-heading font-bold">{req.deadline_days} يوم</div>
                </div>
                <div className="bg-[#141414] border border-[#262626] rounded-xl p-3 text-center">
                    <Users className="w-4 h-4 text-[#D1795F] mx-auto mb-1" />
                    <div className="text-sm font-heading font-bold">{req.applications_count}</div>
                </div>
            </div>

            {!isOwner && (
                <form onSubmit={apply} className="bg-[#141414] border border-[#262626] rounded-2xl p-4 mb-6">
                    <h3 className="font-heading font-bold mb-3">قدّم على هذا المشروع</h3>
                    <textarea required data-testid="apply-msg" placeholder="لماذا أنت الشخص المناسب؟" rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} className="w-full bg-black border border-[#262626] rounded-xl px-4 py-3 focus:border-[#D1795F] focus:outline-none resize-none mb-3" />
                    <input type="number" min="0" data-testid="apply-price" placeholder="سعرك المقترح ($)" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full bg-black border border-[#262626] rounded-xl px-4 py-3 focus:border-[#D1795F] focus:outline-none mb-3" />
                    <button data-testid="apply-btn" type="submit" className="w-full bg-[#D1795F] text-white font-heading font-bold rounded-full py-3">إرسال العرض</button>
                </form>
            )}

            {isOwner && req.applications?.length > 0 && (
                <div>
                    <h3 className="font-heading font-bold mb-3">المتقدمون ({req.applications.length})</h3>
                    <div className="space-y-2">
                        {req.applications.map((a) => (
                            <div key={a.id} className="bg-[#141414] border border-[#262626] rounded-2xl p-3" data-testid={`app-${a.id}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <Link to={`/u/${a.user?.username}`} className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-[#D1795F] flex items-center justify-center text-black font-heading font-black text-xs">{a.user?.name?.[0]}</div>
                                        <div className="text-sm font-heading font-bold">@{a.user?.username}</div>
                                    </Link>
                                    {a.proposed_price > 0 && <span className="text-[#D1795F] font-heading font-black">${a.proposed_price}</span>}
                                </div>
                                <p className="text-sm text-neutral-300">{a.message}</p>
                                <Link to={`/messages/${a.user?.username}`} className="text-xs text-[#D1795F] mt-2 inline-block">تواصل →</Link>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
