import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Chat from './components/Chat';
import AdminDashboard from './components/AdminDashboard';
import AISecurityAnalyst from './components/AISecurityAnalyst';
import DeveloperDashboard from './components/DeveloperDashboard';
import { useLanguage } from './i18n/LanguageContext';
import { AuthProvider, useAuth } from './authContext';

function AppRoutes() {
  const { t } = useLanguage();
  const { isLoggedIn, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-500">{t.app.loading}</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isLoggedIn ? <Navigate to="/chat" /> : <Login />}
      />
      <Route
        path="/register"
        element={isLoggedIn ? <Navigate to="/chat" /> : <Register />}
      />
      <Route
        path="/chat"
        element={isLoggedIn ? <Chat onLogout={logout} /> : <Navigate to="/login" />}
      />
      <Route path="/admin" element={isLoggedIn ? <AdminDashboard /> : <Navigate to="/login" />} />
      <Route path="/admin/security" element={isLoggedIn ? <AISecurityAnalyst /> : <Navigate to="/login" />} />
      <Route path="/dev" element={isLoggedIn ? <DeveloperDashboard /> : <Navigate to="/login" />} />
      <Route path="*" element={<Navigate to={isLoggedIn ? "/chat" : "/login"} />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
