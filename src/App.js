import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { WSProvider } from './context/WSContext';
import { OfflineProvider } from './context/OfflineContext';
import LoginPage from './components/pages/LoginPage';
import AppShell from './components/layout/AppShell';
import OfflineBanner from './components/ui/OfflineBanner';

function AppRouter() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center',
                  justifyContent:'center', fontSize:18, color:'var(--ink2)' }}>
      🍽️ Loading Tasteza…
    </div>
  );
  return user ? <AppShell /> : <LoginPage />;
}

function SWRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Register service worker
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('[SW] Registered, scope:', reg.scope);
        // Check for updates every 60s
        setInterval(() => reg.update(), 60_000);
        // When a new SW is waiting, activate it
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

    // Reload once new SW has taken control
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) { refreshing = true; window.location.reload(); }
    });
  }, []);
  return null;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <OfflineProvider>
          <WSProvider>
            <SWRegistrar />
            <AppRouter />
            <OfflineBanner />
          </WSProvider>
        </OfflineProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
