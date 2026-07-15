import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useRealtime } from "@/context/RealtimeContext";
import { ChevronRight, Send, Paperclip, X, Image as ImageIcon, Video as VideoIcon, FileText } from "lucide-react";
import { toast } from "sonner";

export default function Chat() {
    const { username } = useParams();
    const { user } = useAuth();
    const { subscribe } = useRealtime();
    const navigate = useNavigate();
    const [other, setOther] = useState(null);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState("");
    const [pending, setPending] = useState(null); // {media_url, media_type, filename}
    const [uploading, setUploading] = useState(false);
    const endRef = useRef(null);
    const fileRef = useRef(null);

    const load = () => {
        api.get(`/messages/with/${username}`).then((r) => {
            setOther(r.data.user);
            setMessages(r.data.messages);
            setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        });
    };

    useEffect(() => {
        load();
        const t = setInterval(load, 15000);  // less aggressive polling; WS handles live
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [username]);

    // WS live message listener
    useEffect(() => {
        const off = subscribe("message", (data) => {
            if (data?.from_username === username || data?.sender_id === other?.id) {
                setMessages((m) => [...m, data]);
                setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
            }
        });
        return off;
    }, [subscribe, username, other]);

    const onPickMedia = () => fileRef.current?.click();

    const onFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const r = await api.post("/messages/media", fd, { headers: { "Content-Type": "multipart/form-data" } });
            setPending(r.data);
        } catch (err) {
            toast.error(err.response?.data?.detail || "تعذّر الرفع");
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const send = async (e) => {
        e.preventDefault();
        if (!text.trim() && !pending) return;
        const body = { text: text.trim(), media_url: pending?.media_url || null, media_type: pending?.media_type || null };
        try {
            const res = await api.post(`/messages/with/${username}`, body);
            setMessages((m) => [...m, res.data]);
            setText("");
            setPending(null);
            setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        } catch (err) {
            toast.error(err.response?.data?.detail || "تعذّر الإرسال");
        }
    };

    if (!other) return <div className="p-8 text-center text-neutral-500">جارٍ التحميل...</div>;

    return (
        <div className="min-h-[100dvh] flex flex-col font-body" data-testid="chat-page">
            <div className="sticky top-0 bg-black/95 backdrop-blur-xl border-b border-white/10 p-3 flex items-center gap-3 z-10">
                <button onClick={() => navigate(-1)}><ChevronRight className="w-5 h-5" /></button>
                <div className="w-10 h-10 rounded-full bg-[#D1795F] flex items-center justify-center overflow-hidden text-black font-heading font-black">
                    {other.avatar_url ? <img src={other.avatar_url} alt="" className="w-full h-full object-cover" /> : other.name?.[0]}
                </div>
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
                            <div className={`max-w-[80%] rounded-2xl overflow-hidden text-sm ${mine ? "bg-[#D1795F] text-white" : "bg-[#1F1F1F] text-white"}`} data-testid={`msg-${m.id}`}>
                                {m.media_url && (
                                    <MediaPreview url={m.media_url} type={m.media_type} />
                                )}
                                {m.text && <div className="px-4 py-2">{m.text}</div>}
                            </div>
                        </div>
                    );
                })}
                <div ref={endRef} />
            </div>

            {pending && (
                <div className="fixed bottom-16 inset-x-0 max-w-md mx-auto px-3 pb-2 z-[60]">
                    <div className="bg-[#141414] border border-[#D1795F]/40 rounded-xl p-2 flex items-center gap-2" data-testid="pending-media">
                        <div className="w-10 h-10 rounded-lg bg-[#D1795F]/20 flex items-center justify-center flex-shrink-0">
                            {pending.media_type === "image" ? <ImageIcon className="w-4 h-4 text-[#D1795F]" /> : pending.media_type === "video" ? <VideoIcon className="w-4 h-4 text-[#D1795F]" /> : <FileText className="w-4 h-4 text-[#D1795F]" />}
                        </div>
                        <div className="flex-1 min-w-0 text-xs text-white truncate">{pending.filename || pending.media_type}</div>
                        <button onClick={() => setPending(null)} className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center">
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            )}

            <form onSubmit={send} className="fixed bottom-0 inset-x-0 max-w-md mx-auto p-3 bg-black/95 backdrop-blur-xl border-t border-white/10 flex gap-2 items-center z-[60]">
                <input ref={fileRef} type="file" accept="image/*,video/*,application/pdf" onChange={onFileChange} className="hidden" data-testid="chat-media-input" />
                <button type="button" data-testid="chat-attach-btn" onClick={onPickMedia} disabled={uploading} className="w-11 h-11 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0 disabled:opacity-50">
                    <Paperclip className={`w-5 h-5 text-white/70 ${uploading ? "animate-pulse" : ""}`} />
                </button>
                <input
                    data-testid="chat-input"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={pending ? "أضف تعليقاً (اختياري)..." : "اكتب رسالة..."}
                    className="flex-1 bg-[#141414] border border-[#262626] rounded-full px-4 py-2.5 focus:border-[#D1795F] focus:outline-none text-sm"
                />
                <button type="submit" data-testid="send-msg-btn" className="w-11 h-11 rounded-full bg-[#D1795F] text-white flex items-center justify-center active:scale-95">
                    <Send className="w-5 h-5" />
                </button>
            </form>
        </div>
    );
}


function MediaPreview({ url, type }) {
    if (type === "image") {
        return <img src={url} alt="" className="max-w-full max-h-64 object-cover" onClick={() => window.open(url, "_blank")} />;
    }
    if (type === "video") {
        return <video src={url} controls className="max-w-full max-h-64" />;
    }
    return (
        <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 bg-black/20">
            <FileText className="w-4 h-4" />
            <span className="text-xs underline">تحميل الملف</span>
        </a>
    );
}
