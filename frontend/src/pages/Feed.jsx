import { useEffect, useState, useRef } from "react";
import api, { API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Heart, MessageCircle, Share2, ShoppingBag, Play, Sparkles, ChevronLeft, X, Search as SearchIcon, Bell } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";

const VideoCard = ({ v, onLike, onOpenComments, onOpenServices, onView }) => {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(true);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.intersectionRatio > 0.6) {
                        videoRef.current?.play().catch(() => {});
                        setPlaying(true);
                        onView?.(v.id);
                    } else {
                        videoRef.current?.pause();
                        setPlaying(false);
                    }
                });
            },
            { threshold: [0.6] }
        );
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [v.id]);

    const togglePlay = () => {
        if (videoRef.current.paused) {
            videoRef.current.play();
            setPlaying(true);
        } else {
            videoRef.current.pause();
            setPlaying(false);
        }
    };

    return (
        <div
            ref={containerRef}
            className="h-[100dvh] w-full snap-start relative flex flex-col justify-end bg-black"
            data-testid={`video-card-${v.id}`}
        >
            <video
                ref={videoRef}
                src={`${API}/videos/stream/${v.id}`}
                className="absolute inset-0 w-full h-full object-cover"
                playsInline
                loop
                muted={muted}
                onClick={togglePlay}
            />

            {!playing && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-black/50 backdrop-blur-md rounded-full p-4">
                        <Play className="w-10 h-10 text-white" fill="white" />
                    </div>
                </div>
            )}

            {/* Text overlay - right side (RTL primary content) */}
            <div className="absolute bottom-20 right-0 p-4 w-[70%] z-10 bg-gradient-to-t from-black/95 via-black/40 to-transparent">
                <Link
                    to={`/u/${v.creator?.username}`}
                    className="inline-flex items-center gap-2 mb-3 group"
                    data-testid={`video-creator-${v.id}`}
                >
                    <div className="w-10 h-10 rounded-full bg-[#D1795F] flex items-center justify-center text-black font-heading font-black text-sm">
                        {v.creator?.name?.[0] || "?"}
                    </div>
                    <div>
                        <div className="font-heading font-bold text-white group-hover:text-[#D1795F] transition">
                            @{v.creator?.username}
                        </div>
                        <div className="text-xs text-neutral-400">{v.creator?.name}</div>
                    </div>
                </Link>
                {v.caption && <p className="text-sm text-white/90 leading-relaxed mb-1">{v.caption}</p>}
                <span className="inline-block text-xs bg-white/10 backdrop-blur-md px-2 py-1 rounded-full mt-1">
                    #{v.category}
                </span>
            </div>

            {/* Floating action buttons - left side */}
            <div className="absolute bottom-24 left-3 flex flex-col gap-5 items-center z-20">
                <button
                    onClick={() => onLike(v.id)}
                    data-testid={`like-btn-${v.id}`}
                    className="flex flex-col items-center gap-1 group"
                >
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md transition ${v.liked ? "bg-[#FF3366]" : "bg-white/10 hover:bg-white/20"}`}>
                        <Heart className="w-6 h-6 text-white" fill={v.liked ? "white" : "none"} />
                    </div>
                    <span className="text-xs text-white font-body font-medium">{v.likes || 0}</span>
                </button>

                <button
                    onClick={() => onOpenComments(v)}
                    data-testid={`comment-btn-${v.id}`}
                    className="flex flex-col items-center gap-1"
                >
                    <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition">
                        <MessageCircle className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xs text-white font-body">{v.comments_count || 0}</span>
                </button>

                <button
                    onClick={() => onOpenServices(v)}
                    data-testid={`services-btn-${v.id}`}
                    className="flex flex-col items-center gap-1"
                >
                    <div className="w-11 h-11 rounded-full bg-[#D1795F] flex items-center justify-center hover:bg-[#B86648] transition active:scale-95">
                        <ShoppingBag className="w-6 h-6 text-black" strokeWidth={2.4} />
                    </div>
                    <span className="text-xs text-white font-body font-bold">اطلب</span>
                </button>

                <button
                    onClick={() => setMuted(!muted)}
                    data-testid={`mute-btn-${v.id}`}
                    className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-xs"
                >
                    {muted ? "🔇" : "🔊"}
                </button>
            </div>
        </div>
    );
};

const CommentsSheet = ({ video, onClose, onCommentAdded }) => {
    const [comments, setComments] = useState([]);
    const [text, setText] = useState("");
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        api.get(`/videos/${video.id}/comments`).then((r) => setComments(r.data));
    }, [video.id]);

    const submit = async (e) => {
        e.preventDefault();
        if (!user) return navigate("/auth");
        if (!text.trim()) return;
        try {
            const res = await api.post(`/videos/${video.id}/comments`, { text });
            setComments([res.data, ...comments]);
            setText("");
            onCommentAdded();
        } catch {
            toast.error("خطأ في إضافة التعليق");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full max-w-md bg-[#0A0A0A] rounded-t-3xl max-h-[75vh] flex flex-col animate-slide-up"
                onClick={(e) => e.stopPropagation()}
                data-testid="comments-sheet"
            >
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h3 className="font-heading font-bold text-lg">التعليقات ({comments.length})</h3>
                    <button onClick={onClose} data-testid="close-comments"><X className="w-5 h-5" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                    {comments.length === 0 && <p className="text-neutral-500 text-center py-10">كن أول من يعلق</p>}
                    {comments.map((c) => (
                        <div key={c.id} className="flex gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#D1795F] shrink-0 flex items-center justify-center text-black font-heading font-black text-sm">
                                {c.user?.name?.[0]}
                            </div>
                            <div className="flex-1">
                                <div className="text-sm font-heading font-bold">@{c.user?.username}</div>
                                <div className="text-sm text-neutral-300">{c.text}</div>
                            </div>
                        </div>
                    ))}
                </div>
                <form onSubmit={submit} className="p-4 border-t border-white/10 flex gap-2">
                    <input
                        data-testid="comment-input"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="اكتب تعليقاً..."
                        className="flex-1 bg-[#141414] border border-[#262626] rounded-full px-4 py-2.5 text-white placeholder-neutral-500 focus:border-[#D1795F] focus:outline-none text-sm"
                    />
                    <button type="submit" data-testid="submit-comment" className="bg-[#D1795F] text-white font-heading font-bold px-5 rounded-full active:scale-95">
                        نشر
                    </button>
                </form>
            </div>
        </div>
    );
};

const ServicesSheet = ({ video, onClose }) => {
    const [services, setServices] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        api.get(`/services/user/${video.creator.username}`).then((r) => setServices(r.data));
    }, [video]);

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-md bg-[#0A0A0A] rounded-t-3xl max-h-[75vh] flex flex-col animate-slide-up" onClick={(e) => e.stopPropagation()} data-testid="services-sheet">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h3 className="font-heading font-bold text-lg">خدمات @{video.creator.username}</h3>
                    <button onClick={onClose} data-testid="close-services"><X className="w-5 h-5" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                    {services.length === 0 && (
                        <div className="text-center py-10">
                            <Sparkles className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
                            <p className="text-neutral-500">لم يضف صاحب المحتوى أي خدمات بعد</p>
                        </div>
                    )}
                    {services.map((s) => (
                        <button
                            key={s.id}
                            onClick={() => { navigate(`/service/${s.id}`); onClose(); }}
                            data-testid={`service-item-${s.id}`}
                            className="w-full text-start bg-[#141414] border border-[#262626] hover:border-[#D1795F] rounded-2xl p-4 transition-all"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                    <h4 className="font-heading font-bold text-white mb-1">{s.title}</h4>
                                    <p className="text-sm text-neutral-400 line-clamp-2">{s.description}</p>
                                    <p className="text-xs text-neutral-500 mt-2">التسليم خلال {s.delivery_days} أيام</p>
                                </div>
                                <div className="text-end">
                                    <div className="text-[#D1795F] font-heading font-black text-xl">${s.price}</div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default function Feed() {
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [commentsFor, setCommentsFor] = useState(null);
    const [servicesFor, setServicesFor] = useState(null);
    const { user } = useAuth();
    const navigate = useNavigate();

    const load = () => {
        api.get("/videos/feed").then((r) => {
            setVideos(r.data);
            setLoading(false);
        }).catch(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

    const handleLike = async (id) => {
        if (!user) return navigate("/auth");
        try {
            const res = await api.post(`/videos/${id}/like`);
            setVideos((vs) =>
                vs.map((v) =>
                    v.id === id
                        ? { ...v, liked: res.data.liked, likes: v.likes + (res.data.liked ? 1 : -1) }
                        : v
                )
            );
        } catch {}
    };

    const handleView = (id) => {
        api.post(`/videos/${id}/view`).catch(() => {});
    };

    if (loading) {
        return (
            <div className="h-[100dvh] w-full flex items-center justify-center bg-black text-white">
                <div className="animate-pulse font-body">جارٍ التحميل...</div>
            </div>
        );
    }

    if (videos.length === 0) {
        return (
            <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-black text-white p-8 text-center">
                <Sparkles className="w-16 h-16 text-[#D1795F] mb-4" />
                <h2 className="font-heading font-black text-2xl mb-2">مافيه محتوى بعد</h2>
                <p className="text-neutral-400 mb-6 font-body">كن أول من ينشر فيديو ويبدأ الرحلة</p>
                <button
                    onClick={() => navigate(user ? "/upload" : "/auth")}
                    data-testid="empty-upload-btn"
                    className="bg-[#D1795F] text-white font-heading font-bold rounded-full px-8 py-3 hover:bg-[#B86648] transition active:scale-95"
                >
                    انشر أول فيديو
                </button>
            </div>
        );
    }

    return (
        <>
            {/* Top bar */}
            <div className="fixed top-0 inset-x-0 mx-auto max-w-md z-30 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                <Link to="/search" data-testid="feed-search-btn" className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center pointer-events-auto hover:bg-black/70">
                    <SearchIcon className="w-5 h-5 text-white" />
                </Link>
                <div className="font-heading font-black text-white text-lg pointer-events-none">
                    <span className="text-[#D1795F]">أمورا</span>
                </div>
                <Link to={user ? "/notifications" : "/auth"} data-testid="feed-notif-btn" className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center pointer-events-auto hover:bg-black/70">
                    <Bell className="w-5 h-5 text-white" />
                </Link>
            </div>

            <div className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory bg-black feed-scroll" data-testid="feed-container">
                {videos.map((v) => (
                    <VideoCard
                        key={v.id}
                        v={v}
                        onLike={handleLike}
                        onView={handleView}
                        onOpenComments={setCommentsFor}
                        onOpenServices={setServicesFor}
                    />
                ))}
            </div>

            {commentsFor && (
                <CommentsSheet
                    video={commentsFor}
                    onClose={() => setCommentsFor(null)}
                    onCommentAdded={() => {
                        setVideos((vs) =>
                            vs.map((v) => (v.id === commentsFor.id ? { ...v, comments_count: (v.comments_count || 0) + 1 } : v))
                        );
                    }}
                />
            )}
            {servicesFor && <ServicesSheet video={servicesFor} onClose={() => setServicesFor(null)} />}
        </>
    );
}
