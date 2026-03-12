import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { queueGetAll, queueRemove, queueCount } from '../offlineQueue';

const Ctx = createContext(null);

export function OfflineProvider({ children }) {
  const [isOnline,     setIsOnline]     = useState(navigator.onLine);
  const [pending,      setPending]      = useState(0);
  const [syncing,      setSyncing]      = useState(false);
  const [lastSync,     setLastSync]     = useState(null);
  const flushLock = useRef(false);

  const refreshPending = useCallback(async () => {
    try { setPending(await queueCount()); } catch {}
  }, []);

  // ── Flush queue to server ──────────────────────────────
  const flush = useCallback(async () => {
    if (flushLock.current) return 0;
    flushLock.current = true;
    setSyncing(true);
    let synced = 0;
    try {
      const items = await queueGetAll();
      if (!items.length) return 0;

      const token = localStorage.getItem('tasteza_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      for (const item of items) {
        try {
          const r = await fetch(item.url, {
            method: item.method,
            headers,
            body: item.body ? JSON.stringify(item.body) : undefined,
          });
          // Accept 2xx or 409 (duplicate — already synced)
          if (r.ok || r.status === 409 || r.status === 201) {
            await queueRemove(item.id);
            synced++;
          }
        } catch {
          break; // still offline — stop
        }
      }

      if (synced > 0) {
        setLastSync(new Date());
        window.dispatchEvent(new Event('tasteza-synced'));
      }
    } finally {
      flushLock.current = false;
      setSyncing(false);
      await refreshPending();
    }
    return synced;
  }, [refreshPending]);

  // ── Network events ─────────────────────────────────────
  useEffect(() => {
    const goOnline  = () => { setIsOnline(true);  setTimeout(flush, 800); };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [flush]);

  // ── SW tells app to flush ──────────────────────────────
  useEffect(() => {
    const onMsg = e => { if (e.data?.type === 'DO_FLUSH') flush(); };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg);
  }, [flush]);

  // ── Queue updated by api layer ─────────────────────────
  useEffect(() => {
    window.addEventListener('tasteza-queued', refreshPending);
    return () => window.removeEventListener('tasteza-queued', refreshPending);
  }, [refreshPending]);

  // ── Periodic retry while online with pending items ─────
  useEffect(() => {
    if (!isOnline || pending === 0) return;
    const t = setTimeout(flush, 10000); // retry every 10s
    return () => clearTimeout(t);
  }, [isOnline, pending, flush]);

  useEffect(() => { refreshPending(); }, [refreshPending]);

  return (
    <Ctx.Provider value={{ isOnline, pending, syncing, lastSync, flush, refreshPending }}>
      {children}
    </Ctx.Provider>
  );
}

export const useOffline = () => useContext(Ctx);
