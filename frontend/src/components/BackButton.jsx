import { useNavigate, useLocation } from "react-router-dom";
import { ArrowRight } from "lucide-react";

/**
 * Universal back button — navigates to previous entry or a sensible fallback.
 * Hidden on top-level routes where the bottom nav already handles navigation.
 */
const HIDDEN_ON = new Set(["/", "/feed", "/workspace", "/explore", "/upload", "/auth", "/onboarding"]);

export default function BackButton({ fallback = -1, className = "", label = "رجوع" }) {
    const navigate = useNavigate();
    const location = useLocation();

    if (HIDDEN_ON.has(location.pathname)) return null;

    const go = () => {
        if (window.history.length > 1) navigate(-1);
        else if (typeof fallback === "string") navigate(fallback);
        else navigate("/feed");
    };

    return (
        <button
            data-testid="back-btn"
            onClick={go}
            aria-label={label}
            className={`inline-flex items-center gap-1 text-xs text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-3 py-1.5 transition ${className}`}
        >
            <ArrowRight className="w-3.5 h-3.5" />
            {label}
        </button>
    );
}
