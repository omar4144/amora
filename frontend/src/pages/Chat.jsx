import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ChevronRight, Send } from "lucide-react";

export default function Chat() {
    const { username } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [other, setOther] = useState(null);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState("");
    const endRef = useRef(null);

    const load = () => {
        api.get(`/messages/with/${username}`).then((r) => {
            setOther(r.data.user);
            setMessages(r.data.messages);
            setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        });
    };

    useEffect(() => {
        load();
        const t = setInterval(load, 5000);
        return () => clearInterval(t);
    }, [username]);

    const send = async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        try {
            const res = await api.post(`/messages/with/${username}`, { text });
            setMessages((m) => [...m, res.data]);
            setText("");
        } catch {}
    };

    if (!other) return <div className="p-8 text-center text-neutral-500">جارٍ التحميل...</div>;

    return (
        <div className="min-h-[100dvh] flex flex-col font-body" data-testid="chat-page">
            <div className="sticky top-0 bg-black/95 backdrop-blur-xl border-b border-white/10 p-3 flex items-center gap-3 z-10">
                <button onClick={() => navigate(-1)}><ChevronRight className="w-5 h-5" /></button>
                <div className="w-10 h-10 rounded-full bg-[#D1795F] flex items-center justify-center text-black font-heading font-black">{other.name?.[0]}</div>
                <div>
                    <div className="font-heading font-bold">{other.name}</div>
                    <div className="text-xs text-neutral-500">@{other.username}</div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-24">
                {messages.length === 0 && <div className="text-center text-neutral-500 py-10">ابدأ المحادثة</div>}
                {messages.map((m) => {
                    const mine = m.sender_id === user.id;
                    return (
                        <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${mine ? "bg-[#D1795F] text-white" : "bg-[#1F1F1F] text-white"}`} data-testid={`msg-${m.id}`}>
                                {m.text}
                            </div>
                        </div>
                    );
                })}
                <div ref={endRef} />
            </div>

            <form onSubmit={send} className="fixed bottom-0 inset-x-0 max-w-md mx-auto p-3 bg-black/95 backdrop-blur-xl border-t border-white/10 flex gap-2">
                <input
                    data-testid="chat-input"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="اكتب رسالة..."
                    className="flex-1 bg-[#141414] border border-[#262626] rounded-full px-4 py-2.5 focus:border-[#D1795F] focus:outline-none text-sm"
                />
                <button type="submit" data-testid="send-msg-btn" className="w-11 h-11 rounded-full bg-[#D1795F] text-white flex items-center justify-center active:scale-95">
                    <Send className="w-5 h-5" />
                </button>
            </form>
        </div>
    );
}
