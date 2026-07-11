import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Link } from "react-router-dom";
import { Search as SearchIcon, X } from "lucide-react";
import { API } from "@/lib/api";

export default function Search() {
    const [q, setQ] = useState("");
    const [results, setResults] = useState({ users: [], videos: [] });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!q.trim()) {
            setResults({ users: [], videos: [] });
            return;
        }
        const t = setTimeout(() => {
            setLoading(true);
            api.get(`/search?q=${encodeURIComponent(q)}`).then((r) => setResults(r.data)).finally(() => setLoading(false));
        }, 300);
        return () => clearTimeout(t);
    }, [q]);

    return (
        <div className="p-6 pt-8 font-body" data-testid="search-page">
            <div className="relative mb-6">
                <SearchIcon className="w-5 h-5 text-neutral-500 absolute start-4 top-1/2 -translate-y-1/2" />
                <input
                    data-testid="search-input"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="ابحث عن صانع محتوى أو فئة..."
                    className="w-full bg-[#141414] border border-[#262626] rounded-full ps-11 pe-11 py-3.5 focus:border-[#D1795F] focus:outline-none"
                    autoFocus
                />
                {q && (
                    <button onClick={() => setQ("")} className="absolute end-4 top-1/2 -translate-y-1/2 text-neutral-500">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {loading && <div className="text-neutral-500 text-center">جارٍ البحث...</div>}

            {results.users.length > 0 && (
                <>
                    <h3 className="font-heading font-bold text-neutral-400 mb-3 text-sm">صناع المحتوى</h3>
                    <div className="space-y-2 mb-6">
                        {results.users.map((u) => (
                            <Link key={u.id} to={`/u/${u.username}`} data-testid={`search-user-${u.username}`} className="flex items-center gap-3 bg-[#141414] border border-[#262626] hover:border-[#D1795F] rounded-2xl p-3 transition">
                                <div className="w-11 h-11 rounded-full bg-[#D1795F] flex items-center justify-center text-black font-heading font-black">{u.name?.[0]}</div>
                                <div className="flex-1">
                                    <div className="font-heading font-bold">{u.name}</div>
                                    <div className="text-xs text-neutral-500">@{u.username} · {u.followers || 0} متابع</div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </>
            )}

            {results.videos.length > 0 && (
                <>
                    <h3 className="font-heading font-bold text-neutral-400 mb-3 text-sm">فيديوهات</h3>
                    <div className="grid grid-cols-3 gap-1">
                        {results.videos.map((v) => (
                            <Link key={v.id} to={`/u/${v.creator?.username}`} className="aspect-[9/16] bg-neutral-900 rounded-md overflow-hidden relative" data-testid={`search-video-${v.id}`}>
                                <video src={`${API}/videos/stream/${v.id}`} className="w-full h-full object-cover" muted preload="metadata" />
                                <div className="absolute bottom-1 start-1 text-[10px] bg-black/70 px-1.5 py-0.5 rounded">@{v.creator?.username}</div>
                            </Link>
                        ))}
                    </div>
                </>
            )}

            {q && !loading && results.users.length === 0 && results.videos.length === 0 && (
                <div className="text-center py-16 text-neutral-500">لا نتائج</div>
            )}
        </div>
    );
}
