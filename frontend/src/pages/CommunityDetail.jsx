import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Heart, ChevronRight, Send } from "lucide-react";

export default function CommunityDetail() {
    const { slug } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [c, setC] = useState(null);
    const [posts, setPosts] = useState([]);
    const [text, setText] = useState("");

    const load = () => {
        api.get(`/communities/${slug}`).then((r) => setC(r.data));
        api.get(`/communities/${slug}/posts`).then((r) => setPosts(r.data));
    };
    useEffect(load, [slug]);

    const join = async () => {
        if (!user) return navigate("/auth");
        const r = await api.post(`/communities/${slug}/join`);
        setC({ ...c, joined: r.data.joined, members_count: c.members_count + (r.data.joined ? 1 : -1) });
    };

    const post = async (e) => {
        e.preventDefault();
        if (!user) return navigate("/auth");
        if (!text.trim()) return;
        try {
            const r = await api.post(`/communities/${slug}/posts`, { text });
            setPosts([r.data, ...posts]);
            setText("");
        } catch { toast.error("خطأ"); }
    };

    const like = async (id) => {
        if (!user) return navigate("/auth");
        const r = await api.post(`/posts/${id}/like`);
        setPosts(posts.map((p) => p.id === id ? { ...p, liked: r.data.liked, likes: p.likes + (r.data.liked ? 1 : -1) } : p));
    };

    if (!c) return <div className="p-8 text-center text-neutral-500">جارٍ التحميل...</div>;

    return (
        <div className="pb-24 font-body" data-testid="community-page">
            <div className="bg-gradient-to-b from-[#141414] to-black p-6 pt-8">
                <button onClick={() => navigate(-1)} className="text-neutral-400 mb-3 flex items-center gap-1 text-sm"><ChevronRight className="w-4 h-4" /> رجوع</button>
                <div className="text-5xl mb-2">{c.icon}</div>
                <h1 className="text-2xl font-heading font-black">{c.name}</h1>
                <div className="text-sm text-neutral-400 mb-4">{c.members_count} عضو</div>
                <button onClick={join} data-testid="join-btn" className={`w-full rounded-full py-2.5 font-heading font-bold text-sm transition ${c.joined ? "bg-white/10" : "bg-[#E3FF00] text-black"}`}>
                    {c.joined ? "عضو ✓" : "انضم للمجتمع"}
                </button>
            </div>

            <div className="p-4">
                {c.joined && (
                    <form onSubmit={post} className="bg-[#141414] border border-[#262626] rounded-2xl p-3 mb-4 flex gap-2">
                        <input data-testid="post-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="شارك فكرة أو نقاش..." className="flex-1 bg-black border border-[#262626] rounded-full px-4 py-2.5 focus:border-[#E3FF00] focus:outline-none text-sm" />
                        <button type="submit" data-testid="submit-post" className="w-10 h-10 rounded-full bg-[#E3FF00] text-black flex items-center justify-center"><Send className="w-4 h-4" /></button>
                    </form>
                )}
                {posts.length === 0 && <div className="text-center py-16 text-neutral-500">لا منشورات بعد. كن أول من ينشر</div>}
                <div className="space-y-3">
                    {posts.map((p) => (
                        <div key={p.id} className="bg-[#141414] border border-[#262626] rounded-2xl p-4" data-testid={`post-${p.id}`}>
                            <Link to={`/u/${p.user?.username}`} className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-full bg-[#E3FF00] flex items-center justify-center text-black font-heading font-black text-xs">{p.user?.name?.[0]}</div>
                                <div>
                                    <div className="text-sm font-heading font-bold">{p.user?.name}</div>
                                    <div className="text-[10px] text-neutral-500">@{p.user?.username}</div>
                                </div>
                            </Link>
                            <p className="text-sm text-white/90 whitespace-pre-line mb-3">{p.text}</p>
                            <button onClick={() => like(p.id)} data-testid={`like-post-${p.id}`} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-[#E3FF00]">
                                <Heart className={`w-4 h-4 ${p.liked ? "fill-[#E3FF00] text-[#E3FF00]" : ""}`} /> {p.likes || 0}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
