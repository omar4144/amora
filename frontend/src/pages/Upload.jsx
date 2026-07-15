import { useState, useRef } from "react";
import api from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { UploadCloud, Film, X, Sparkles, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["ترفيه", "طبخ", "أزياء", "رياضة", "تعليم", "تسويق", "منتجات", "خدمات", "عام"];

const FILTERS = [
    { key: "",         label: "أصلي",     css: "none" },
    { key: "warm",     label: "دافئ",     css: "sepia(0.25) saturate(1.3) contrast(1.05) brightness(1.05)" },
    { key: "cool",     label: "بارد",     css: "hue-rotate(-15deg) saturate(1.1) brightness(1.05)" },
    { key: "vivid",    label: "زاهي",     css: "saturate(1.6) contrast(1.15)" },
    { key: "mono",     label: "أبيض/أسود", css: "grayscale(1) contrast(1.1)" },
    { key: "sepia",    label: "قديم",     css: "sepia(0.85) saturate(0.9)" },
    { key: "fade",     label: "خافت",     css: "brightness(1.15) saturate(0.75) contrast(0.9)" },
    { key: "dramatic", label: "درامي",    css: "contrast(1.4) saturate(1.2) brightness(0.9)" },
];

// Extract a frame at 1s (or 10% of duration) as a JPEG blob
async function extractThumbnail(videoUrl, filterCss) {
    return new Promise((resolve) => {
        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.src = videoUrl;
        video.muted = true;
        video.playsInline = true;
        video.onloadedmetadata = () => {
            video.currentTime = Math.min(1, (video.duration || 5) * 0.1);
        };
        video.onseeked = () => {
            const canvas = document.createElement("canvas");
            const w = Math.min(720, video.videoWidth || 720);
            const h = Math.round(w * (video.videoHeight / video.videoWidth || 16/9));
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (filterCss && filterCss !== "none") ctx.filter = filterCss;
            try {
                ctx.drawImage(video, 0, 0, w, h);
                canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82);
            } catch { resolve(null); }
        };
        video.onerror = () => resolve(null);
        setTimeout(() => resolve(null), 8000); // hard timeout
    });
}


export default function Upload() {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [caption, setCaption] = useState("");
    const [category, setCategory] = useState("عام");
    const [filter, setFilter] = useState(FILTERS[0]);
    const [thumbBlob, setThumbBlob] = useState(null);
    const [thumbUrl, setThumbUrl] = useState(null);
    const [regenerating, setRegenerating] = useState(false);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);
    const navigate = useNavigate();

    const onFile = async (f) => {
        if (!f) return;
        if (!f.type.startsWith("video/")) return toast.error("يجب اختيار ملف فيديو");
        if (f.size > 100 * 1024 * 1024) return toast.error("حجم الفيديو أكبر من 100MB");
        setFile(f);
        const url = URL.createObjectURL(f);
        setPreview(url);
        // auto-generate thumbnail with current filter
        setRegenerating(true);
        const blob = await extractThumbnail(url, filter.css);
        if (blob) {
            setThumbBlob(blob);
            setThumbUrl(URL.createObjectURL(blob));
        }
        setRegenerating(false);
    };

    const regenerateThumb = async (newFilter) => {
        setFilter(newFilter);
        if (!preview) return;
        setRegenerating(true);
        const blob = await extractThumbnail(preview, newFilter.css);
        if (blob) {
            setThumbBlob(blob);
            setThumbUrl(URL.createObjectURL(blob));
        }
        setRegenerating(false);
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!file) return toast.error("اختر فيديو أولاً");
        setLoading(true);
        const fd = new FormData();
        fd.append("file", file);
        fd.append("caption", caption);
        fd.append("category", category);
        fd.append("filter_name", filter.key);
        if (thumbBlob) fd.append("thumbnail", thumbBlob, "thumb.jpg");
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
            navigate("/feed");
        } catch (err) {
            toast.error(err?.response?.data?.detail || err?.message || "خطأ في الرفع", { id: "upload" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 pt-14 pb-24 font-body" data-testid="upload-page">
            <h1 className="text-3xl font-heading font-black mb-1">انشر فيديو جديد</h1>
            <p className="text-neutral-400 mb-6 text-sm">اجعل عالمك يشوفك</p>

            <form onSubmit={submit} className="flex flex-col gap-5">
                {!preview ? (
                    <label htmlFor="video-file-input" data-testid="pick-video-btn" className="bg-[#141414] border-2 border-dashed border-[#333] rounded-2xl p-10 flex flex-col items-center gap-3 hover:border-[#D1795F] transition cursor-pointer">
                        <UploadCloud className="w-12 h-12 text-[#D1795F]" />
                        <div className="font-heading font-bold">اضغط لاختيار فيديو</div>
                        <div className="text-xs text-neutral-500">MP4، MOV — حتى 100MB</div>
                    </label>
                ) : (
                    <>
                        <div className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-[400px]">
                            <video src={preview} className="w-full h-full object-contain" style={{ filter: filter.css }} controls />
                            <button type="button" data-testid="remove-video-btn" onClick={() => { setFile(null); setPreview(null); setThumbBlob(null); setThumbUrl(null); }} className="absolute top-2 end-2 w-8 h-8 rounded-full bg-black/70 flex items-center justify-center">
                                <X className="w-4 h-4" />
                            </button>
                            <span className="absolute bottom-2 start-2 text-[10px] bg-black/70 rounded-full px-2 py-0.5">{filter.label}</span>
                        </div>

                        {/* Filters */}
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-3.5 h-3.5 text-[#D1795F]" />
                                <label className="text-sm text-neutral-400">فلتر</label>
                            </div>
                            <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
                                {FILTERS.map((f) => (
                                    <button
                                        key={f.key || "orig"}
                                        type="button"
                                        data-testid={`filter-${f.key || "orig"}`}
                                        onClick={() => regenerateThumb(f)}
                                        className={`text-[11px] px-3 py-1.5 rounded-full whitespace-nowrap font-heading font-bold transition flex-shrink-0 ${filter.key === f.key ? "bg-[#D1795F] text-white" : "bg-white/5 text-white/60 border border-white/10"}`}
                                    >{f.label}</button>
                                ))}
                            </div>
                        </div>

                        {/* Thumbnail preview */}
                        {thumbUrl && (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-2 flex items-center gap-3" data-testid="thumb-preview">
                                <img src={thumbUrl} alt="thumbnail" className="w-16 h-20 object-cover rounded-lg flex-shrink-0" />
                                <div className="flex-1">
                                    <div className="text-xs text-white font-heading font-bold flex items-center gap-1"><ImageIcon className="w-3 h-3" /> صورة الغلاف تلقائية</div>
                                    <div className="text-[10px] text-white/50 mt-0.5">مُولَّدة من الفيديو مع الفلتر المختار</div>
                                </div>
                                {regenerating && <span className="text-[10px] text-[#D1795F] animate-pulse">جارٍ التحديث...</span>}
                            </div>
                        )}
                    </>
                )}
                <input id="video-file-input" ref={inputRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} data-testid="file-input" />

                <div>
                    <label className="text-sm text-neutral-400 mb-2 block">وصف الفيديو</label>
                    <textarea data-testid="caption-input" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="ما اللي تعرضه؟" rows={3} className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:border-[#D1795F] focus:outline-none resize-none" />
                </div>

                <div>
                    <label className="text-sm text-neutral-400 mb-2 block">الفئة</label>
                    <div className="flex flex-wrap gap-2">
                        {CATEGORIES.map((c) => (
                            <button type="button" key={c} data-testid={`cat-${c}`} onClick={() => setCategory(c)} className={`px-4 py-1.5 rounded-full text-sm font-heading font-bold transition ${category === c ? "bg-[#D1795F] text-white" : "bg-[#141414] border border-[#262626] text-neutral-300"}`}>
                                {c}
                            </button>
                        ))}
                    </div>
                </div>

                <button data-testid="submit-upload" type="submit" disabled={loading || !file} className="bg-[#D1795F] text-white font-heading font-bold rounded-full py-3.5 hover:bg-[#B86648] transition active:scale-95 disabled:opacity-50 mt-4 flex items-center justify-center gap-2">
                    <Film className="w-5 h-5" />
                    {loading ? "جارٍ الرفع..." : "نشر الفيديو"}
                </button>
            </form>
        </div>
    );
}
