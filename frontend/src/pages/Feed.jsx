import { useEffect, useState, useRef, useCallback } from "react";
import api, { API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
    Heart, MessageCircle, Share2, ShoppingBag, Play, Sparkles, ChevronLeft,
    X, Search as SearchIcon, Bell, MoreVertical, Trash2, Flag, HandCoins,
    Bookmark, BookmarkCheck, UserPlus, UserCheck, BadgeCheck, MapPin, Star,
    Users, TrendingUp, Copy, Send, Music, EyeOff, Zap, Volume2, VolumeX,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import ReportModal from "@/components/ReportModal";
import TipModal from "@/components/TipModal";

// ═══════════════════════════════════════════════════════════════
// TOP BAR — Notifications | Amora + Creative OS | Search + Tabs
// ═══════════════════════════════════════════════════════════════
function FeedTopBar({ tab, onTabChange, user }) {
    return (
        <div className="fixed top-0 inset-x-0 mx-auto max-w-md z-40 pointer-events-none">
            <div className="bg-gradient-to-b from-black/85 via-black/50 to-transparent px-4 pt-3 pb-6">
                <div className="flex items-center justify-between mb-3">
                    <Link
                        to={user ? "/notifications" : "/auth"}
                        data-testid="feed-notif-btn"
                        className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center pointer-events-auto active:scale-90 transition hover:bg-black/70"
                    >
                        <Bell className="w-5 h-5 text-white" />
                    </Link>
                    <div className="flex flex-col items-center pointer-events-none select-none">
                        <span className="font-heading font-black text-white text-lg leading-none tracking-tight">
                            <span className="text-[#D1795F]">أ</span>مورا
                        </span>
                        <span className="text-[9px] text-white/50 font-body mt-0.5 tracking-wider uppercase">Creative OS</span>
                    </div>
                    <Link
                        to="/search"
                        data-testid="feed-search-btn"
                        className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center pointer-events-auto active:scale-90 transition hover:bg-black/70"
                    >
                        <SearchIcon className="w-5 h-5 text-white" />
                    </Link>
                </div>

                {/* For You | Following tabs */}
                <div className="flex items-center justify-center gap-6 pointer-events-auto">
                    {[
                        { key: "foryou", label: "لك" },
                        { key: "following", label: "أتابع" },
                    ].map((t) => (
                        <button
                            key={t.key}
                            data-testid={`tab-${t.key}`}
                            onClick={() => onTabChange(t.key)}
                            className="relative py-1.5 font-heading font-bold text-sm transition-all active:scale-95"
                            style={{
                                color: tab === t.key ? "#ffffff" : "rgba(255,255,255,0.55)",
                                textShadow: tab === t.key ? "0 1px 8px rgba(0,0,0,0.6)" : "none",
                            }}
                        >
                            {t.label}
                            {tab === t.key && (
                                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-[3px] bg-white rounded-full" />
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// SIDE ACTIONS — 8 vertical buttons on the right
// ═══════════════════════════════════════════════════════════════
function SideActions({ v, isOwner, isFollowing, muted, onToggleMute, onLike, onComment, onShare, onSave, onHire, onTip, onMore, onFollow, onReport, currentUser }) {
    const isLiked = v.liked;
    const isSaved = v.saved;
    const btn = "flex flex-col items-center gap-0.5 group";
    const btnCompact = "flex flex-col items-center gap-0.5 group";

    return (
        <div className="absolute end-2 bottom-20 z-20 flex flex-col items-center gap-2.5 pb-2">
            {/* Avatar + follow badge */}
            <div className="relative flex flex-col items-center" data-testid={`side-avatar-${v.id}`}>
                <Link to={`/u/${v.creator?.username}`} className="active:scale-90 transition">
                    <div className="w-9 h-9 rounded-full bg-[#D1795F] flex items-center justify-center text-black font-heading font-black text-sm ring-2 ring-white/30 overflow-hidden shadow-lg">
                        {v.creator?.avatar_url ? (
                            <img src={v.creator.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                            v.creator?.name?.[0] || "?"
                        )}
                    </div>
                </Link>
                {!isOwner && currentUser && !isFollowing && (
                    <button
                        onClick={onFollow}
                        data-testid={`follow-side-${v.id}`}
                        className="absolute -bottom-1.5 w-4 h-4 rounded-full bg-[#D1795F] hover:bg-[#B86648] flex items-center justify-center border-2 border-black transition active:scale-90"
                    >
                        <UserPlus className="w-2 h-2 text-white" strokeWidth={3} />
                    </button>
                )}
                {isFollowing && (
                    <div className="absolute -bottom-1.5 w-4 h-4 rounded-full bg-[#C3E0A5] flex items-center justify-center border-2 border-black">
                        <UserCheck className="w-2 h-2 text-black" strokeWidth={3} />
                    </div>
                )}
            </div>

            {/* Like */}
            <button onClick={onLike} data-testid={`like-btn-${v.id}`} className={btn}>
                <div className={`w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center transition active:scale-75 group-hover:bg-black/60 ${isLiked ? "shadow-md shadow-red-500/40" : ""}`}>
                    <Heart className={`w-5 h-5 transition ${isLiked ? "fill-red-500 text-red-500 scale-110" : "text-white"}`} strokeWidth={2.2} />
                </div>
                <span className="text-[10px] text-white font-heading font-bold drop-shadow-md">{formatCount(v.likes || 0)}</span>
            </button>

            {/* Comments */}
            <button onClick={onComment} data-testid={`comment-btn-${v.id}`} className={btn}>
                <div className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center transition active:scale-75 group-hover:bg-black/60">
                    <MessageCircle className="w-5 h-5 text-white" strokeWidth={2.2} />
                </div>
                <span className="text-[10px] text-white font-heading font-bold drop-shadow-md">{formatCount(v.comments_count || 0)}</span>
            </button>

            {/* Save + Share (paired horizontally) */}
            <div className="flex items-start gap-1.5">
                {currentUser && (
                    <button onClick={onSave} data-testid={`save-btn-${v.id}`} className={btnCompact}>
                        <div className={`w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center transition active:scale-75 group-hover:bg-black/60 ${isSaved ? "shadow-md shadow-amber-400/40" : ""}`}>
                            {isSaved ? <BookmarkCheck className="w-4 h-4 fill-amber-400 text-amber-400" strokeWidth={2.2} /> : <Bookmark className="w-4 h-4 text-white" strokeWidth={2.2} />}
                        </div>
                        <span className="text-[9px] text-white font-heading font-bold drop-shadow-md">حفظ</span>
                    </button>
                )}
                <button onClick={onShare} data-testid={`share-btn-${v.id}`} className={btnCompact}>
                    <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center transition active:scale-75 group-hover:bg-black/60">
                        <Share2 className="w-4 h-4 text-white" strokeWidth={2.2} />
                    </div>
                    <span className="text-[9px] text-white font-heading font-bold drop-shadow-md">مشاركة</span>
                </button>
            </div>

            {/* Hire Me (the killer button) */}
            {!isOwner && (
                <button onClick={onHire} data-testid={`hire-btn-${v.id}`} className={btn}>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#D1795F] to-[#C3E0A5] flex items-center justify-center transition active:scale-75 shadow-md shadow-[#D1795F]/40">
                        <ShoppingBag className="w-4 h-4 text-black" strokeWidth={2.8} />
                    </div>
                    <span className="text-[10px] text-white font-heading font-black drop-shadow-md">وظّفني</span>
                </button>
            )}

            {/* Tip */}
            {!isOwner && currentUser && (
                <button onClick={onTip} data-testid={`tip-btn-${v.id}`} className={btn}>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center transition active:scale-75 shadow-md shadow-red-500/40">
                        <HandCoins className="w-4 h-4 text-white" strokeWidth={2.6} />
                    </div>
                    <span className="text-[10px] text-white font-heading font-black drop-shadow-md">ادعم</span>
                </button>
            )}

            {/* Mute + Report/More (paired horizontally) */}
            <div className="flex items-center gap-1.5">
                <button onClick={onToggleMute} data-testid={`mute-btn-${v.id}`} className={btnCompact}>
                    <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center transition active:scale-75 group-hover:bg-black/60">
                        {muted ? <VolumeX className="w-3.5 h-3.5 text-white" /> : <Volume2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                </button>
                <button onClick={isOwner ? onMore : onReport} data-testid={`more-btn-${v.id}`} className={btnCompact}>
                    <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center transition active:scale-75 group-hover:bg-black/60">
                        {isOwner ? <MoreVertical className="w-3.5 h-3.5 text-white" /> : <Flag className="w-3.5 h-3.5 text-white" />}
                    </div>
                </button>
            </div>
        </div>
    );
}

function formatCount(n) {
    if (n < 1000) return n.toString();
    if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
    return `${(n / 1_000_000).toFixed(1)}M`;
}

// ═══════════════════════════════════════════════════════════════
// VIDEO INFO — bottom-left of every video (creator identity + copy)
// ═══════════════════════════════════════════════════════════════
function VideoInfo({ v }) {
    const c = v.creator || {};
    const roleLabel = {
        creator: "صانع محتوى",
        client: "عميل",
        agency: "وكالة",
        investor: "مستثمر",
    }[c.role] || (c.headline || "");

    const hashtags = extractHashtags(v.caption || "");
    return (
        <div className="absolute start-4 bottom-44 z-10 max-w-[70%] pointer-events-none">
            <div className="flex items-center gap-1.5 mb-1.5 pointer-events-auto">
                <Link to={`/u/${c.username}`} className="font-heading font-black text-white text-base drop-shadow-lg hover:underline">
                    @{c.username}
                </Link>
                {c.is_verified && <BadgeCheck className="w-4 h-4 text-[#57769D] fill-[#57769D]/20" />}
            </div>
            {roleLabel && (
                <div className="text-[11px] text-white/85 font-body drop-shadow-md mb-1.5 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-white/60" />
                    {roleLabel}
                </div>
            )}
            {v.caption && (
                <p className="text-sm text-white font-body drop-shadow-md leading-relaxed mb-1 line-clamp-3">
                    {stripHashtags(v.caption)}
                </p>
            )}
            {hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                    {hashtags.slice(0, 4).map((h) => (
                        <span key={h} className="text-[11px] text-[#C3E0A5] font-heading font-bold drop-shadow-md">
                            #{h}
                        </span>
                    ))}
                </div>
            )}
            {(c.rating || c.orders_count > 0 || v.category) && (
                <div className="flex items-center gap-2 text-[10px] text-white/80 font-body drop-shadow-md">
                    {c.rating && (
                        <span className="flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span className="font-heading font-bold text-white">{c.rating}</span>
                        </span>
                    )}
                    {c.orders_count > 0 && (
                        <>
                            <span className="w-0.5 h-0.5 rounded-full bg-white/50" />
                            <span>{c.orders_count} {c.orders_count > 1 ? "طلب" : "عميل"}</span>
                        </>
                    )}
                    {v.category && v.category !== "عام" && (
                        <>
                            <span className="w-0.5 h-0.5 rounded-full bg-white/50" />
                            <span className="opacity-80">{v.category}</span>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function extractHashtags(text) {
    const m = text.match(/#[\p{L}\p{N}_]+/gu) || [];
    return m.map((h) => h.slice(1));
}
function stripHashtags(text) {
    return text.replace(/#[\p{L}\p{N}_]+/gu, "").trim();
}

// ═══════════════════════════════════════════════════════════════
// CREATOR SERVICE CARD — THE KILLER FEATURE (bottom of video)
// Turns every view into a hiring opportunity.
// ═══════════════════════════════════════════════════════════════
function CreatorServiceCard({ v, onOrder, onDismiss }) {
    const s = v.primary_service;
    if (!s) return null;
    const rating = v.creator?.rating;
    return (
        <div
            className="absolute start-3 end-14 bottom-[88px] z-30 rounded-2xl overflow-hidden animate-slide-up"
            data-testid={`service-card-${v.id}`}
            style={{
                background: "linear-gradient(135deg, rgba(209,121,95,0.95) 0%, rgba(87,118,157,0.95) 100%)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
        >
            <button
                onClick={onDismiss}
                data-testid={`dismiss-service-card-${v.id}`}
                className="absolute top-2 end-2 w-6 h-6 rounded-full bg-black/40 flex items-center justify-center hover:bg-black/60 transition"
            >
                <X className="w-3 h-3 text-white" />
            </button>
            <div className="p-3 pe-9">
                <div className="flex items-center gap-1.5 mb-1">
                    <Zap className="w-3 h-3 text-white" strokeWidth={2.6} />
                    <span className="text-[10px] font-heading font-bold text-white/90 tracking-wider uppercase">خدمة متاحة</span>
                </div>
                <div className="flex items-end justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="font-heading font-black text-white text-[15px] leading-tight line-clamp-1">{s.title}</div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-white/85 font-body">
                            <span className="font-heading font-black text-white text-sm">${s.price}</span>
                            {s.delivery_days && <><span className="w-0.5 h-0.5 rounded-full bg-white/60" /><span>{s.delivery_days} أيام</span></>}
                            {rating && <><span className="w-0.5 h-0.5 rounded-full bg-white/60" /><span className="flex items-center gap-0.5"><Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />{rating}</span></>}
                        </div>
                    </div>
                    <button
                        onClick={onOrder}
                        data-testid={`order-service-${v.id}`}
                        className="bg-white text-black font-heading font-black text-xs rounded-full px-4 py-2 hover:bg-white/90 active:scale-95 transition whitespace-nowrap shadow-md"
                    >
                        اطلب الآن
                    </button>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// DOUBLE-TAP HEART BURST
// ═══════════════════════════════════════════════════════════════
function DoubleTapHeart({ show, x, y }) {
    if (!show) return null;
    return (
        <div
            className="absolute z-30 pointer-events-none animate-heart-burst"
            style={{ left: x - 40, top: y - 40 }}
        >
            <Heart className="w-20 h-20 fill-red-500 text-red-500 drop-shadow-2xl" />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// SHARE SHEET — WhatsApp, X, Snap, Telegram, Copy
// ═══════════════════════════════════════════════════════════════
function ShareSheet({ v, onClose }) {
    const shareUrl = `${window.location.origin}/u/${v.creator?.username}?v=${v.id}`;
    const text = v.caption ? v.caption.slice(0, 100) : `شاهد على أمورا`;
    const options = [
        { key: "whatsapp", label: "واتساب", color: "#25D366", url: `https://wa.me/?text=${encodeURIComponent(text + " " + shareUrl)}` },
        { key: "x", label: "X (تويتر)", color: "#000000", url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}` },
        { key: "telegram", label: "تيليجرام", color: "#0088cc", url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}` },
        { key: "snapchat", label: "سناب", color: "#FFFC00", url: `https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(shareUrl)}` },
    ];
    const copyLink = async () => {
        try { await navigator.clipboard.writeText(shareUrl); toast.success("تم نسخ الرابط"); onClose(); } catch { toast.error("تعذّر النسخ"); }
    };
    return (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end justify-center" onClick={onClose} data-testid="share-sheet">
            <div className="w-full max-w-md bg-[#0A0A0A] rounded-t-3xl p-5 pb-8" onClick={(e) => e.stopPropagation()}>
                <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4" />
                <h3 className="font-heading font-black text-lg text-white mb-4 text-center">مشاركة الفيديو</h3>
                <div className="grid grid-cols-5 gap-2 mb-4">
                    {options.map((o) => (
                        <a
                            key={o.key}
                            href={o.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid={`share-${o.key}`}
                            onClick={() => setTimeout(onClose, 200)}
                            className="flex flex-col items-center gap-1.5 active:scale-90 transition"
                        >
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: o.color }}>
                                <Send className="w-5 h-5 text-white" strokeWidth={2.4} />
                            </div>
                            <span className="text-[10px] text-white font-body">{o.label}</span>
                        </a>
                    ))}
                    <button data-testid="share-copy" onClick={copyLink} className="flex flex-col items-center gap-1.5 active:scale-90 transition">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                            <Copy className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-[10px] text-white font-body">نسخ</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// LONG-PRESS MENU
// ═══════════════════════════════════════════════════════════════
function LongPressMenu({ v, isSaved, onSave, onReport, onHide, onFavorite, onClose }) {
    return (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end justify-center" onClick={onClose} data-testid="longpress-menu">
            <div className="w-full max-w-md bg-[#0A0A0A] rounded-t-3xl p-3 pb-6" onClick={(e) => e.stopPropagation()}>
                <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-3" />
                <MenuItem icon={isSaved ? BookmarkCheck : Bookmark} label={isSaved ? "إلغاء الحفظ" : "حفظ الفيديو"} onClick={onSave} testid="lp-save" />
                <MenuItem icon={Star} label="إضافة للمفضلة" onClick={onFavorite} testid="lp-fav" />
                <MenuItem icon={EyeOff} label="لا يهمّني هذا المحتوى" onClick={onHide} testid="lp-hide" />
                <MenuItem icon={Flag} label="الإبلاغ" onClick={onReport} testid="lp-report" danger />
                <button onClick={onClose} className="w-full mt-2 bg-white/5 hover:bg-white/10 text-white rounded-xl px-4 py-3 font-heading font-bold transition">
                    إلغاء
                </button>
            </div>
        </div>
    );
}
function MenuItem({ icon: Icon, label, onClick, testid, danger }) {
    return (
        <button onClick={onClick} data-testid={testid} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition active:scale-[0.98] ${danger ? "hover:bg-red-500/10 text-red-400" : "hover:bg-white/5 text-white"}`}>
            <Icon className="w-5 h-5" />
            <span className="font-heading font-bold text-sm">{label}</span>
        </button>
    );
}

// ═══════════════════════════════════════════════════════════════
// VIDEO CARD — the full-screen 9:16 slide
// ═══════════════════════════════════════════════════════════════
const VideoCard = ({ v, onLike, onView, onOpenComments, onOpenServices, onDelete, currentUser, isActive, onFollow, onSaveToggle }) => {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const [muted, setMuted] = useState(true);
    const [paused, setPaused] = useState(false);
    const [showOwnerMenu, setShowOwnerMenu] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [showTip, setShowTip] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [showLongPress, setShowLongPress] = useState(false);
    const [showCard, setShowCard] = useState(true);
    const [heart, setHeart] = useState({ show: false, x: 0, y: 0 });
    const lastTap = useRef(0);
    const pressTimer = useRef(null);
    const nav = useNavigate();

    const isOwner = currentUser && v.creator?.id === currentUser.id;
    const isFollowing = !!v.creator?.is_following;

    // Play/pause based on visibility (active slide)
    useEffect(() => {
        const vid = videoRef.current;
        if (!vid) return;
        if (isActive) {
            vid.play().catch(() => {});
            setPaused(false);
            onView?.(v.id);
        } else {
            vid.pause();
            vid.currentTime = 0;
        }
    }, [isActive]); // eslint-disable-line

    const handleTogglePlay = () => {
        const vid = videoRef.current;
        if (!vid) return;
        if (vid.paused) { vid.play(); setPaused(false); } else { vid.pause(); setPaused(true); }
    };

    const handleTap = (e) => {
        const now = Date.now();
        if (now - lastTap.current < 300) {
            // Double tap
            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            setHeart({ show: true, x, y });
            setTimeout(() => setHeart({ show: false, x: 0, y: 0 }), 800);
            if (!v.liked) onLike(v.id);
            if (navigator.vibrate) navigator.vibrate(15);
        } else {
            // Single tap toggles play
            setTimeout(() => {
                const still = Date.now() - lastTap.current > 250;
                if (still) handleTogglePlay();
            }, 260);
        }
        lastTap.current = now;
    };

    const startPress = () => {
        pressTimer.current = setTimeout(() => {
            setShowLongPress(true);
            if (navigator.vibrate) navigator.vibrate(30);
        }, 550);
    };
    const cancelPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };

    const doSave = async () => {
        if (!currentUser) return nav("/auth");
        try {
            if (v.saved) { await api.delete(`/videos/${v.id}/save`); onSaveToggle(v.id, false); toast.success("أُلغي الحفظ"); }
            else { await api.post(`/videos/${v.id}/save`); onSaveToggle(v.id, true); toast.success("تم الحفظ"); }
        } catch { toast.error("خطأ"); }
        setShowLongPress(false);
    };

    return (
        <div
            ref={containerRef}
            className="h-[100dvh] w-full snap-start relative bg-black overflow-hidden"
            data-testid={`video-slide-${v.id}`}
            onPointerDown={startPress}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onClick={handleTap}
        >
            <video
                ref={videoRef}
                src={`${API}/videos/stream/${v.id}`}
                poster={v.thumbnail_url}
                className={`w-full h-full object-cover transition-[filter] duration-500 ${v.filter_name ? `feed-filter-${v.filter_name}` : ""}`}
                loop
                muted={muted}
                playsInline
                preload="metadata"
                controls={false}
            />

            {/* Play indicator when paused */}
            {paused && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 animate-fade-in">
                    <div className="w-20 h-20 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center">
                        <Play className="w-10 h-10 text-white fill-white ms-1" />
                    </div>
                </div>
            )}

            {/* Bottom gradient overlay for legibility */}
            <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />

            <DoubleTapHeart show={heart.show} x={heart.x} y={heart.y} />

            <VideoInfo v={v} />

            <SideActions
                v={v}
                isOwner={isOwner}
                isFollowing={isFollowing}
                currentUser={currentUser}
                muted={muted}
                onToggleMute={(e) => { e.stopPropagation(); setMuted(!muted); }}
                onLike={(e) => { e.stopPropagation(); if (!currentUser) return nav("/auth"); onLike(v.id); if (navigator.vibrate) navigator.vibrate(10); }}
                onComment={(e) => { e.stopPropagation(); onOpenComments(v); }}
                onShare={(e) => { e.stopPropagation(); setShowShare(true); }}
                onSave={(e) => { e.stopPropagation(); doSave(); }}
                onHire={(e) => { e.stopPropagation(); onOpenServices(v); }}
                onTip={(e) => { e.stopPropagation(); setShowTip(true); }}
                onMore={(e) => { e.stopPropagation(); setShowOwnerMenu(true); }}
                onReport={(e) => { e.stopPropagation(); setShowReport(true); }}
                onFollow={(e) => { e.stopPropagation(); onFollow(v.creator?.username, v.id); }}
            />

            {/* Killer service card */}
            {showCard && !isOwner && v.primary_service && (
                <CreatorServiceCard
                    v={v}
                    onOrder={(e) => { e.stopPropagation(); onOpenServices(v); }}
                    onDismiss={(e) => { e.stopPropagation(); setShowCard(false); }}
                />
            )}

            {/* Owner menu sheet */}
            {showOwnerMenu && isOwner && (
                <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end justify-center" onClick={(e) => { e.stopPropagation(); setShowOwnerMenu(false); }} data-testid={`video-menu-sheet-${v.id}`}>
                    <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#0A0A0A] border-t border-white/10 rounded-t-3xl p-5">
                        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4" />
                        <h3 className="font-heading font-bold text-lg mb-4 text-white">خيارات الفيديو</h3>
                        <button
                            data-testid={`delete-video-btn-${v.id}`}
                            onClick={async () => {
                                if (!window.confirm("هل تريد حذف هذا الفيديو نهائياً؟")) return;
                                try { await api.delete(`/videos/${v.id}`); toast.success("تم حذف الفيديو"); setShowOwnerMenu(false); onDelete?.(v.id); }
                                catch (e) { toast.error(e?.response?.data?.detail || "تعذّر حذف الفيديو"); }
                            }}
                            className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 flex items-center gap-3 transition"
                        >
                            <Trash2 className="w-5 h-5" />
                            <span className="font-heading font-bold">حذف الفيديو</span>
                        </button>
                        <button onClick={() => setShowOwnerMenu(false)} className="w-full mt-3 bg-white/5 hover:bg-white/10 text-white rounded-xl px-4 py-3 font-heading font-bold transition">إلغاء</button>
                    </div>
                </div>
            )}

            {showReport && <ReportModal targetType="video" targetId={v.id} targetLabel={v.caption ? `فيديو: ${v.caption.slice(0, 40)}...` : "فيديو"} onClose={() => setShowReport(false)} />}
            {showTip && v.creator?.username && <TipModal creatorUsername={v.creator.username} videoId={v.id} onClose={() => setShowTip(false)} />}
            {showShare && <ShareSheet v={v} onClose={() => setShowShare(false)} />}
            {showLongPress && (
                <LongPressMenu
                    v={v}
                    isSaved={v.saved}
                    onSave={doSave}
                    onFavorite={() => { toast.success("تمت الإضافة للمفضلة"); setShowLongPress(false); }}
                    onHide={() => { toast("لن نعرض محتوى مشابهاً"); setShowLongPress(false); }}
                    onReport={() => { setShowLongPress(false); setShowReport(true); }}
                    onClose={() => setShowLongPress(false)}
                />
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════
// COMMENTS SHEET — kept, polished
// ═══════════════════════════════════════════════════════════════
const CommentsSheet = ({ video, onClose, onCommentAdded }) => {
    const [comments, setComments] = useState([]);
    const [text, setText] = useState("");
    const { user } = useAuth();
    const nav = useNavigate();
    useEffect(() => {
        api.get(`/videos/${video.id}/comments`).then((r) => setComments(r.data));
    }, [video.id]);
    const submit = async (e) => {
        e.preventDefault();
        if (!user) return nav("/auth");
        if (!text.trim()) return;
        try {
            const res = await api.post(`/videos/${video.id}/comments`, { text: text.trim() });
            setComments([res.data, ...comments]);
            setText("");
            onCommentAdded?.();
        } catch {}
    };
    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-md bg-[#0A0A0A] rounded-t-3xl max-h-[75vh] flex flex-col animate-slide-up" onClick={(e) => e.stopPropagation()} data-testid="comments-sheet">
                <div className="w-12 h-1 bg-white/20 rounded-full mx-auto my-3" />
                <div className="flex items-center justify-between px-4 pb-3 border-b border-white/10">
                    <h3 className="font-heading font-bold text-lg">التعليقات ({comments.length})</h3>
                    <button onClick={onClose} data-testid="close-comments"><X className="w-5 h-5" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                    {comments.length === 0 && (
                        <div className="text-center py-14">
                            <MessageCircle className="w-10 h-10 text-white/20 mx-auto mb-2" />
                            <p className="text-neutral-500 font-body text-sm">كن أول من يعلّق</p>
                        </div>
                    )}
                    {comments.map((c) => (
                        <div key={c.id} className="flex gap-3">
                            <Link to={`/u/${c.user?.username}`} className="w-9 h-9 rounded-full bg-[#D1795F] shrink-0 flex items-center justify-center text-black font-heading font-black text-sm overflow-hidden">
                                {c.user?.avatar_url ? <img src={c.user.avatar_url} alt="" className="w-full h-full object-cover" /> : c.user?.name?.[0]}
                            </Link>
                            <div className="flex-1">
                                <div className="text-sm font-heading font-bold">@{c.user?.username}</div>
                                <div className="text-sm text-neutral-300 leading-relaxed font-body">{c.text}</div>
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
                    <button type="submit" data-testid="submit-comment" className="bg-[#D1795F] text-white font-heading font-bold px-5 rounded-full active:scale-95">نشر</button>
                </form>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════
// SERVICES SHEET — Hire Me flow (bottom sheet, no navigation)
// ═══════════════════════════════════════════════════════════════
const ServicesSheet = ({ video, onClose }) => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const nav = useNavigate();
    useEffect(() => {
        setLoading(true);
        api.get(`/services/user/${video.creator.username}`)
            .then((r) => setServices(r.data))
            .finally(() => setLoading(false));
    }, [video]);
    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-md bg-[#0A0A0A] rounded-t-3xl max-h-[80vh] flex flex-col animate-slide-up" onClick={(e) => e.stopPropagation()} data-testid="services-sheet">
                <div className="w-12 h-1 bg-white/20 rounded-full mx-auto my-3" />
                <div className="flex items-center justify-between px-4 pb-3 border-b border-white/10">
                    <div>
                        <h3 className="font-heading font-bold text-lg text-white">وظّف @{video.creator.username}</h3>
                        <p className="text-[11px] text-white/50 font-body">اختر خدمة تناسبك</p>
                    </div>
                    <button onClick={onClose} data-testid="close-services"><X className="w-5 h-5 text-white" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                    {loading && [0, 1, 2].map((i) => (
                        <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 animate-pulse">
                            <div className="h-4 bg-white/10 rounded w-2/3 mb-2" />
                            <div className="h-3 bg-white/5 rounded w-full mb-2" />
                            <div className="h-3 bg-white/5 rounded w-1/2" />
                        </div>
                    ))}
                    {!loading && services.length === 0 && (
                        <div className="text-center py-10">
                            <Sparkles className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
                            <p className="text-neutral-500 font-body text-sm">لم يضف صاحب المحتوى أي خدمات بعد</p>
                        </div>
                    )}
                    {services.map((s) => (
                        <button
                            key={s.id}
                            data-testid={`service-item-${s.id}`}
                            onClick={() => nav(`/service/${s.id}`)}
                            className="w-full text-start bg-gradient-to-br from-white/8 to-white/4 border border-white/10 rounded-2xl p-4 hover:border-[#D1795F]/40 transition active:scale-[0.98] group"
                        >
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <h4 className="font-heading font-black text-white text-sm leading-tight flex-1">{s.title}</h4>
                                <span className="text-[#D1795F] font-heading font-black text-lg whitespace-nowrap">${s.price}</span>
                            </div>
                            {s.description && <p className="text-[11px] text-white/60 font-body mb-2 line-clamp-2">{s.description}</p>}
                            <div className="flex items-center gap-3 text-[10px] text-white/50 font-body">
                                {s.delivery_days && <span>{s.delivery_days} أيام تسليم</span>}
                                {s.orders_count > 0 && <><span className="w-0.5 h-0.5 rounded-full bg-white/40" /><span>{s.orders_count} طلب</span></>}
                                <span className="mr-auto text-[#D1795F] font-heading font-bold group-hover:translate-x-[-2px] transition">اطلب الآن ←</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════
// FEED PAGE — main
// ═══════════════════════════════════════════════════════════════
export default function Feed() {
    const [tab, setTab] = useState("foryou");
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [commentsFor, setCommentsFor] = useState(null);
    const [servicesFor, setServicesFor] = useState(null);
    const [activeIdx, setActiveIdx] = useState(0);
    const containerRef = useRef(null);
    const { user } = useAuth();
    const navigate = useNavigate();

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const path = tab === "following" ? "/videos/feed/following" : "/videos/feed";
            const r = await api.get(path);
            setVideos(r.data);
        } catch {
            setVideos([]);
        }
        setLoading(false);
    }, [tab]);

    useEffect(() => {
        if (tab === "following" && !user) {
            navigate("/auth");
            return;
        }
        load();
        // reset scroll when tab changes
        if (containerRef.current) containerRef.current.scrollTop = 0;
        setActiveIdx(0);
    }, [tab, user, load, navigate]);

    // Detect active slide via IntersectionObserver
    useEffect(() => {
        if (!containerRef.current) return;
        const slides = containerRef.current.querySelectorAll("[data-testid^='video-slide-']");
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
                        const idx = Array.from(slides).indexOf(entry.target);
                        if (idx !== -1) setActiveIdx(idx);
                    }
                });
            },
            { root: containerRef.current, threshold: [0.6] }
        );
        slides.forEach((s) => io.observe(s));
        return () => io.disconnect();
    }, [videos]);

    // Preload next video
    useEffect(() => {
        const next = videos[activeIdx + 1];
        if (next) {
            const link = document.createElement("link");
            link.rel = "preload";
            link.as = "video";
            link.href = `${API}/videos/stream/${next.id}`;
            document.head.appendChild(link);
            return () => { document.head.removeChild(link); };
        }
    }, [activeIdx, videos]);

    const handleLike = async (id) => {
        if (!user) return navigate("/auth");
        try {
            const res = await api.post(`/videos/${id}/like`);
            setVideos((vs) => vs.map((v) => v.id === id ? { ...v, liked: res.data.liked, likes: v.likes + (res.data.liked ? 1 : -1) } : v));
        } catch {}
    };
    const handleView = (id) => api.post(`/videos/${id}/view`).catch(() => {});
    const handleDelete = (id) => setVideos((vs) => vs.filter((v) => v.id !== id));
    const handleSaveToggle = (id, saved) => setVideos((vs) => vs.map((v) => v.id === id ? { ...v, saved } : v));
    const handleFollow = async (username, videoId) => {
        if (!user) return navigate("/auth");
        try {
            await api.post(`/users/${username}/follow`);
            setVideos((vs) => vs.map((v) => v.creator?.username === username ? { ...v, creator: { ...v.creator, is_following: true } } : v));
            toast.success(`تمت المتابعة`);
            if (navigator.vibrate) navigator.vibrate(10);
        } catch {}
    };

    if (loading) {
        return (
            <>
                <FeedTopBar tab={tab} onTabChange={setTab} user={user} />
                <div className="h-[100dvh] w-full bg-black flex flex-col">
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-[#D1795F] animate-spin mx-auto mb-3" />
                            <p className="text-white/40 font-body text-xs">جارٍ التحميل</p>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    if (videos.length === 0) {
        return (
            <>
                <FeedTopBar tab={tab} onTabChange={setTab} user={user} />
                <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-black text-white p-8 text-center" data-testid="feed-empty">
                    <Sparkles className="w-14 h-14 text-[#D1795F] mb-4 animate-pulse" />
                    <h2 className="font-heading font-black text-2xl mb-2">
                        {tab === "following" ? "لا يوجد جديد" : "مافيه محتوى بعد"}
                    </h2>
                    <p className="text-neutral-400 mb-6 font-body">
                        {tab === "following" ? "تابع مبدعين لترى محتواهم هنا" : "كن أول من ينشر فيديو ويبدأ الرحلة"}
                    </p>
                    <button
                        onClick={() => navigate(user ? "/upload" : "/auth")}
                        data-testid="empty-upload-btn"
                        className="bg-gradient-to-br from-[#D1795F] to-[#C3E0A5] text-black font-heading font-black rounded-full px-8 py-3 hover:opacity-90 transition active:scale-95"
                    >
                        انشر أول فيديو
                    </button>
                </div>
            </>
        );
    }

    return (
        <>
            <FeedTopBar tab={tab} onTabChange={setTab} user={user} />

            <div
                ref={containerRef}
                className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory bg-black feed-scroll"
                data-testid="feed-container"
                style={{ scrollBehavior: "smooth" }}
            >
                {videos.map((v, i) => (
                    <VideoCard
                        key={v.id}
                        v={v}
                        isActive={i === activeIdx}
                        onLike={handleLike}
                        onView={handleView}
                        onOpenComments={setCommentsFor}
                        onOpenServices={setServicesFor}
                        onDelete={handleDelete}
                        onSaveToggle={handleSaveToggle}
                        onFollow={handleFollow}
                        currentUser={user}
                    />
                ))}
            </div>

            {commentsFor && (
                <CommentsSheet
                    video={commentsFor}
                    onClose={() => setCommentsFor(null)}
                    onCommentAdded={() => {
                        setVideos((vs) => vs.map((v) => v.id === commentsFor.id ? { ...v, comments_count: (v.comments_count || 0) + 1 } : v));
                    }}
                />
            )}
            {servicesFor && <ServicesSheet video={servicesFor} onClose={() => setServicesFor(null)} />}
        </>
    );
}
