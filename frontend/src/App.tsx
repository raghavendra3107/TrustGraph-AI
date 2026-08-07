import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AlertProvider } from './context/AlertContext';
import { Sidebar } from './components/Sidebar';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Transactions } from './pages/Transactions';
import { Appeals } from './pages/Appeals';
import { Admin } from './pages/Admin';

// Component to protect routes requiring authentication
const ProtectedLayout: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-xs text-slate-500 font-mono">
        Initializing TrustGraph sessions...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-900/10">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/appeals" element={<Appeals />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AlertProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<ProtectedLayout />} />
          </Routes>
        </AlertProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};
export default App;
