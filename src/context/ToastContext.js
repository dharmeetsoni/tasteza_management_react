import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, type = 'ok') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => {
      setToasts(t => t.map(x => x.id === id ? { ...x, fade: true } : x));
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 400);
    }, 2600);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type} ${t.fade ? 'fade' : ''}`}>{t.msg}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
