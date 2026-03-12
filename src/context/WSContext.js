import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

const WS_URL = `ws://${window.location.hostname}:3001/ws`;
const WSContext = createContext(null);

export function WSProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const wsRef       = useRef(null);
  const aliveRef    = useRef(true);
  const timerRef    = useRef(null);
  const handlersRef = useRef({});  // { type: Set<fn> }

  // Stable subscribe function — identity never changes
  const subscribe = useRef((type, fn) => {
    if (!handlersRef.current[type]) handlersRef.current[type] = new Set();
    handlersRef.current[type].add(fn);
    return () => handlersRef.current[type]?.delete(fn);
  }).current;

  useEffect(() => {
    aliveRef.current = true;

    function connect() {
      const tkn = localStorage.getItem('tasteza_token');
      if (!tkn || !aliveRef.current) return;
      if (wsRef.current && wsRef.current.readyState < 2) return;

      const sock = new WebSocket(`${WS_URL}?token=${encodeURIComponent(tkn)}`);
      wsRef.current = sock;

      sock.onopen = () => {
        if (!aliveRef.current) return sock.close();
        setConnected(true);
        // server auto-subscribes on URL-token auth, but send subscribe just in case
        setTimeout(() => {
          if (sock.readyState === WebSocket.OPEN) {
            sock.send(JSON.stringify({ type:'subscribe', rooms:['sales','kot','billing','dashboard'] }));
          }
        }, 150);
      };

      sock.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          handlersRef.current[msg.type]?.forEach(fn => { try { fn(msg.payload); } catch(ex) {} });
        } catch {}
      };

      sock.onclose = () => {
        if (!aliveRef.current) return;
        setConnected(false);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(connect, 3000);
      };

      sock.onerror = () => sock.close();
    }

    const t = setTimeout(connect, 500);

    return () => {
      aliveRef.current = false;
      clearTimeout(t);
      clearTimeout(timerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []); // mount once only

  return (
    <WSContext.Provider value={{ connected, subscribe }}>
      {children}
    </WSContext.Provider>
  );
}

// useWS — get connected status
export const useWS = () => useContext(WSContext) || { connected: false, subscribe: null };

// useWSEvent — subscribe to a WS event type inside any component
export function useWSEvent(type, handler) {
  const { subscribe } = useWS();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!subscribe) return;
    const stable = (payload) => handlerRef.current(payload);
    return subscribe(type, stable);
  }, [subscribe, type]); // subscribe is a stable ref, type is a string — safe deps
}
