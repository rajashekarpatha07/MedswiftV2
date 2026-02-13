import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';

// Pages
import LandingPage from './pages/LandingPage';
import UserLogin from './pages/user/UserLogin';
import UserRegister from './pages/user/UserRegister';
import UserDashboard from './pages/user/UserDashboard';
import AmbulanceLogin from './pages/ambulance/AmbulanceLogin';
import AmbulanceDashboard from './pages/ambulance/AmbulanceDashboard';
import HospitalLogin from './pages/hospital/HospitalLogin';
import HospitalDashboard from './pages/hospital/HospitalDashboard';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';

import './App.css';

// Protected Route Component
function ProtectedRoute({ children, allowedRole }) {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (allowedRole && role !== allowedRole) {
    // Redirect to appropriate dashboard
    return <Navigate to={`/${role}/dashboard`} replace />;
  }

  return children;
}

// Public Route - Redirect if already authenticated
function PublicRoute({ children }) {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (isAuthenticated && role) {
    return <Navigate to={`/${role}/dashboard`} replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={
        <PublicRoute><LandingPage /></PublicRoute>
      } />

      {/* User Routes */}
      <Route path="/user/login" element={
        <PublicRoute><UserLogin /></PublicRoute>
      } />
      <Route path="/user/register" element={
        <PublicRoute><UserRegister /></PublicRoute>
      } />
      <Route path="/user/dashboard" element={
        <ProtectedRoute allowedRole="user"><UserDashboard /></ProtectedRoute>
      } />

      {/* Ambulance Routes */}
      <Route path="/ambulance/login" element={
        <PublicRoute><AmbulanceLogin /></PublicRoute>
      } />
      <Route path="/ambulance/dashboard" element={
        <ProtectedRoute allowedRole="ambulance"><AmbulanceDashboard /></ProtectedRoute>
      } />

      {/* Hospital Routes */}
      <Route path="/hospital/login" element={
        <PublicRoute><HospitalLogin /></PublicRoute>
      } />
      <Route path="/hospital/dashboard" element={
        <ProtectedRoute allowedRole="hospital"><HospitalDashboard /></ProtectedRoute>
      } />

      {/* Admin Routes */}
      <Route path="/admin/login" element={
        <PublicRoute><AdminLogin /></PublicRoute>
      } />
      <Route path="/admin/dashboard" element={
        <ProtectedRoute allowedRole="admin"><AdminDashboard /></ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <div className="app">
            <AppRoutes />
          </div>
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
