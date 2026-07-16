import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function LegalShell({ title, subtitle, updated, children }) {
    return (
        <div className="min-h-[100dvh] bg-[#0A0A0F] text-white font-body" data-testid="legal-page">
            <div className="max-w-3xl mx-auto px-5 py-8 pb-24">
                <Link
                    to="/"
                    data-testid="legal-back-home"
                    className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-8 transition"
                >
                    <ArrowLeft className="w-4 h-4" />
                    الرجوع للصفحة الرئيسية
                </Link>
                <header className="mb-10 border-b border-white/10 pb-6">
                    <h1 className="text-3xl sm:text-4xl font-heading font-black text-white mb-2">{title}</h1>
                    {subtitle && <p className="text-white/60 font-body leading-relaxed">{subtitle}</p>}
                    {updated && <p className="text-[11px] text-white/40 mt-3">آخر تحديث: {updated}</p>}
                </header>
                <div className="prose prose-invert max-w-none space-y-6 text-white/85 leading-loose">
                    {children}
                </div>
                <footer className="mt-14 border-t border-white/10 pt-6 flex flex-wrap gap-4 text-sm">
                    <Link to="/legal/terms" className="text-white/60 hover:text-[#D1795F] transition">شروط الاستخدام</Link>
                    <Link to="/legal/privacy" className="text-white/60 hover:text-[#D1795F] transition">سياسة الخصوصية</Link>
                    <Link to="/legal/refund" className="text-white/60 hover:text-[#D1795F] transition">سياسة الاسترداد</Link>
                </footer>
            </div>
        </div>
    );
}

export function LegalSection({ id, title, children }) {
    return (
        <section id={id} className="scroll-mt-20">
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-white mb-3">{title}</h2>
            <div className="text-white/80 font-body leading-loose space-y-3">{children}</div>
        </section>
    );
}
