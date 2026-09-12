import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
// Auth pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
// App pages
import Home from '@/pages/Home';
import AgentWorkspace from '@/pages/AgentWorkspace';
import SupervisorWorkspace from '@/pages/SupervisorWorkspace';
import Leads from '@/pages/Leads';
import LeadDetail from '@/pages/LeadDetail';
import Brands from '@/pages/Brands';
import Scripts from '@/pages/Scripts';
import QualificationForms from '@/pages/QualificationForms';
import RoutingRules from '@/pages/RoutingRules';
import Appointments from '@/pages/Appointments';
import PhoneNumbers from '@/pages/PhoneNumbers';
import BusinessOwners from '@/pages/BusinessOwners';
import AuditLog from '@/pages/AuditLog';
import Settings from '@/pages/Settings';
import Campaigns from '@/pages/Campaigns';
import LeadSources from '@/pages/LeadSources';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/workspace" element={<AgentWorkspace />} />
          <Route path="/supervisor" element={<SupervisorWorkspace />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/leads/:id" element={<LeadDetail />} />
          <Route path="/brands" element={<Brands />} />
          <Route path="/scripts" element={<Scripts />} />
          <Route path="/qualification-forms" element={<QualificationForms />} />
          <Route path="/routing-rules" element={<RoutingRules />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/phone-numbers" element={<PhoneNumbers />} />
          <Route path="/business-owners" element={<BusinessOwners />} />
          <Route path="/audit-log" element={<AuditLog />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/lead-sources" element={<LeadSources />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App