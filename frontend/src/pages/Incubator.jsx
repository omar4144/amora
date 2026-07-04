import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Sprout, Plus, X, ChevronRight } from "lucide-react";

export default function Incubator() {
    const [stages, setStages] = useState([]);
    const [ideas, setIdeas] = useState([]);
    const [selected, setSelected] = useState(null);
    const [show, setShow] = useState(false);
    const [form, setForm] = useState({ title: "", description: "" });
    const navigate = useNavigate();

    const load = () => {
        api.get("/incubator/stages").then((r) => setStages(r.data));
        api.get("/incubator/ideas").then((r) => setIdeas(r.data)).catch(() => navigate("/auth"));
    };
    useEffect(load, []);

    const create = async (e) => {
        e.preventDefault();
        try {
            const r = await api.post("/incubator/ideas", form);
            setIdeas([r.data, ...ideas]); setShow(false); setSelected(r.data);
            setForm({ title: "", description: "" });
            toast.success("بدأنا رحلة فكرتك 🌱");
        } catch { toast.error("خطأ"); }
    };

    const updateStage = async (stage, progress) => {
        const r = await api.put(`/incubator/ideas/${selected.id}/stage`, { stage, progress, notes: "" });
        setSelected(r.data);
        setIdeas(ideas.map((i) => i.id === r.data.id ? r.data : i));
    };

    return (
        <div className="p-6 pt-8 font-body pb-24" data-testid="incubator-page">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2"><Sprout className="w-6 h-6 text-[#E3FF00]" /><h1 className="text-2xl font-heading font-black">الحاضنة</h1></div>
                <button data-testid="new-idea-btn" onClick={() => setShow(true)} className="bg-[#E3FF00] text-black font-heading font-bold rounded-full px-4 py-2 text-sm flex items-center gap-1"><Plus className="w-4 h-4" /> فكرة</button>
            </div>
            <p className="text-sm text-neutral-400 mb-6">من الفكرة إلى الإطلاق — 7 مراحل منظمة</p>

            {!selected && (
                <>
                    {ideas.length === 0 && <div className="text-center py-16 text-neutral-500">ابدأ فكرتك الأولى</div>}
                    <div className="space-y-3">
                        {ideas.map((i) => (
                            <button key={i.id} onClick={() => setSelected(i)} data-testid={`idea-${i.id}`} className="w-full text-start bg-[#141414] border border-[#262626] hover:border-[#E3FF00] rounded-2xl p-4 transition">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-heading font-bold">{i.title}</h3>
                                    <span className="text-[#E3FF00] font-heading font-black">{i.overall_progress}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-black rounded-full overflow-hidden">
                                    <div className="h-full bg-[#E3FF00]" style={{ width: `${i.overall_progress}%` }} />
                                </div>
                            </button>
                        ))}
                    </div>
                </>
            )}

            {selected && (
                <div>
                    <button onClick={() => setSelected(null)} className="text-neutral-400 mb-3 text-sm flex items-center gap-1"><ChevronRight className="w-4 h-4" /> رجوع</button>
                    <h2 className="text-xl font-heading font-black mb-1">{selected.title}</h2>
                    <p className="text-sm text-neutral-400 mb-2">{selected.description}</p>
                    <div className="text-3xl font-heading font-black text-[#E3FF00] mb-4">{selected.overall_progress}%</div>
                    <div className="space-y-3">
                        {stages.map((s) => {
                            const st = selected.stages.find((x) => x.stage === s.id) || { progress: 0 };
                            return (
                                <div key={s.id} className="bg-[#141414] border border-[#262626] rounded-2xl p-4" data-testid={`stage-${s.id}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl">{s.icon}</span>
                                            <div>
                                                <div className="font-heading font-bold text-sm">{s.name}</div>
                                                <div className="text-[10px] text-neutral-500">المرحلة {s.id}/7</div>
                                            </div>
                                        </div>
                                        <span className="text-[#E3FF00] font-heading font-black text-lg">{st.progress}%</span>
                                    </div>
                                    <input type="range" min="0" max="100" step="10" value={st.progress} onChange={(e) => updateStage(s.id, parseInt(e.target.value))} data-testid={`stage-slider-${s.id}`} className="w-full accent-[#E3FF00]" />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {show && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShow(false)}>
                    <form onSubmit={create} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 space-y-3">
                        <div className="flex items-center justify-between"><h3 className="font-heading font-black text-lg">احتضن فكرتي</h3><button type="button" onClick={() => setShow(false)}><X className="w-5 h-5" /></button></div>
                        <input required data-testid="idea-title" placeholder="اسم الفكرة" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#E3FF00] focus:outline-none" />
                        <textarea required data-testid="idea-desc" placeholder="اشرح فكرتك..." rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#E3FF00] focus:outline-none resize-none" />
                        <button data-testid="submit-idea" type="submit" className="w-full bg-[#E3FF00] text-black font-heading font-bold rounded-full py-3">ابدأ الرحلة</button>
                    </form>
                </div>
            )}
        </div>
    );
}
