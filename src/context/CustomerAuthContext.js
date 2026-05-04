import React, { createContext, useContext, useState, useEffect } from 'react';

const CustomerAuthContext = createContext(undefined);

export const CustomerAuthProvider = ({ children }) => {
  const [customer, setCustomer] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedCustomer = localStorage.getItem('tasteza_customer');
    const savedToken = localStorage.getItem('tasteza_customer_token');
    if (savedCustomer) {
      try { setCustomer(JSON.parse(savedCustomer)); } catch { }
    }
    if (savedToken) setToken(savedToken);
    setLoading(false);
  }, []);

  const login = (data, jwtToken) => {
    setCustomer(data);
    localStorage.setItem('tasteza_customer', JSON.stringify(data));
    if (jwtToken) {
      setToken(jwtToken);
      localStorage.setItem('tasteza_customer_token', jwtToken);
    }
  };

  const logout = () => {
    setCustomer(null);
    setToken(null);
    localStorage.removeItem('tasteza_customer');
    localStorage.removeItem('tasteza_customer_token');
  };

  return (
    <CustomerAuthContext.Provider value={{ customer, token, login, logout, loading, isLoggedIn: !!customer && !customer.isGuest }}>
      {children}
    </CustomerAuthContext.Provider>
  );
};

export const useCustomerAuth = () => {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  return ctx;
};
