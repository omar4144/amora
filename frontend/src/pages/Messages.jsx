import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { MessageCircle } from "lucide-react";

export default function Messages() {
    const [convs, setConvs] = useState([]);

    useEffect(() => {
        api.get("/messages/conversations").then((r) => setConvs(r.data));
    }, []);

    return (
        <div className="p-6 pt-8 font-body" data-testid="messages-page">
            <div className="flex items-center gap-2 mb-6">
                <MessageCircle className="w-6 h-6 text-[#D1795F]" />
                <h1 className="text-3xl font-heading font-black">الرسائل</h1>
            </div>
            {convs.length === 0 && <div className="text-center py-16 text-neutral-500">لا توجد محادثات بعد. ابدأ من صفحة أي صانع محتوى</div>}
            <div className="space-y-2">
                {convs.map((c) => (
                    <Link
                        key={c.conv_id}
                        to={`/messages/${c.user.username}`}
                        data-testid={`conv-${c.user.username}`}
                        className="flex items-center gap-3 bg-[#141414] border border-[#262626] hover:border-[#D1795F] rounded-2xl p-3 transition"
                    >
                        <div className="w-12 h-12 rounded-full bg-[#D1795F] flex items-center justify-center text-black font-heading font-black">{c.user.name?.[0]}</div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                                <div className="font-heading font-bold">@{c.user.username}</div>
                                {c.unread > 0 && <span className="bg-[#D1795F] text-white text-xs font-bold rounded-full px-2 py-0.5">{c.unread}</span>}
                            </div>
                            <div className="text-sm text-neutral-400 truncate">{c.last_text}</div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
