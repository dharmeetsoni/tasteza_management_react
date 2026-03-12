import React, { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('tasteza_token');
    if (!token) { setLoading(false); return; }

    // Try to fetch user profile
    getMe()
      .then(d => {
        if (d.success) {
          setUser(d.data);
          // Cache user for offline auth
          localStorage.setItem('tasteza_user', JSON.stringify(d.data));
        } else {
          // Explicit auth failure — clear token
          localStorage.removeItem('tasteza_token');
          localStorage.removeItem('tasteza_user');
        }
      })
      .catch(() => {
        // Network error (server unreachable) — use cached user if available
        const cached = localStorage.getItem('tasteza_user');
        if (cached) {
          try { setUser(JSON.parse(cached)); } catch {}
        } else {
          localStorage.removeItem('tasteza_token');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = (token, userData) => {
    localStorage.setItem('tasteza_token', token);
    localStorage.setItem('tasteza_user', JSON.stringify(userData));
    setUser(userData);
  };

  const signOut = () => {
    localStorage.removeItem('tasteza_token');
    localStorage.removeItem('tasteza_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
