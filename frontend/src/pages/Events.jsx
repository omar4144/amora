import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Calendar, Plus, X, Ticket, MapPin } from "lucide-react";

const KINDS = [{id:"workshop",l:"ورشة"},{id:"meetup",l:"لقاء"},{id:"podcast",l:"بودكاست"},{id:"exhibition",l:"معرض"},{id:"show",l:"عرض"}];

export default function Events() {
    const [items, setItems] = useState([]); const [show, setShow] = useState(false);
    const [f, setF] = useState({title:"",description:"",kind:"workshop",date:"",location:"",price:0,capacity:50});
    const { user } = useAuth(); const navigate = useNavigate();
    const load = () => api.get("/events").then(r=>setItems(r.data));
    useEffect(load, []);

    const create = async (e) => { e.preventDefault();
        if(!user) return navigate("/auth");
        try { await api.post("/events",{...f,price:parseFloat(f.price||0),capacity:parseInt(f.capacity)});
            toast.success("نُشرت الفعالية"); setShow(false); load();
            setF({title:"",description:"",kind:"workshop",date:"",location:"",price:0,capacity:50});
        } catch { toast.error("خطأ"); } };
    const register = async (id) => { if(!user) return navigate("/auth");
        try { const r = await api.post(`/events/${id}/register`); toast.success(`تذكرتك: ${r.data.code}`); load(); }
        catch(err){ toast.error(err?.response?.data?.detail||"خطأ"); } };

    return (
        <div className="p-6 pt-8 font-body pb-24" data-testid="events-page">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2"><Calendar className="w-6 h-6 text-[#E3FF00]"/><h1 className="text-2xl font-heading font-black">الفعاليات</h1></div>
                <button data-testid="new-event-btn" onClick={()=>user?setShow(true):navigate("/auth")} className="bg-[#E3FF00] text-black font-heading font-bold rounded-full px-4 py-2 text-sm flex items-center gap-1"><Plus className="w-4 h-4"/>فعالية</button>
            </div>
            {items.length===0 && <div className="text-center py-16 text-neutral-500">لا فعاليات بعد</div>}
            <div className="space-y-3">
                {items.map(e=>(
                    <div key={e.id} className="bg-[#141414] border border-[#262626] rounded-2xl p-4" data-testid={`event-${e.id}`}>
                        <div className="flex items-start justify-between mb-2">
                            <h3 className="font-heading font-bold">{e.title}</h3>
                            <span className="text-[10px] bg-[#E3FF00]/20 text-[#E3FF00] px-2 py-0.5 rounded-full">{KINDS.find(k=>k.id===e.kind)?.l}</span>
                        </div>
                        <p className="text-sm text-neutral-400 line-clamp-2 mb-2">{e.description}</p>
                        <div className="flex flex-wrap gap-3 text-xs text-neutral-500 mb-3">
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/>{new Date(e.date).toLocaleDateString("ar")}</span>
                            {e.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/>{e.location}</span>}
                            <span>{e.tickets_sold}/{e.capacity} مسجّل</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[#E3FF00] font-heading font-black">{e.price>0?`$${e.price}`:"مجاناً"}</span>
                            <button onClick={()=>register(e.id)} data-testid={`register-${e.id}`} className="bg-[#E3FF00] text-black font-heading font-bold rounded-full px-4 py-1.5 text-xs flex items-center gap-1"><Ticket className="w-3 h-3"/>احجز</button>
                        </div>
                    </div>
                ))}
            </div>
            {show && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={()=>setShow(false)}>
                    <form onSubmit={create} onClick={e=>e.stopPropagation()} className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 space-y-2 max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between"><h3 className="font-heading font-black text-lg">فعالية جديدة</h3><button type="button" onClick={()=>setShow(false)}><X className="w-5 h-5"/></button></div>
                        <input required data-testid="ev-title" placeholder="عنوان الفعالية" value={f.title} onChange={e=>setF({...f,title:e.target.value})} className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#E3FF00] focus:outline-none"/>
                        <textarea required data-testid="ev-desc" placeholder="الوصف" rows={2} value={f.description} onChange={e=>setF({...f,description:e.target.value})} className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#E3FF00] focus:outline-none resize-none"/>
                        <div className="grid grid-cols-5 gap-1">{KINDS.map(k=><button key={k.id} type="button" onClick={()=>setF({...f,kind:k.id})} className={`text-xs py-2 rounded-lg font-heading font-bold ${f.kind===k.id?"bg-[#E3FF00] text-black":"bg-[#141414] border border-[#262626]"}`}>{k.l}</button>)}</div>
                        <input required type="date" data-testid="ev-date" value={f.date} onChange={e=>setF({...f,date:e.target.value})} className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#E3FF00] focus:outline-none"/>
                        <input data-testid="ev-loc" placeholder="الموقع" value={f.location} onChange={e=>setF({...f,location:e.target.value})} className="w-full bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#E3FF00] focus:outline-none"/>
                        <div className="grid grid-cols-2 gap-2">
                            <input type="number" min="0" data-testid="ev-price" placeholder="السعر ($)" value={f.price} onChange={e=>setF({...f,price:e.target.value})} className="bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#E3FF00] focus:outline-none"/>
                            <input type="number" min="1" data-testid="ev-cap" placeholder="السعة" value={f.capacity} onChange={e=>setF({...f,capacity:e.target.value})} className="bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 focus:border-[#E3FF00] focus:outline-none"/>
                        </div>
                        <button data-testid="submit-event" type="submit" className="w-full bg-[#E3FF00] text-black font-heading font-bold rounded-full py-3">نشر الفعالية</button>
                    </form>
                </div>
            )}
        </div>
    );
}
