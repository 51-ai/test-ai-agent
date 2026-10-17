import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Chat from './components/Chat';
import AdminDashboard from './components/AdminDashboard';
import AISecurityAnalyst from './components/AISecurityAnalyst';
import DeveloperDashboard from './components/DeveloperDashboard';
import { authAPI } from './services/api';
import { useLanguage } from './i18n/LanguageContext';

export default function App() {
  const { t } = useLanguage();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authAPI.getMe()
        .then(() => {
          setIsLoggedIn(true);
        })
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsLoggedIn(false);
  };

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
        element={isLoggedIn ? <Chat onLogout={handleLogout} /> : <Navigate to="/login" />}
      />
      <Route path="/admin" element={isLoggedIn ? <AdminDashboard /> : <Navigate to="/login" />} />
      <Route path="/admin/security" element={isLoggedIn ? <AISecurityAnalyst /> : <Navigate to="/login" />} />
      <Route path="/dev" element={isLoggedIn ? <DeveloperDashboard /> : <Navigate to="/login" />} />
      <Route path="*" element={<Navigate to={isLoggedIn ? "/chat" : "/login"} />} />
    </Routes>
  );
}