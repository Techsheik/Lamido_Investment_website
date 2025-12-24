import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SidebarProvider } from "@/components/ui/sidebar";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import About from "./pages/About";
import Services from "./pages/Services";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Invest from "./pages/Invest";
import Investments from "./pages/Investments";
import Transactions from "./pages/Transactions";
import Withdraw from "./pages/Withdraw";
import Deposit from "./pages/Deposit";
import Payment from "./pages/Payment";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminInvestments from "./pages/admin/AdminInvestments";
import AdminTransactions from "./pages/admin/AdminTransactions";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminProfile from "./pages/admin/AdminProfile";
import AdminPlanBuilder from "./pages/admin/AdminPlanBuilder";
import AdminInvestorManagement from "./pages/admin/AdminInvestorManagement";
import AdminAnnouncements from "./pages/admin/AdminAnnouncements";
import AdminManagement from "./pages/admin/AdminManagement";
import AdminTransactionProofs from "./pages/admin/AdminTransactionProofs";
import AdminComplaints from "./pages/admin/AdminComplaints";
import Announcements from "./pages/Announcements";
import Complaints from "./pages/Complaints";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <SidebarProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/about" element={<About />} />
              <Route path="/services" element={<Services />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/invest" element={<Invest />} />
              <Route path="/investments" element={<Investments />} />
              <Route path="/deposit" element={<Deposit />} />
              <Route path="/withdraw" element={<Withdraw />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/payment" element={<Payment />} />
              <Route path="/announcements" element={<Announcements />} />
              <Route path="/complaints" element={<Complaints />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/investments" element={<AdminInvestments />} />
              <Route path="/admin/transactions" element={<AdminTransactions />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
              <Route path="/admin/profile" element={<AdminProfile />} />
              <Route path="/admin/plan-builder" element={<AdminPlanBuilder />} />
              <Route path="/admin/investor-management" element={<AdminInvestorManagement />} />
              <Route path="/admin/announcements" element={<AdminAnnouncements />} />
              <Route path="/admin/management" element={<AdminManagement />} />
              <Route path="/admin/transaction-proofs" element={<AdminTransactionProofs />} />
              <Route path="/admin/complaints" element={<AdminComplaints />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </SidebarProvider>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
