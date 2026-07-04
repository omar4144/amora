import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Link } from "react-router-dom";
import { Users, TrendingUp, UsersRound, MessageCircle } from "lucide-react";

export default function Explore() {
    const [creators, setCreators] = useState([]);

    useEffect(() => {
        api.get("/explore/creators").then((r) => setCreators(r.data));
    }, []);

    return (
        <div className="p-6 pt-8 font-body" data-testid="explore-page">
            <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-6 h-6 text-[#E3FF00]" />
                <h1 className="text-3xl font-heading font-black">اكتشف</h1>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
                <Link to="/communities" data-testid="link-communities" className="bg-gradient-to-br from-[#E3FF00]/20 to-transparent border border-[#E3FF00]/30 rounded-2xl p-4 hover:border-[#E3FF00] transition">
                    <Users className="w-8 h-8 text-[#E3FF00] mb-2" />
                    <div className="font-heading font-bold">المجتمعات</div>
                    <div className="text-[10px] text-neutral-500 mt-1">انضم لمجتمع تخصصك</div>
                </Link>
                <Link to="/teams" data-testid="link-teams" className="bg-gradient-to-br from-[#E3FF00]/10 to-transparent border border-white/10 rounded-2xl p-4 hover:border-[#E3FF00] transition">
                    <UsersRound className="w-8 h-8 text-[#E3FF00] mb-2" />
                    <div className="font-heading font-bold">الفرق</div>
                    <div className="text-[10px] text-neutral-500 mt-1">فرق ووكالات واستوديوهات</div>
                </Link>
                <Link to="/messages" data-testid="link-messages" className="bg-[#141414] border border-[#262626] hover:border-white/30 rounded-2xl p-4">
                    <MessageCircle className="w-8 h-8 text-[#E3FF00] mb-2" />
                    <div className="font-heading font-bold">الرسائل</div>
                </Link>
                <Link to="/search" data-testid="link-search" className="bg-[#141414] border border-[#262626] hover:border-white/30 rounded-2xl p-4">
                    <TrendingUp className="w-8 h-8 text-[#E3FF00] mb-2" />
                    <div className="font-heading font-bold">البحث</div>
                </Link>
            </div>

            <h2 className="font-heading font-bold text-neutral-400 mb-3 text-sm">أفضل صناع المحتوى</h2>
            <div className="grid grid-cols-2 gap-3">
                {creators.length === 0 && <div className="col-span-2 py-16 text-center text-neutral-500">لا يوجد صناع محتوى بعد</div>}
                {creators.map((c) => (
                    <Link
                        key={c.id}
                        to={`/u/${c.username}`}
                        data-testid={`creator-${c.username}`}
                        className="bg-[#141414] border border-[#262626] hover:border-[#E3FF00] rounded-2xl p-4 transition-all group"
                    >
                        <div className="w-16 h-16 rounded-full bg-[#E3FF00] mb-3 flex items-center justify-center text-black text-2xl font-heading font-black group-hover:scale-105 transition">
                            {c.name?.[0] || "?"}
                        </div>
                        <div className="font-heading font-bold text-sm truncate">{c.name}</div>
                        <div className="text-xs text-neutral-500 truncate">@{c.username}</div>
                        <div className="flex items-center gap-1 text-xs text-neutral-400 mt-2">
                            <Users className="w-3 h-3" />
                            {c.followers || 0} متابع
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
