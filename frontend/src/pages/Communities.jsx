import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Users } from "lucide-react";

export default function Communities() {
    const [items, setItems] = useState([]);
    useEffect(() => { api.get("/communities").then((r) => setItems(r.data)); }, []);
    return (
        <div className="p-6 pt-8 font-body" data-testid="communities-page">
            <div className="flex items-center gap-2 mb-6">
                <Users className="w-6 h-6 text-[#E3FF00]" />
                <h1 className="text-3xl font-heading font-black">المجتمعات</h1>
            </div>
            <p className="text-sm text-neutral-400 mb-6">انضم لمجتمعك واشارك النقاشات والفرص</p>
            <div className="grid grid-cols-2 gap-3">
                {items.map((c) => (
                    <Link key={c.slug} to={`/communities/${c.slug}`} data-testid={`community-${c.slug}`}
                        className={`bg-[#141414] border rounded-2xl p-4 transition ${c.joined ? "border-[#E3FF00]" : "border-[#262626] hover:border-white/30"}`}>
                        <div className="text-3xl mb-2">{c.icon}</div>
                        <div className="font-heading font-bold">{c.name}</div>
                        {c.joined && <div className="text-[10px] text-[#E3FF00] mt-1">✓ عضو</div>}
                    </Link>
                ))}
            </div>
        </div>
    );
}
