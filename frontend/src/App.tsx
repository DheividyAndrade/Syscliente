import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuthContext } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { MainLayout } from './components/layout/MainLayout';
import { LoginPage } from './pages/Login';
import { DashboardHome } from './pages/Dashboard';
import { DashboardPage } from './pages/DashboardPage';
import { ChamadosPage } from './pages/ChamadosPage';
import { AdminPage } from './pages/Admin';
import { WhatsAppSetupPage } from './pages/WhatsAppSetup';
import { ChatView } from './pages/ChatView';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <SocketProvider>
              <MainLayout />
            </SocketProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="whatsapp" element={<WhatsAppSetupPage />} />
        <Route path="chamados" element={<ChamadosPage />} />
        <Route path="conversations/:id" element={<ChatView />} />
        <Route path="dashboard" element={<DashboardPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
