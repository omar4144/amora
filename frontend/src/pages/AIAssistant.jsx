import { useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Bot, Sparkles } from "lucide-react";

const TASKS = [
    { id: "reels_script", label: "سيناريو ريلز", placeholder: "ما فكرة الريلز؟" },
    { id: "marketing_plan", label: "خطة تسويق", placeholder: "اذكر مشروعك وجمهورك" },
    { id: "project_names", label: "أسماء مشاريع", placeholder: "ما مجال مشروعك؟" },
    { id: "account_analysis", label: "تحليل حساب", placeholder: "معلومات عن حسابك ومحتواك" },
    { id: "pricing", label: "اقتراح أسعار", placeholder: "خدماتك وخبرتك" },
    { id: "profile_bio", label: "بروفايل احترافي", placeholder: "مهاراتك وخبرتك" },
    { id: "competitors", label: "تحليل المنافسين", placeholder: "المشروع والمجال" },
];

export default function AIAssistant() {
    const [task, setTask] = useState(TASKS[0]);
    const [ctx, setCtx] = useState("");
    const [result, setResult] = useState("");
    const [loading, setLoading] = useState(false);

    const run = async (e) => {
        e.preventDefault();
        if (!ctx.trim()) return;
        setLoading(true); setResult("");
        try {
            const r = await api.post("/ai/assist", { task: task.id, context: ctx });
            setResult(r.data.result);
        } catch (err) {
            toast.error(err?.response?.data?.detail || "خطأ في المساعد");
        } finally { setLoading(false); }
    };

    return (
        <div className="p-6 pt-8 font-body pb-24" data-testid="ai-page">
            <div className="flex items-center gap-2 mb-2">
                <Bot className="w-7 h-7 text-[#E3FF00]" />
                <h1 className="text-3xl font-heading font-black">مساعد رؤى</h1>
            </div>
            <p className="text-sm text-neutral-400 mb-6 flex items-center gap-1"><Sparkles className="w-3 h-3 text-[#E3FF00]" /> مدعوم بـ Claude Sonnet 4.5</p>

            <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-1">
                {TASKS.map((t) => (
                    <button key={t.id} data-testid={`task-${t.id}`} onClick={() => { setTask(t); setResult(""); }} className={`shrink-0 px-4 py-2 rounded-full text-xs font-heading font-bold whitespace-nowrap ${task.id === t.id ? "bg-[#E3FF00] text-black" : "bg-[#141414] border border-[#262626]"}`}>{t.label}</button>
                ))}
            </div>

            <form onSubmit={run} className="mb-4">
                <textarea data-testid="ai-context" required value={ctx} onChange={(e) => setCtx(e.target.value)} placeholder={task.placeholder} rows={4} className="w-full bg-[#141414] border border-[#262626] rounded-2xl px-4 py-3 focus:border-[#E3FF00] focus:outline-none resize-none mb-3" />
                <button data-testid="ai-submit" type="submit" disabled={loading} className="w-full bg-[#E3FF00] text-black font-heading font-bold rounded-full py-3 disabled:opacity-50">
                    {loading ? "جارٍ التفكير..." : `اطلب: ${task.label}`}
                </button>
            </form>

            {result && (
                <div className="bg-[#141414] border border-[#E3FF00]/30 rounded-2xl p-4 whitespace-pre-line text-sm leading-relaxed" data-testid="ai-result">
                    {result}
                </div>
            )}
        </div>
    );
}
