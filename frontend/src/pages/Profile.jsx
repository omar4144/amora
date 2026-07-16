import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api, { API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Settings, Plus, Trash2, LogOut, Users, Film, Sparkles, MessageCircle, Wallet, Briefcase, ArrowLeft, Video, CheckSquare, ShieldAlert, X, Flag, UserX, MoreVertical } from "lucide-react";
import ReportModal from "@/components/ReportModal";

function FollowListModal({ username, kind, onClose }) {
    // kind = "followers" | "following"
    const [users, setUsers] = useState(null);
    const nav = useNavigate();
    useEffect(() => {
        api.get(`/users/${username}/${kind}`)
            .then((r) => setUsers(r.data))
            .catch(() => setUsers([]));
    }, [username, kind]);

    const title = kind === "followers" ? "المتابعون" : "يتابع";
    return (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end justify-center" onClick={onClose}>
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-[#0A0A0A] border-t border-white/10 rounded-t-3xl max-h-[75vh] flex flex-col"
                data-testid={`follow-list-${kind}`}
            >
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h3 className="font-heading font-black text-lg text-white">{title}</h3>
                    <button onClick={onClose} data-testid={`close-follow-list-${kind}`} className="p-1.5 rounded-full hover:bg-white/10 transition">
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 no-scrollbar">
                    {users === null && <div className="py-10 text-center text-white/50 text-sm">جارٍ التحميل...</div>}
                    {users?.length === 0 && (
                        <div className="py-10 text-center">
                            <Users className="w-8 h-8 text-white/20 mx-auto mb-2" />
                            <p className="text-white/50 text-sm">{kind === "followers" ? "لا يوجد متابعون بعد" : "لا يتابع أحداً بعد"}</p>
                        </div>
                    )}
                    {users?.map((u) => (
                        <button
                            key={u.id}
                            data-testid={`follow-item-${u.username}`}
                            onClick={() => { onClose(); nav(`/u/${u.username}`); }}
                            className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition text-start"
                        >
                            <div className="w-10 h-10 rounded-full bg-[#D1795F] flex items-center justify-center text-black font-heading font-black flex-shrink-0">
                                {u.name?.[0] || "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-heading font-bold text-white text-sm truncate">{u.name}</div>
                                <div className="text-[11px] text-white/50 truncate">@{u.username}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function Profile() {
    const { username } = useParams();
    const { user: me, logout } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [videos, setVideos] = useState([]);
    const [services, setServices] = useState([]);
    const [tab, setTab] = useState("videos");
    const [showAdd, setShowAdd] = useState(false);
    const [svc, setSvc] = useState({ title: "", description: "", price: "", delivery_days: 3 });
    const [earnings, setEarnings] = useState(null);
    const [followModal, setFollowModal] = useState(null); // "followers" | "following" | null
    const [showReport, setShowReport] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);

    const load = () => {
        api.get(`/users/${username}`).then((r) => setProfile(r.data));
        api.get(`/videos/user/${username}`).then((r) => setVideos(r.data));
        api.get(`/services/user/${username}`).then((r) => setServices(r.data));
    };

    useEffect(() => { load(); }, [username]);

    useEffect(() => {
        if (me && profile && me.id === profile.id) {
            api.get("/earnings/me").then((r) => setEarnings(r.data));
        }
        // Check block state (only when viewing someone else's profile while logged in)
        if (me && profile && me.id !== profile.id) {
            api.get("/users/me/blocks")
                .then((r) => {
                    const blocked = r.data?.blocks?.some((b) => b.blocked_id === profile.id);
                    setIsBlocked(!!blocked);
                })
                .catch(() => {});
        }
    }, [me, profile]);

    const isMe = me && profile && me.id === profile.id;

    const follow = async () => {
        if (!me) return navigate("/auth");
        try {
            const res = await api.post(`/users/${username}/follow`);
            setProfile({ ...profile, is_following: res.data.following, followers: profile.followers + (res.data.following ? 1 : -1) });
        } catch {}
    };

    const addService = async (e) => {
        e.preventDefault();
        try {
            await api.post("/services", { ...svc, price: parseFloat(svc.price), delivery_days: parseInt(svc.delivery_days) });
            toast.success("تمت إضافة الخدمة");
            setShowAdd(false);
            setSvc({ title: "", description: "", price: "", delivery_days: 3 });
            load();
        } catch {
            toast.error("خطأ في إضافة الخدمة");
        }
    };

    const removeSvc = async (id) => {
        if (!window.confirm("حذف الخدمة؟")) return;
        await api.delete(`/services/${id}`);
        load();
    };

    const removeVideo = async (id) => {
        if (!window.confirm("هل تريد حذف هذا الفيديو نهائياً؟")) return;
        try {
            await api.delete(`/videos/${id}`);
            toast.success("تم حذف الفيديو");
            setVideos((vs) => vs.filter((v) => v.id !== id));
        } catch (e) {
            toast.error(e?.response?.data?.detail || "تعذّر حذف الفيديو");
        }
    };

    const toggleBlock = async () => {
        try {
            if (isBlocked) {
                await api.delete(`/users/${username}/block`);
                setIsBlocked(false);
                toast.success("تم إلغاء الحظر");
            } else {
                if (!window.confirm(`حظر @${username}؟ لن ترى محتواه بعد الآن.`)) return;
                await api.post(`/users/${username}/block`);
                setIsBlocked(true);
                toast.success("تم حظر المستخدم");
                setProfile((p) => p ? { ...p, is_following: false } : p);
            }
            setShowUserMenu(false);
        } catch (e) {
            toast.error(e?.response?.data?.detail || "خطأ");
        }
    };

    if (!profile) return <div className="p-8 text-center text-neutral-500">جارٍ التحميل...</div>;

    return (
        <div className="pb-24 font-body" data-testid="profile-page">
            {/* Header */}
            <div className="relative bg-gradient-to-b from-[#141414] to-black pt-8 pb-6 px-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="w-24 h-24 rounded-full bg-[#D1795F] flex items-center justify-center text-black text-3xl font-heading font-black">
                        {profile.name?.[0] || "?"}
                    </div>
                    {isMe && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => navigate("/orders")}
                                data-testid="orders-link-btn"
                                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition"
                                title="طلباتي"
                            >
                                <Users className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => navigate("/profile/edit")}
                                data-testid="edit-profile-btn"
                                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition"
                            >
                                <Settings className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => { logout(); navigate("/"); }}
                                data-testid="logout-btn"
                                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>

                <h1 className="text-2xl font-heading font-black">{profile.name}</h1>
                <div className="text-neutral-400 text-sm mb-2">@{profile.username}</div>
                {profile.role && (
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs bg-[#D1795F]/20 text-[#D1795F] px-2 py-0.5 rounded-full font-heading font-bold">{profile.role}</span>
                        {profile.years_experience > 0 && <span className="text-xs text-neutral-500">{profile.years_experience} سنة خبرة</span>}
                    </div>
                )}
                {profile.bio && <p className="text-white/90 mb-3 leading-relaxed">{profile.bio}</p>}
                {profile.skills?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                        {profile.skills.map((s) => (
                            <span key={s} className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">{s}</span>
                        ))}
                    </div>
                )}

                <div className="flex gap-6 mb-4">
                    <button
                        data-testid="open-followers-btn"
                        onClick={() => setFollowModal("followers")}
                        className="hover:opacity-80 transition text-start"
                    >
                        <span className="font-heading font-bold text-white">{profile.followers || 0}</span>
                        <span className="text-neutral-500 text-sm mx-1">متابع</span>
                    </button>
                    <button
                        data-testid="open-following-btn"
                        onClick={() => setFollowModal("following")}
                        className="hover:opacity-80 transition text-start"
                    >
                        <span className="font-heading font-bold text-white">{profile.following || 0}</span>
                        <span className="text-neutral-500 text-sm mx-1">يتابع</span>
                    </button>
                    <div><span className="font-heading font-bold text-white">{videos.length}</span> <span className="text-neutral-500 text-sm">فيديو</span></div>
                </div>

                {!isMe && (
                    <div className="flex gap-2">
                        <button
                            onClick={follow}
                            data-testid="follow-btn"
                            className={`flex-1 rounded-full py-3 font-heading font-bold transition ${profile.is_following ? "bg-white/10 text-white" : "bg-[#D1795F] text-white hover:bg-[#B86648]"}`}
                        >
                            {profile.is_following ? "أتابعه" : "متابعة"}
                        </button>
                        <button
                            onClick={() => me ? navigate(`/messages/${profile.username}`) : navigate("/auth")}
                            data-testid="message-btn"
                            className="px-5 rounded-full py-3 font-heading font-bold bg-white/10 hover:bg-white/20 transition flex items-center gap-1"
                        >
                            <MessageCircle className="w-4 h-4" />
                            رسالة
                        </button>
                        {me && (
                            <button
                                onClick={() => setShowUserMenu(true)}
                                data-testid="user-menu-btn"
                                className="w-11 rounded-full py-3 font-heading font-bold bg-white/10 hover:bg-white/20 transition flex items-center justify-center"
                                title="خيارات"
                            >
                                <MoreVertical className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}

                {isMe && me?.role === "super_admin" && (
                    <button
                        data-testid="open-admin-btn"
                        onClick={() => navigate("/admin")}
                        className="mt-3 w-full bg-gradient-to-r from-red-500/10 to-red-500/5 hover:from-red-500/20 hover:to-red-500/10 border border-red-500/30 rounded-2xl p-3 transition flex items-center gap-3"
                    >
                        <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center flex-shrink-0">
                            <ShieldAlert className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 text-start">
                            <div className="font-heading font-bold text-white">لوحة المدير</div>
                            <div className="text-[10px] text-white/60 font-body">إدارة المستخدمين والصلاحيات</div>
                        </div>
                        <ArrowLeft className="w-4 h-4 text-red-400" />
                    </button>
                )}

                {isMe && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                        <button
                            data-testid="open-crm-btn"
                            onClick={() => navigate("/crm")}
                            className="bg-gradient-to-r from-[#D1795F]/10 to-[#D1795F]/5 hover:from-[#D1795F]/20 hover:to-[#D1795F]/10 border border-[#D1795F]/30 rounded-2xl p-3 transition flex flex-col items-center gap-1"
                        >
                            <div className="w-9 h-9 rounded-xl bg-[#D1795F] flex items-center justify-center">
                                <Briefcase className="w-4 h-4 text-black" />
                            </div>
                            <div className="font-heading font-bold text-white text-xs">CRM</div>
                        </button>
                        <button
                            data-testid="open-content-btn"
                            onClick={() => navigate("/content")}
                            className="bg-gradient-to-r from-[#D1795F]/10 to-[#D1795F]/5 hover:from-[#D1795F]/20 hover:to-[#D1795F]/10 border border-[#D1795F]/30 rounded-2xl p-3 transition flex flex-col items-center gap-1"
                        >
                            <div className="w-9 h-9 rounded-xl bg-[#D1795F] flex items-center justify-center">
                                <Video className="w-4 h-4 text-black" />
                            </div>
                            <div className="font-heading font-bold text-white text-xs">Content</div>
                        </button>
                        <button
                            data-testid="open-tasks-btn"
                            onClick={() => navigate("/tasks")}
                            className="bg-gradient-to-r from-[#D1795F]/10 to-[#D1795F]/5 hover:from-[#D1795F]/20 hover:to-[#D1795F]/10 border border-[#D1795F]/30 rounded-2xl p-3 transition flex flex-col items-center gap-1"
                        >
                            <div className="w-9 h-9 rounded-xl bg-[#D1795F] flex items-center justify-center">
                                <CheckSquare className="w-4 h-4 text-black" />
                            </div>
                            <div className="font-heading font-bold text-white text-xs">Tasks</div>
                        </button>
                    </div>
                )}

                {isMe && earnings && (
                    <div className="mt-3 bg-gradient-to-br from-[#D1795F]/10 to-transparent border border-[#D1795F]/30 rounded-2xl p-4" data-testid="earnings-card">
                        <div className="flex items-center gap-2 mb-2">
                            <Wallet className="w-4 h-4 text-[#D1795F]" />
                            <span className="text-xs text-neutral-400 font-heading font-bold">لوحة الأرباح</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                                <div className="text-[#D1795F] font-heading font-black text-lg">${earnings.total_earned}</div>
                                <div className="text-[10px] text-neutral-500">صافي</div>
                            </div>
                            <div>
                                <div className="text-white font-heading font-black text-lg">${earnings.total_gross}</div>
                                <div className="text-[10px] text-neutral-500">إجمالي</div>
                            </div>
                            <div>
                                <div className="text-neutral-400 font-heading font-black text-lg">{earnings.orders_count}</div>
                                <div className="text-[10px] text-neutral-500">طلبات مدفوعة</div>
                            </div>
                        </div>
                        <div className="text-[10px] text-neutral-500 mt-2 text-center">عمولة المنصة {earnings.platform_fee_percent}%</div>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10 px-6 gap-6">
                {[["videos", "الفيديوهات", Film], ["services", "الخدمات", Sparkles]].map(([k, label, Icon]) => (
                    <button
                        key={k}
                        data-testid={`tab-${k}`}
                        onClick={() => setTab(k)}
                        className={`flex items-center gap-2 py-3 border-b-2 transition font-heading font-bold text-sm ${tab === k ? "border-[#D1795F] text-[#D1795F]" : "border-transparent text-neutral-500"}`}
                    >
                        <Icon className="w-4 h-4" />
                        {label}
                    </button>
                ))}
            </div>

            <div className="p-4">
                {tab === "videos" && (
                    <div className="grid grid-cols-3 gap-1">
                        {videos.length === 0 && <div className="col-span-3 py-16 text-center text-neutral-500">لا يوجد فيديوهات</div>}
                        {videos.map((v) => (
                            <div key={v.id} className="aspect-[9/16] bg-neutral-900 rounded-md overflow-hidden relative group" data-testid={`profile-video-${v.id}`}>
                                <video src={`${API}/videos/stream/${v.id}`} className="w-full h-full object-cover" muted preload="metadata" />
                                <div className="absolute bottom-1 start-1 text-xs bg-black/60 px-1.5 py-0.5 rounded text-white">{v.likes || 0} ♥</div>
                                {isMe && (
                                    <button
                                        data-testid={`delete-video-${v.id}`}
                                        onClick={(e) => { e.stopPropagation(); removeVideo(v.id); }}
                                        className="absolute top-1 end-1 w-7 h-7 rounded-full bg-black/70 hover:bg-red-500 flex items-center justify-center transition opacity-90"
                                        title="حذف الفيديو"
                                    >
                                        <Trash2 className="w-3.5 h-3.5 text-white" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {tab === "services" && (
                    <div className="space-y-3">
                        {isMe && (
                            <button
                                onClick={() => setShowAdd(true)}
                                data-testid="add-service-btn"
                                className="w-full bg-[#141414] border-2 border-dashed border-[#333] hover:border-[#D1795F] rounded-2xl py-6 flex flex-col items-center gap-1 transition"
                            >
                                <Plus className="w-6 h-6 text-[#D1795F]" />
                                <div className="font-heading font-bold text-sm">إضافة خدمة</div>
                            </button>
                        )}
                        {services.length === 0 && !isMe && <div className="py-16 text-center text-neutral-500">لا توجد خدمات</div>}
                        {services.map((s) => (
                            <div key={s.id} className="bg-[#141414] border border-[#262626] rounded-2xl p-4" data-testid={`service-card-${s.id}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <Link to={`/service/${s.id}`} className="flex-1">
                                        <h4 className="font-heading font-bold mb-1">{s.title}</h4>
                                        <p className="text-sm text-neutral-400 line-clamp-2">{s.description}</p>
                                        <div className="text-xs text-neutral-500 mt-2">تسليم {s.delivery_days} أيام</div>
                                    </Link>
                                    <div className="text-end">
                                        <div className="text-[#D1795F] font-heading font-black text-xl">${s.price}</div>
                                        {isMe && (
                                            <button onClick={() => removeSvc(s.id)} data-testid={`delete-service-${s.id}`} className="text-neutral-500 mt-2">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Service Modal */}
            {showAdd && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
                    <form onSubmit={addService} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 space-y-4" data-testid="add-service-modal">
                        <h3 className="font-heading font-black text-xl">إضافة خدمة جديدة</h3>
                        <input required placeholder="عنوان الخدمة" data-testid="svc-title" value={svc.title} onChange={(e) => setSvc({ ...svc, title: e.target.value })} className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#D1795F] focus:outline-none" />
                        <textarea required placeholder="وصف الخدمة" data-testid="svc-desc" value={svc.description} onChange={(e) => setSvc({ ...svc, description: e.target.value })} rows={3} className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#D1795F] focus:outline-none resize-none" />
                        <div className="grid grid-cols-2 gap-3">
                            <input required type="number" min="1" step="0.01" placeholder="السعر (USD)" data-testid="svc-price" value={svc.price} onChange={(e) => setSvc({ ...svc, price: e.target.value })} className="bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#D1795F] focus:outline-none" />
                            <input required type="number" min="1" placeholder="مدة التسليم (يوم)" data-testid="svc-delivery" value={svc.delivery_days} onChange={(e) => setSvc({ ...svc, delivery_days: e.target.value })} className="bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#D1795F] focus:outline-none" />
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setShowAdd(false)} className="flex-1 bg-white/10 rounded-full py-3 font-heading font-bold">إلغاء</button>
                            <button type="submit" data-testid="submit-service" className="flex-1 bg-[#D1795F] text-white rounded-full py-3 font-heading font-bold">إضافة</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Followers / Following modal */}
            {followModal && (
                <FollowListModal
                    username={profile.username}
                    kind={followModal}
                    onClose={() => setFollowModal(null)}
                />
            )}

            {/* Other-user menu sheet: Report + Block */}
            {showUserMenu && !isMe && (
                <div
                    className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end justify-center"
                    onClick={() => setShowUserMenu(false)}
                    data-testid="user-menu-sheet"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-md bg-[#0A0A0A] border-t border-white/10 rounded-t-3xl p-5"
                    >
                        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4" />
                        <h3 className="font-heading font-bold text-lg mb-4 text-white">خيارات @{profile.username}</h3>

                        <button
                            data-testid="report-user-btn"
                            onClick={() => { setShowUserMenu(false); setShowReport(true); }}
                            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl px-4 py-3 flex items-center gap-3 transition mb-2"
                        >
                            <Flag className="w-5 h-5 text-amber-400" />
                            <span className="font-heading font-bold">الإبلاغ عن هذا المستخدم</span>
                        </button>

                        <button
                            data-testid="block-user-btn"
                            onClick={toggleBlock}
                            className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 flex items-center gap-3 transition"
                        >
                            <UserX className="w-5 h-5" />
                            <span className="font-heading font-bold">{isBlocked ? "إلغاء الحظر" : "حظر المستخدم"}</span>
                        </button>

                        <button
                            onClick={() => setShowUserMenu(false)}
                            className="w-full mt-3 bg-white/5 hover:bg-white/10 text-white rounded-xl px-4 py-3 font-heading font-bold transition"
                        >
                            إلغاء
                        </button>
                    </div>
                </div>
            )}

            {showReport && !isMe && (
                <ReportModal
                    targetType="user"
                    targetId={profile.id}
                    targetLabel={`مستخدم: @${profile.username}`}
                    onClose={() => setShowReport(false)}
                />
            )}
        </div>
    );
}
