import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "sonner";
import "@/App.css";

import Layout from "@/components/Layout";
import Feed from "@/pages/Feed";
import Auth from "@/pages/Auth";
import Upload from "@/pages/Upload";
import Profile from "@/pages/Profile";
import Explore from "@/pages/Explore";
import Orders from "@/pages/Orders";
import ServiceDetail from "@/pages/ServiceDetail";
import EditProfile from "@/pages/EditProfile";
import Search from "@/pages/Search";
import Notifications from "@/pages/Notifications";
import Messages from "@/pages/Messages";
import Chat from "@/pages/Chat";
import Marketplace from "@/pages/Marketplace";
import MarketplaceDetail from "@/pages/MarketplaceDetail";
import Communities from "@/pages/Communities";
import CommunityDetail from "@/pages/CommunityDetail";
import Teams from "@/pages/Teams";
import TeamDetail from "@/pages/TeamDetail";
import Incubator from "@/pages/Incubator";
import AIAssistant from "@/pages/AIAssistant";
import Events from "@/pages/Events";

const Protected = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading)
        return (
            <div className="min-h-screen bg-black flex items-center justify-center text-white">
                جارٍ التحميل...
            </div>
        );
    if (!user) return <Navigate to="/auth" replace />;
    return children;
};

function App() {
    return (
        <div className="App">
            <BrowserRouter>
                <AuthProvider>
                    <Toaster position="top-center" theme="dark" richColors />
                    <Routes>
                        <Route element={<Layout />}>
                            <Route path="/" element={<Feed />} />
                            <Route path="/explore" element={<Explore />} />
                            <Route path="/upload" element={<Protected><Upload /></Protected>} />
                            <Route path="/orders" element={<Protected><Orders /></Protected>} />
                            <Route path="/profile/edit" element={<Protected><EditProfile /></Protected>} />
                            <Route path="/u/:username" element={<Profile />} />
                            <Route path="/service/:id" element={<ServiceDetail />} />
                            <Route path="/search" element={<Search />} />
                            <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
                            <Route path="/messages" element={<Protected><Messages /></Protected>} />
                            <Route path="/messages/:username" element={<Protected><Chat /></Protected>} />
                            <Route path="/marketplace" element={<Marketplace />} />
                            <Route path="/marketplace/:id" element={<MarketplaceDetail />} />
                            <Route path="/communities" element={<Communities />} />
                            <Route path="/communities/:slug" element={<CommunityDetail />} />
                            <Route path="/teams" element={<Teams />} />
                            <Route path="/teams/:id" element={<TeamDetail />} />
                            <Route path="/incubator" element={<Protected><Incubator /></Protected>} />
                            <Route path="/ai" element={<Protected><AIAssistant /></Protected>} />
                            <Route path="/events" element={<Events />} />
                        </Route>
                        <Route path="/auth" element={<Auth />} />
                    </Routes>
                </AuthProvider>
            </BrowserRouter>
        </div>
    );
}

export default App;
