import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";
import { ROLES, LOOKING_FOR } from "@/constants/roles";
import { X, Plus } from "lucide-react";

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
    });
    const [skillInput, setSkillInput] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const toggle = (item, key) => {
        setF({ ...f, [key]: f[key].includes(item) ? f[key].filter((x) => x !== item) : [...f[key], item] });
    };
    const addSkill = () => {
        if (!skillInput.trim() || f.skills.includes(skillInput.trim())) return;
        setF({ ...f, skills: [...f.skills, skillInput.trim()] });
        setSkillInput("");
    };
    const removeSkill = (s) => setF({ ...f, skills: f.skills.filter((x) => x !== s) });

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
                <div>
                    <label className="text-sm text-neutral-400 mb-2 block">الاسم الكامل</label>
                    <input data-testid="edit-name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#D1795F] focus:outline-none" />
                </div>
                <div>
                    <label className="text-sm text-neutral-400 mb-2 block">نبذة عنك</label>
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
