import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "sonner";
import "@/App.css";

import Layout from "@/components/Layout";
import Landing from "@/pages/Landing";
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
import CRMShell from "@/pages/crm/CRMShell";
import CRMDashboard from "@/pages/crm/CRMDashboard";
import CRMClients from "@/pages/crm/CRMClients";
import CRMClientDetail from "@/pages/crm/CRMClientDetail";
import CRMDeals from "@/pages/crm/CRMDeals";
import CRMDealDetail from "@/pages/crm/CRMDealDetail";
import CRMActivities from "@/pages/crm/CRMActivities";
import Invoices from "@/pages/crm/Invoices";
import InvoiceDetail from "@/pages/crm/InvoiceDetail";
import Pricing from "@/pages/Pricing";
import Billing from "@/pages/Billing";
import Onboarding from "@/pages/Onboarding";
import BookingBrowse from "@/pages/booking/BookingBrowse";
import SpaceDetail from "@/pages/booking/SpaceDetail";
import { MySpaces, MyBookings, BookingSuccess } from "@/pages/booking/BookingDashboard";
import { DisputesList, DisputeDetail } from "@/pages/disputes/Disputes";
import { RealtimeProvider } from "@/context/RealtimeContext";
import ContentShell from "@/pages/content/ContentShell";
import ContentDashboard from "@/pages/content/ContentDashboard";
import ContentKanban from "@/pages/content/ContentKanban";
import ContentCalendar from "@/pages/content/ContentCalendar";
import ContentDetail from "@/pages/content/ContentDetail";
import ContentAI from "@/pages/content/ContentAI";
import TasksShell from "@/pages/tasks/TasksShell";
import TasksDashboard from "@/pages/tasks/TasksDashboard";
import TasksBoards from "@/pages/tasks/TasksBoards";
import TasksBoard from "@/pages/tasks/TasksBoard";
import TasksMy from "@/pages/tasks/TasksMy";
import TaskDetail from "@/pages/tasks/TaskDetail";
import AdminShell from "@/pages/admin/AdminShell";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminAudit from "@/pages/admin/AdminAudit";
import AdminLeads from "@/pages/admin/AdminLeads";
import AdminReports from "@/pages/admin/AdminReports";
import Terms from "@/pages/legal/Terms";
import Privacy from "@/pages/legal/Privacy";
import Refund from "@/pages/legal/Refund";
import Wallet from "@/pages/Wallet";
import Workspace from "@/pages/Workspace";

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
                    <RealtimeProvider>
                    <Toaster position="top-center" theme="dark" richColors />
                    <Routes>
                        {/* Public agency landing page — full-width, no mobile Layout */}
                        <Route path="/" element={<Landing />} />
                        <Route path="/auth" element={<Auth />} />
                        <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />

                        {/* Legal pages — public, full-width */}
                        <Route path="/legal/terms" element={<Terms />} />
                        <Route path="/legal/privacy" element={<Privacy />} />
                        <Route path="/legal/refund" element={<Refund />} />

                        {/* App routes with mobile Layout */}
                        <Route element={<Layout />}>
                            <Route path="/workspace" element={<Protected><Workspace /></Protected>} />
                            <Route path="/feed" element={<Feed />} />
                            <Route path="/explore" element={<Explore />} />
                            <Route path="/upload" element={<Protected><Upload /></Protected>} />
                            <Route path="/orders" element={<Protected><Orders /></Protected>} />
                            <Route path="/wallet" element={<Protected><Wallet /></Protected>} />
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

                            {/* CRM (Business Engine) */}
                            <Route path="/crm" element={<Protected><CRMShell /></Protected>}>
                                <Route index element={<CRMDashboard />} />
                                <Route path="clients" element={<CRMClients />} />
                                <Route path="clients/:id" element={<CRMClientDetail />} />
                                <Route path="deals" element={<CRMDeals />} />
                                <Route path="deals/:id" element={<CRMDealDetail />} />
                                <Route path="activities" element={<CRMActivities />} />
                                <Route path="invoices" element={<Invoices />} />
                                <Route path="invoices/:id" element={<InvoiceDetail />} />
                            </Route>

                            {/* Billing */}
                            <Route path="/pricing" element={<Protected><Pricing /></Protected>} />
                            <Route path="/billing" element={<Protected><Billing /></Protected>} />

                            {/* Content OS Engine */}
                            <Route path="/content" element={<Protected><ContentShell /></Protected>}>
                                <Route index element={<ContentDashboard />} />
                                <Route path="kanban" element={<ContentKanban />} />
                                <Route path="calendar" element={<ContentCalendar />} />
                                <Route path="ai" element={<ContentAI />} />
                            </Route>
                            <Route path="/content/item/:id" element={<Protected><ContentDetail /></Protected>} />

                            {/* Tasks Engine */}
                            <Route path="/tasks" element={<Protected><TasksShell /></Protected>}>
                                <Route index element={<TasksDashboard />} />
                                <Route path="boards" element={<TasksBoards />} />
                                <Route path="my" element={<TasksMy />} />
                            </Route>
                            <Route path="/tasks/board/:id" element={<Protected><TasksBoard /></Protected>} />
                            <Route path="/tasks/task/:id" element={<Protected><TaskDetail /></Protected>} />

                            {/* Admin (RBAC gated) */}
                            <Route path="/admin" element={<Protected><AdminShell /></Protected>}>
                                <Route index element={<AdminDashboard />} />
                                <Route path="users" element={<AdminUsers />} />
                                <Route path="leads" element={<AdminLeads />} />
                                <Route path="reports" element={<AdminReports />} />
                                <Route path="audit" element={<AdminAudit />} />
                            </Route>

                            {/* Booking Engine — Digital Twin */}
                            <Route path="/booking" element={<BookingBrowse />} />
                            <Route path="/booking/spaces/:id" element={<Protected><SpaceDetail /></Protected>} />
                            <Route path="/booking/my-spaces" element={<Protected><MySpaces /></Protected>} />
                            <Route path="/booking/my-bookings" element={<Protected><MyBookings /></Protected>} />
                            <Route path="/booking/success" element={<Protected><BookingSuccess /></Protected>} />

                            {/* Disputes */}
                            <Route path="/disputes" element={<Protected><DisputesList /></Protected>} />
                            <Route path="/disputes/:id" element={<Protected><DisputeDetail /></Protected>} />
                        </Route>
                    </Routes>
                    </RealtimeProvider>
                </AuthProvider>
            </BrowserRouter>
        </div>
    );
}

export default App;
