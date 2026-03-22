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

// Replace the SWRegistrar function in your src/App.js with this:

function SWRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(reg => {
        // Poll for SW updates every 60s
        setInterval(() => reg.update(), 60_000);

        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          sw?.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              // New SW installed — tell it to activate immediately
              sw.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(e => console.warn('[SW] Registration failed:', e));

    // When SW activates (after SKIP_WAITING), reload the page
    // so the new JS/CSS chunks are loaded fresh — prevents 404 chunk errors
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    // Listen for SW_UPDATED message from the new service worker
    // The new SW sends this after wiping old caches on activate
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'SW_UPDATED' && !refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    // On first load, clear any stale caches from the browser side too
    // This handles cases where SW hasn't activated yet
    if ('caches' in window) {
      caches.keys().then(keys => {
        keys.forEach(key => {
          // Delete any cache that is not the current known versions
          if (!key.includes('-v4')) {
            caches.delete(key);
          }
        });
      });
    }
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
