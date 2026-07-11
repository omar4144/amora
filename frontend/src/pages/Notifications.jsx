import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { Bell, Heart, MessageCircle, Package, Star, DollarSign } from "lucide-react";

const iconFor = (t) => ({
    order: Package, comment: MessageCircle, message: MessageCircle,
    review: Star, payment: DollarSign, like: Heart,
})[t] || Bell;

export default function Notifications() {
    const [items, setItems] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        api.get("/notifications").then((r) => setItems(r.data.items));
        api.post("/notifications/mark-seen").catch(() => {});
    }, []);

    const onClick = (n) => {
        if (n.type === "order" || n.type === "payment" || n.type === "review") return navigate("/orders");
        if (n.type === "message" && n.from_user) return navigate(`/messages/${n.from_user.username}`);
        if (n.type === "comment" && n.from_user) return navigate("/");
    };

    return (
        <div className="p-6 pt-8 font-body" data-testid="notifications-page">
            <div className="flex items-center gap-2 mb-6">
                <Bell className="w-6 h-6 text-[#D1795F]" />
                <h1 className="text-3xl font-heading font-black">الإشعارات</h1>
            </div>

            {items.length === 0 && <div className="text-center py-16 text-neutral-500">لا توجد إشعارات</div>}

            <div className="space-y-2">
                {items.map((n) => {
                    const Icon = iconFor(n.type);
                    return (
                        <button
                            key={n.id}
                            onClick={() => onClick(n)}
                            data-testid={`notif-${n.id}`}
                            className={`w-full text-start flex items-start gap-3 rounded-2xl p-3 border transition ${n.seen ? "bg-[#141414] border-[#262626]" : "bg-[#1a1a08] border-[#D1795F]/30"}`}
                        >
                            <div className="w-10 h-10 rounded-full bg-[#D1795F]/20 shrink-0 flex items-center justify-center">
                                <Icon className="w-5 h-5 text-[#D1795F]" />
                            </div>
                            <div className="flex-1">
                                <div className="text-sm text-white">{n.text}</div>
                                <div className="text-xs text-neutral-500 mt-1">{new Date(n.created_at).toLocaleString("ar")}</div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
