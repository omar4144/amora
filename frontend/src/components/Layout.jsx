import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, Compass, PlusSquare, Briefcase, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const NavItem = ({ to, icon: Icon, label, testId }) => (
    <NavLink
        to={to}
        data-testid={testId}
        className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 w-full h-full transition-colors ${
                isActive ? "text-[#E3FF00]" : "text-neutral-400 hover:text-white"
            }`
        }
    >
        <Icon className="w-6 h-6" strokeWidth={2.2} />
        <span className="text-[10px] font-body">{label}</span>
    </NavLink>
);

export default function Layout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isFeed = location.pathname === "/feed";

    const goProfile = () => {
        if (!user) return navigate("/auth");
        navigate(`/u/${user.username}`);
    };

    return (
        <div className="w-full max-w-md mx-auto min-h-[100dvh] relative bg-black text-white overflow-hidden font-body">
            <main className={isFeed ? "h-[100dvh]" : "min-h-[100dvh] pb-20"}>
                <Outlet />
            </main>

            {/* Bottom Nav */}
            <nav
                data-testid="bottom-nav"
                className="fixed bottom-0 inset-x-0 mx-auto max-w-md bg-black/95 backdrop-blur-xl border-t border-white/10 flex justify-around items-center h-16 z-50"
            >
                <NavItem to="/feed" icon={Home} label="الرئيسية" testId="nav-home" />
                <NavItem to="/marketplace" icon={Briefcase} label="السوق" testId="nav-marketplace" />
                <NavItem to="/upload" icon={PlusSquare} label="نشر" testId="nav-upload" />
                <NavItem to="/explore" icon={Compass} label="اكتشف" testId="nav-explore" />
                <button
                    data-testid="nav-profile"
                    onClick={goProfile}
                    className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-colors ${
                        location.pathname.startsWith("/u/") || location.pathname.startsWith("/profile")
                            ? "text-[#E3FF00]"
                            : "text-neutral-400 hover:text-white"
                    }`}
                >
                    <User className="w-6 h-6" strokeWidth={2.2} />
                    <span className="text-[10px] font-body">حسابي</span>
                </button>
            </nav>
        </div>
    );
}
