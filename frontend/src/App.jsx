import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import { ProtectedRoute, GuestRoute } from './components/auth/ProtectedRoute';
import Home from './pages/Home';
const DesignSystem = lazy(() => import('./pages/DesignSystem'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DashboardLayout = lazy(() => import('./components/dashboard/DashboardLayout'));
import Properties from './pages/Properties';
import PropertyDetail from './pages/PropertyDetail';
const MyProperties = lazy(() => import('./pages/dashboard/MyProperties'));
const AddProperty = lazy(() => import('./pages/dashboard/AddProperty'));
const EditProperty = lazy(() => import('./pages/dashboard/EditProperty'));
const Favorites = lazy(() => import('./pages/dashboard/Favorites'));
const Inquiries = lazy(() => import('./pages/dashboard/Inquiries'));
const InquiryThread = lazy(() => import('./pages/dashboard/InquiryThread'));
const Appointments = lazy(() => import('./pages/dashboard/Appointments'));
const Profile = lazy(() => import('./pages/dashboard/Profile'));
const Verification = lazy(() => import('./pages/dashboard/Verification'));
const Notifications = lazy(() => import('./pages/dashboard/Notifications'));
const Settings = lazy(() => import('./pages/dashboard/Settings'));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const AdminOverview = lazy(() => import('./pages/admin/Overview'));
const AdminListings = lazy(() => import('./pages/admin/Listings'));
const AdminModeration = lazy(() => import('./pages/admin/Moderation'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminReports = lazy(() => import('./pages/admin/Reports'));
const AdminVerifications = lazy(() => import('./pages/admin/Verifications'));
const AdminCategories = lazy(() => import('./pages/admin/Categories'));
const AdminAuditLog = lazy(() => import('./pages/admin/AuditLog'));
const Agents = lazy(() => import('./pages/Agents'));
const AgentProfile = lazy(() => import('./pages/AgentProfile'));
import NotFound from './pages/NotFound';
import Skeleton from './components/common/Skeleton';

// Shown for a moment while a page's code is downloaded.
const PageFallback = () => <div className="container-page py-12" role="status" aria-label="Loading page"><Skeleton className="h-9 w-64" /><Skeleton className="mt-6 h-64 w-full" /></div>;
const Privacy = lazy(() => import('./pages/static/Privacy'));
const Terms = lazy(() => import('./pages/static/Terms'));
const Safety = lazy(() => import('./pages/static/Safety'));
const Support = lazy(() => import('./pages/static/Support'));

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<Home />} />
        {import.meta.env.DEV && <Route path="design" element={<DesignSystem />} />}
        <Route path="properties" element={<Properties />} />
        <Route path="properties/:slug" element={<PropertyDetail />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
        <Route path="safety" element={<Safety />} />
        <Route path="support" element={<Support />} />
        <Route path="agents" element={<Agents />} />
        <Route path="agents/:id" element={<AgentProfile />} />

        <Route element={<GuestRoute />}>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
        </Route>
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="verify-email" element={<VerifyEmail />} />

        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="favorites" element={<Favorites />} />
            <Route path="inquiries" element={<Inquiries />} />
            <Route path="inquiries/:id" element={<InquiryThread />} />
            <Route path="appointments" element={<Appointments />} />
            <Route path="profile" element={<Profile />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<Settings />} />
            <Route element={<ProtectedRoute roles={['owner', 'agent']} />}>
              <Route path="verification" element={<Verification />} />
            </Route>
            <Route element={<ProtectedRoute roles={['owner', 'agent', 'admin']} />}>
              <Route path="properties" element={<MyProperties />} />
              <Route path="properties/new" element={<AddProperty />} />
              <Route path="properties/:id/edit" element={<EditProperty />} />
            </Route>
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="moderation" element={<AdminModeration />} />
            <Route path="properties" element={<AdminListings />} />
            <Route path="properties/new" element={<AddProperty basePath="/admin/properties" admin />} />
            <Route path="properties/:id/edit" element={<EditProperty basePath="/admin/properties" admin />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="verifications" element={<AdminVerifications />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="audit-log" element={<AdminAuditLog />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
    </Suspense>
  );
}
