import { useState, useRef } from "react";
import api from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { UploadCloud, Film, X } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["ترفيه", "طبخ", "أزياء", "رياضة", "تعليم", "تسويق", "منتجات", "خدمات", "عام"];

export default function Upload() {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [caption, setCaption] = useState("");
    const [category, setCategory] = useState("عام");
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);
    const navigate = useNavigate();

    const onFile = (f) => {
        if (!f) return;
        if (!f.type.startsWith("video/")) {
            toast.error("يجب اختيار ملف فيديو");
            return;
        }
        if (f.size > 100 * 1024 * 1024) {
            toast.error("حجم الفيديو أكبر من 100MB");
            return;
        }
        setFile(f);
        setPreview(URL.createObjectURL(f));
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!file) return toast.error("اختر فيديو أولاً");
        setLoading(true);
        const fd = new FormData();
        fd.append("file", file);
        fd.append("caption", caption);
        fd.append("category", category);
        try {
            await api.post("/videos/upload", fd, {
                headers: { "Content-Type": "multipart/form-data" },
                timeout: 300000,
                onUploadProgress: (evt) => {
                    if (evt.total) {
                        const p = Math.round((evt.loaded * 100) / evt.total);
                        toast.loading(`جارٍ الرفع... ${p}%`, { id: "upload" });
                    }
                },
            });
            toast.success("تم النشر بنجاح", { id: "upload" });
            navigate("/");
        } catch (err) {
            const msg = err?.response?.data?.detail || err?.message || "خطأ في الرفع";
            toast.error(msg, { id: "upload" });
            console.error("Upload error:", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 pt-8 font-body" data-testid="upload-page">
            <h1 className="text-3xl font-heading font-black mb-1">انشر فيديو جديد</h1>
            <p className="text-neutral-400 mb-8 text-sm">اجعل عالمك يشوفك</p>

            <form onSubmit={submit} className="flex flex-col gap-5">
                {!preview ? (
                    <label
                        htmlFor="video-file-input"
                        data-testid="pick-video-btn"
                        className="bg-[#141414] border-2 border-dashed border-[#333] rounded-2xl p-10 flex flex-col items-center gap-3 hover:border-[#D1795F] transition cursor-pointer"
                    >
                        <UploadCloud className="w-12 h-12 text-[#D1795F]" />
                        <div className="font-heading font-bold">اضغط لاختيار فيديو</div>
                        <div className="text-xs text-neutral-500">MP4، MOV — حتى 100MB</div>
                    </label>
                ) : (
                    <div className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-[400px]">
                        <video src={preview} className="w-full h-full object-contain" controls />
                        <button
                            type="button"
                            data-testid="remove-video-btn"
                            onClick={() => { setFile(null); setPreview(null); }}
                            className="absolute top-2 end-2 w-8 h-8 rounded-full bg-black/70 flex items-center justify-center"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}
                <input
                    id="video-file-input"
                    ref={inputRef}
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm,video/*"
                    className="hidden"
                    onChange={(e) => onFile(e.target.files?.[0])}
                    data-testid="file-input"
                />

                <div>
                    <label className="text-sm text-neutral-400 mb-2 block">وصف الفيديو</label>
                    <textarea
                        data-testid="caption-input"
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        placeholder="ما اللي تعرضه؟"
                        rows={3}
                        className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:border-[#D1795F] focus:outline-none resize-none"
                    />
                </div>

                <div>
                    <label className="text-sm text-neutral-400 mb-2 block">الفئة</label>
                    <div className="flex flex-wrap gap-2">
                        {CATEGORIES.map((c) => (
                            <button
                                type="button"
                                key={c}
                                data-testid={`cat-${c}`}
                                onClick={() => setCategory(c)}
                                className={`px-4 py-1.5 rounded-full text-sm font-heading font-bold transition ${category === c ? "bg-[#D1795F] text-white" : "bg-[#141414] border border-[#262626] text-neutral-300"}`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    data-testid="submit-upload"
                    type="submit"
                    disabled={loading || !file}
                    className="bg-[#D1795F] text-white font-heading font-bold rounded-full py-3.5 hover:bg-[#B86648] transition active:scale-95 disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
                >
                    <Film className="w-5 h-5" />
                    {loading ? "جارٍ الرفع..." : "نشر الفيديو"}
                </button>
            </form>
        </div>
    );
}
