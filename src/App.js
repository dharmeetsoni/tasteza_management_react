import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { WSProvider } from './context/WSContext';
import { OfflineProvider } from './context/OfflineContext';
import LoginPage from './components/pages/LoginPage';
import AppShell from './components/layout/AppShell';
import OfflineBanner from './components/ui/OfflineBanner';
import PublicOrderApp from './pages/public/PublicOrderApp';

function AdminApp() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: 18, color: 'var(--ink2)'
    }}>
      🍽️ Loading Tasteza…
    </div>
  );
  return user ? <AppShell /> : <LoginPage />;
}

function SWRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(reg => {
        setInterval(() => reg.update(), 60_000);
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          sw?.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              sw.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(e => console.warn('[SW] Registration failed:', e));
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) { refreshing = true; window.location.reload(); }
    });
  }, []);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <OfflineProvider>
          <SWRegistrar />
          <Routes>
            {/* Public ordering — no auth required */}
            <Route path="/order/*" element={<PublicOrderApp />} />

            {/* Admin app — wrapped in auth/ws providers */}
            <Route
              path="/*"
              element={
                <AuthProvider>
                  <WSProvider>
                    <AdminApp />
                    <OfflineBanner />
                  </WSProvider>
                </AuthProvider>
              }
            />
          </Routes>
        </OfflineProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
