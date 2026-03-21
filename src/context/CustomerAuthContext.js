import React, { createContext, useContext, useState, useEffect } from 'react';

const CustomerAuthContext = createContext(undefined);

export const CustomerAuthProvider = ({ children }) => {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('tasteza_customer');
    if (saved) {
      try { setCustomer(JSON.parse(saved)); } catch { }
    }
    setLoading(false);
  }, []);

  const login = (data) => {
    setCustomer(data);
    localStorage.setItem('tasteza_customer', JSON.stringify(data));
  };

  const logout = () => {
    setCustomer(null);
    localStorage.removeItem('tasteza_customer');
  };

  return (
    <CustomerAuthContext.Provider value={{ customer, login, logout, loading, isLoggedIn: !!customer }}>
      {children}
    </CustomerAuthContext.Provider>
  );
};

export const useCustomerAuth = () => {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  return ctx;
};
