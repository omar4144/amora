import { useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";
import { ROLES, LOOKING_FOR } from "@/constants/roles";
import { X, Plus, Wand2, Camera, Loader2 } from "lucide-react";

export default function EditProfile() {
    const { user, setUser } = useAuth();
    const [f, setF] = useState({
        name: user?.name || "",
        bio: user?.bio || "",
        role: user?.role || "creator",
        looking_for: user?.looking_for || [],
        skills: user?.skills || [],
        years_experience: user?.years_experience || 0,
        intro_video_url: user?.intro_video_url || "",
        avatar_url: user?.avatar_url || "",
    });
    const [skillInput, setSkillInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [aiBusy, setAiBusy] = useState(false);
    const [avatarBusy, setAvatarBusy] = useState(false);
    const fileRef = useRef(null);
    const navigate = useNavigate();

    const onPickAvatar = () => fileRef.current?.click();

    const onAvatarChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) return toast.error("حجم الصورة كبير (الحد 5MB)");
        setAvatarBusy(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const r = await api.post("/users/me/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } });
            setF((prev) => ({ ...prev, avatar_url: r.data.avatar_url }));
            setUser({ ...(user || {}), avatar_url: r.data.avatar_url });
            toast.success("تم تحديث صورة العرض");
        } catch (err) {
            toast.error(err.response?.data?.detail || "تعذّر الرفع");
        } finally {
            setAvatarBusy(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const toggle = (item, key) => {
        setF({ ...f, [key]: f[key].includes(item) ? f[key].filter((x) => x !== item) : [...f[key], item] });
    };
    const addSkill = () => {
        if (!skillInput.trim() || f.skills.includes(skillInput.trim())) return;
        setF({ ...f, skills: [...f.skills, skillInput.trim()] });
        setSkillInput("");
    };
    const removeSkill = (s) => setF({ ...f, skills: f.skills.filter((x) => x !== s) });

    const improveBio = async () => {
        setAiBusy(true);
        try {
            const ctx = JSON.stringify({
                current_bio: f.bio || "",
                name: f.name,
                role: f.role,
                skills: f.skills,
                years_experience: f.years_experience,
            }, null, 2);
            const task = f.bio?.trim() ? "improve_bio" : "profile_bio";
            const r = await api.post("/ai/assist", { task, context: ctx });
            setF({ ...f, bio: r.data.result });
            toast.success("تم تحسين النبذة بالذكاء ✨");
        } catch (err) {
            toast.error(err.response?.data?.detail || "خطأ في المساعد");
        } finally { setAiBusy(false); }
    };

    const save = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.put("/users/me", { ...f, years_experience: parseInt(f.years_experience) || 0 });
            setUser(res.data);
            toast.success("تم الحفظ");
            navigate(`/u/${user.username}`);
        } catch { toast.error("خطأ في الحفظ"); }
        finally { setLoading(false); }
    };

    return (
        <div className="p-6 pt-8 font-body pb-24" data-testid="edit-profile-page">
            <h1 className="text-3xl font-heading font-black mb-6">الملف الاحترافي</h1>
            <form onSubmit={save} className="flex flex-col gap-5">
                {/* Avatar upload */}
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        data-testid="avatar-picker"
                        onClick={onPickAvatar}
                        className="relative w-24 h-24 rounded-2xl overflow-hidden bg-[#141414] border-2 border-dashed border-[#D1795F]/40 hover:border-[#D1795F] transition group flex items-center justify-center"
                    >
                        {f.avatar_url ? (
                            <img src={f.avatar_url} alt="avatar" className="w-full h-full object-cover" data-testid="avatar-preview" />
                        ) : (
                            <div className="w-14 h-14 rounded-full bg-[#D1795F] text-white flex items-center justify-center text-2xl font-heading font-black">
                                {f.name?.[0] || "?"}
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                            {avatarBusy ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
                        </div>
                    </button>
                    <div>
                        <div className="text-sm text-white font-heading font-bold">صورة العرض</div>
                        <div className="text-xs text-white/50 font-body mt-1">JPG / PNG / WEBP<br />الحد الأقصى 5MB</div>
                        <button
                            type="button"
                            data-testid="avatar-change-btn"
                            onClick={onPickAvatar}
                            disabled={avatarBusy}
                            className="mt-2 text-xs text-[#D1795F] hover:underline font-heading font-bold flex items-center gap-1 disabled:opacity-50"
                        >
                            <Camera className="w-3 h-3" /> {f.avatar_url ? "تغيير الصورة" : "اختر صورة"}
                        </button>
                    </div>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={onAvatarChange}
                        className="hidden"
                        data-testid="avatar-input"
                    />
                </div>

                <div>
                    <label className="text-sm text-neutral-400 mb-2 block">الاسم الكامل</label>
                    <input data-testid="edit-name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#D1795F] focus:outline-none" />
                </div>
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm text-neutral-400">نبذة عنك</label>
                        <button
                            type="button"
                            data-testid="improve-bio-btn"
                            onClick={improveBio}
                            disabled={aiBusy}
                            className="text-[11px] text-[#D1795F] hover:text-[#B86648] font-heading font-bold flex items-center gap-1 disabled:opacity-50"
                        >
                            <Wand2 className={`w-3 h-3 ${aiBusy ? "animate-pulse" : ""}`} />
                            {aiBusy ? "يحسّن..." : (f.bio?.trim() ? "حسّن بالذكاء" : "اكتب لي bio")}
                        </button>
                    </div>
                    <textarea data-testid="edit-bio" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} rows={3} placeholder="عرّف عن نفسك ومشاريعك..." className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#D1795F] focus:outline-none resize-none" />
                </div>
                <div>
                    <label className="text-sm text-neutral-400 mb-2 block">من أنت؟</label>
                    <div className="grid grid-cols-3 gap-2">
                        {ROLES.map((r) => (
                            <button type="button" key={r.id} data-testid={`edit-role-${r.id}`} onClick={() => setF({ ...f, role: r.id })} className={`text-xs px-2 py-2 rounded-lg border font-heading font-bold ${f.role === r.id ? "bg-[#D1795F] text-white border-[#D1795F]" : "bg-[#141414] border-[#262626]"}`}>{r.label}</button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="text-sm text-neutral-400 mb-2 block">تبحث عن</label>
                    <div className="flex flex-wrap gap-2">
                        {LOOKING_FOR.map((item) => (
                            <button type="button" key={item} onClick={() => toggle(item, "looking_for")} className={`px-3 py-1.5 rounded-full text-xs font-heading font-bold ${f.looking_for.includes(item) ? "bg-[#D1795F] text-white" : "bg-[#141414] border border-[#262626]"}`}>{item}</button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="text-sm text-neutral-400 mb-2 block">المهارات</label>
                    <div className="flex gap-2 mb-2">
                        <input value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())} placeholder="مهارة (مثلاً: Photoshop)" className="flex-1 bg-[#141414] border border-[#262626] rounded-xl px-4 py-2 focus:border-[#D1795F] focus:outline-none text-sm" />
                        <button type="button" onClick={addSkill} className="w-10 h-10 rounded-full bg-[#D1795F] text-white flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {f.skills.map((s) => (
                            <span key={s} className="bg-[#141414] border border-[#262626] rounded-full px-3 py-1 text-xs flex items-center gap-1">
                                {s} <button type="button" onClick={() => removeSkill(s)}><X className="w-3 h-3" /></button>
                            </span>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="text-sm text-neutral-400 mb-2 block">سنوات الخبرة</label>
                    <input type="number" min="0" data-testid="edit-years" value={f.years_experience} onChange={(e) => setF({ ...f, years_experience: e.target.value })} className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#D1795F] focus:outline-none" />
                </div>
                <div>
                    <label className="text-sm text-neutral-400 mb-2 block">رابط فيديو تعريفي (اختياري)</label>
                    <input type="url" data-testid="edit-intro" placeholder="https://..." value={f.intro_video_url} onChange={(e) => setF({ ...f, intro_video_url: e.target.value })} className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#D1795F] focus:outline-none" />
                </div>
                <button data-testid="save-profile-btn" type="submit" disabled={loading} className="bg-[#D1795F] text-white font-heading font-bold rounded-full py-3.5 hover:bg-[#B86648] transition active:scale-95 disabled:opacity-50 mt-3">
                    {loading ? "..." : "حفظ الملف الاحترافي"}
                </button>
            </form>
        </div>
    );
}
