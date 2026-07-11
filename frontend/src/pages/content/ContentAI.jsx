import { useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Wand2, Sparkles, Lightbulb, FileText, MessageCircle, Hash, Copy, Check } from "lucide-react";

const PROMPTS = [
    { key: "ideas", icon: Lightbulb, label: "ولّد أفكار محتوى", placeholder: "مثال: مقهى متخصّص في القهوة المختصة ليستهدف رواد الأعمال في الرياض" },
    { key: "script", icon: FileText, label: "اكتب سيناريو Reel", placeholder: "مثال: 5 أخطاء يرتكبها رواد الأعمال في أول سنة" },
    { key: "caption", icon: MessageCircle, label: "حسّن caption", placeholder: "الصق الـ caption الحالي هنا لأحسّنه..." },
    { key: "hashtags", icon: Hash, label: "ولّد Hashtags", placeholder: "مثال: محتوى عن اللياقة البدنية للمبتدئين" },
];

export default function ContentAI() {
    const [selected, setSelected] = useState("ideas");
    const [topic, setTopic] = useState("");
    const [platform, setPlatform] = useState("instagram");
    const [format, setFormat] = useState("reel");
    const [result, setResult] = useState("");
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);

    const current = PROMPTS.find((p) => p.key === selected);

    const run = async () => {
        if (!topic.trim()) return toast.error("أدخل الموضوع");
        setBusy(true);
        setResult("");
        try {
            const r = await api.post(`/content/ai/${selected}`, { topic, platform, format });
            setResult(r.data.result);
        } catch (err) {
            const msg = err.response?.data?.detail || "خطأ (ربما الميزانية مستنفدة)";
            setResult(msg);
            toast.error(msg);
        } finally { setBusy(false); }
    };

    const copy = () => {
        navigator.clipboard.writeText(result);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("نسخ!");
    };

    return (
        <div data-testid="content-ai" className="p-4 space-y-5">
            {/* Task selector */}
            <div>
                <p className="text-xs text-white/50 font-body mb-2">اختر المهمة</p>
                <div className="grid grid-cols-2 gap-2">
                    {PROMPTS.map((p) => (
                        <button
                            key={p.key}
                            data-testid={`ai-task-${p.key}`}
                            onClick={() => { setSelected(p.key); setResult(""); }}
                            className={`p-3 rounded-xl border transition text-start ${selected === p.key ? "bg-[#E3FF00]/10 border-[#E3FF00]/40" : "bg-white/5 border-white/10 hover:bg-white/10"}`}
                        >
                            <p.icon className={`w-4 h-4 mb-1.5 ${selected === p.key ? "text-[#E3FF00]" : "text-white/60"}`} />
                            <div className="text-xs font-heading font-semibold text-white leading-tight">{p.label}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Input */}
            <div className="space-y-3">
                <div>
                    <label className="text-xs text-white/50 font-body block mb-1">{current.label}</label>
                    <textarea
                        data-testid="ai-topic"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder={current.placeholder}
                        rows={4}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#E3FF00] outline-none resize-none"
                    />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white outline-none">
                        <option value="instagram">إنستقرام</option>
                        <option value="tiktok">تيك توك</option>
                        <option value="twitter">X</option>
                        <option value="linkedin">لينكدإن</option>
                        <option value="youtube">يوتيوب</option>
                    </select>
                    <select value={format} onChange={(e) => setFormat(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white outline-none">
                        <option value="reel">ريلز</option>
                        <option value="post">منشور</option>
                        <option value="story">قصة</option>
                        <option value="thread">ثريد</option>
                        <option value="video">فيديو</option>
                    </select>
                </div>
                <button
                    data-testid="ai-run"
                    onClick={run}
                    disabled={busy}
                    className="w-full bg-[#E3FF00] text-black font-heading font-bold rounded-xl py-3.5 text-sm flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60"
                >
                    {busy ? (
                        <>
                            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                            جارٍ التوليد...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-4 h-4" fill="black" />
                            ابدأ التوليد
                        </>
                    )}
                </button>
            </div>

            {/* Result */}
            {result && (
                <div data-testid="ai-result" className="bg-gradient-to-br from-[#141414] to-[#0A0A0A] border border-[#E3FF00]/30 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-[#E3FF00]" fill="#E3FF00" />
                            <h3 className="font-heading font-bold text-sm">النتيجة</h3>
                        </div>
                        <button onClick={copy} className="text-[10px] text-white/60 hover:text-white flex items-center gap-1">
                            {copied ? <><Check className="w-3 h-3 text-[#E3FF00]" /> نسخ!</> : <><Copy className="w-3 h-3" /> نسخ</>}
                        </button>
                    </div>
                    <div className="bg-black/40 rounded-xl p-4 text-sm text-white/90 whitespace-pre-wrap leading-relaxed font-body max-h-[500px] overflow-y-auto">
                        {result}
                    </div>
                </div>
            )}
        </div>
    );
}
