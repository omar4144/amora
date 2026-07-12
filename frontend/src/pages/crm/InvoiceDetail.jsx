import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { API } from "@/lib/api";
import { toast } from "sonner";
import { ArrowRight, Download, Trash2, FileText, Send, Check, X as XIcon } from "lucide-react";

const STATUSES = [
    { key: "draft",     label: "مسودة",   color: "#94A3B8" },
    { key: "sent",      label: "مُرسلة",   color: "#57769D" },
    { key: "paid",      label: "مدفوعة",  color: "#C3E0A5" },
    { key: "overdue",   label: "متأخرة",  color: "#EF4444" },
    { key: "cancelled", label: "ملغاة",   color: "#6B7280" },
];

export default function InvoiceDetail() {
    const { id } = useParams();
    const nav = useNavigate();
    const [inv, setInv] = useState(null);

    const load = async () => {
        try {
            const r = await api.get(`/crm/invoices/${id}`);
            setInv(r.data);
        } catch {
            toast.error("تعذّر التحميل");
            nav("/crm/invoices");
        }
    };
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

    const setStatus = async (status) => {
        try {
            const r = await api.put(`/crm/invoices/${id}`, { status });
            setInv(r.data);
            toast.success("تم التحديث");
        } catch { toast.error("خطأ"); }
    };

    const remove = async () => {
        if (!window.confirm("حذف الفاتورة؟")) return;
        await api.delete(`/crm/invoices/${id}`);
        toast.success("محذوفة");
        nav("/crm/invoices");
    };

    const downloadPdf = () => {
        const token = localStorage.getItem("token");
        // fetch as blob to include auth header
        fetch(`${API}/crm/invoices/${id}/pdf`, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.blob())
            .then((b) => {
                const url = URL.createObjectURL(b);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${inv.number || "invoice"}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
            })
            .catch(() => toast.error("تعذّر تحميل الـ PDF"));
    };

    if (!inv) return <div className="p-8 text-white/50 text-center">جارٍ التحميل...</div>;

    const currentSt = STATUSES.find((s) => s.key === inv.status) || STATUSES[0];

    return (
        <div data-testid="invoice-detail" className="p-4 space-y-5 pb-24">
            <button onClick={() => nav("/crm/invoices")} className="text-xs text-white/60 flex items-center gap-1">
                <ArrowRight className="w-3 h-3" /> رجوع للفواتير
            </button>

            {/* Header */}
            <div className="bg-gradient-to-br from-[#D1795F]/10 via-[#141414] to-[#0A0A0A] border border-[#D1795F]/20 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <FileText className="w-4 h-4 text-[#D1795F]" />
                            <span className="text-[10px] text-white/50 font-heading font-bold">{inv.number}</span>
                        </div>
                        <h1 className="font-heading font-black text-xl text-white truncate">{inv.title}</h1>
                        {inv.client && <div className="text-xs text-white/60 mt-1">للعميل: <button onClick={() => nav(`/crm/clients/${inv.client.id}`)} className="text-[#D1795F] hover:underline">{inv.client.name}</button></div>}
                    </div>
                    <div className="flex flex-col gap-1">
                        <button data-testid="download-pdf-btn" onClick={downloadPdf} className="w-8 h-8 rounded-full bg-[#D1795F] flex items-center justify-center" title="تحميل PDF">
                            <Download className="w-3.5 h-3.5 text-white" />
                        </button>
                        <button data-testid="delete-invoice-btn" onClick={remove} className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center">
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                    </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                    <div>
                        <div className="text-[10px] text-white/50">الإجمالي</div>
                        <div className="text-[#D1795F] font-heading font-black text-3xl">${(inv.total || 0).toLocaleString()}</div>
                        <div className="text-[10px] text-white/40">{inv.currency}</div>
                    </div>
                    <span className="text-xs px-3 py-1 rounded-full font-heading font-bold text-black" style={{ backgroundColor: currentSt.color }}>{currentSt.label}</span>
                </div>
            </div>

            {/* Status picker */}
            <div>
                <p className="text-xs text-white/50 font-body mb-2">حالة الفاتورة</p>
                <div className="grid grid-cols-5 gap-1.5">
                    {STATUSES.map((s) => (
                        <button
                            key={s.key}
                            data-testid={`invoice-status-${s.key}`}
                            onClick={() => setStatus(s.key)}
                            className={`text-[10px] font-heading font-semibold px-2 py-2 rounded-lg transition ${inv.status === s.key ? "text-black" : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"}`}
                            style={{ backgroundColor: inv.status === s.key ? s.color : undefined }}
                        >{s.label}</button>
                    ))}
                </div>
            </div>

            {/* Items */}
            <div>
                <p className="text-xs text-white/50 font-body mb-2">البنود</p>
                <div className="bg-white/5 border border-white/10 rounded-2xl divide-y divide-white/10">
                    {(inv.items || []).map((it, i) => (
                        <div key={i} className="p-3 flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="text-sm text-white font-heading font-semibold truncate">{it.description}</div>
                                <div className="text-[10px] text-white/50">{it.quantity} × ${it.unit_price?.toFixed?.(2) || it.unit_price}</div>
                            </div>
                            <div className="text-sm text-white/80 font-heading font-bold flex-shrink-0">${((it.quantity || 0) * (it.unit_price || 0)).toFixed(2)}</div>
                        </div>
                    ))}
                    {(!inv.items || inv.items.length === 0) && <div className="p-6 text-center text-white/40 text-sm">لا توجد بنود</div>}
                </div>
            </div>

            {/* Totals */}
            <div className="bg-[#D1795F]/5 border border-[#D1795F]/20 rounded-2xl p-4 space-y-1.5 text-sm">
                <Row label="المجموع الفرعي" value={`$${(inv.subtotal || 0).toFixed(2)}`} />
                {inv.tax_percent > 0 && <Row label={`ضريبة (${inv.tax_percent}%)`} value={`$${(inv.tax_amount || 0).toFixed(2)}`} />}
                {inv.discount > 0 && <Row label="خصم" value={`-$${inv.discount.toFixed(2)}`} />}
                <div className="border-t border-[#D1795F]/30 pt-2 mt-1">
                    <Row label="الإجمالي" value={`$${(inv.total || 0).toFixed(2)}`} bold />
                </div>
            </div>

            {inv.notes && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="text-xs text-white/50 mb-1">ملاحظات</div>
                    <div className="text-sm text-white/90 font-body">{inv.notes}</div>
                </div>
            )}
        </div>
    );
}

function Row({ label, value, bold }) {
    return (
        <div className={`flex justify-between ${bold ? "text-[#D1795F] font-heading font-black text-base" : "text-white/70"}`}>
            <span>{label}</span>
            <span>{value}</span>
        </div>
    );
}
