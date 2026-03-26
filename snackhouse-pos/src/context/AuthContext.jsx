import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const SESSION_EMPLOYEE_KEY = 'employee';
const SESSION_TOKEN_KEY = 'token';
const INACTIVITY_MS = 30 * 60 * 1000;

export const AuthProvider = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState(null);
  const [token, setToken] = useState(null);
  const [lastActiveAt, setLastActiveAt] = useState(Date.now());

  useEffect(() => {
    const storedEmployee = localStorage.getItem(SESSION_EMPLOYEE_KEY);
    const storedToken = localStorage.getItem(SESSION_TOKEN_KEY);
    if (storedEmployee && storedToken) {
      setEmployee(JSON.parse(storedEmployee));
      setToken(storedToken);
    }
    setLoading(false);
  }, []);

  const logout = () => {
    localStorage.removeItem(SESSION_EMPLOYEE_KEY);
    localStorage.removeItem(SESSION_TOKEN_KEY);
    setEmployee(null);
    setToken(null);
  };

  const login = async ({ username, password }) => {
    const res = await api.auth.login({ username, password });
    const { token: newToken, employee: emp } = res.data;
    localStorage.setItem(SESSION_TOKEN_KEY, newToken);
    localStorage.setItem(SESSION_EMPLOYEE_KEY, JSON.stringify(emp));
    setEmployee(emp);
    setToken(newToken);
    setLastActiveAt(Date.now());
  };

  // Inactivity auto-logout
  useEffect(() => {
    if (!employee) return undefined;

    const bump = () => setLastActiveAt(Date.now());
    const events = ['mousedown', 'touchstart', 'keydown', 'mousemove'];
    for (const e of events) window.addEventListener(e, bump, { passive: true });

    const interval = window.setInterval(() => {
      const elapsed = Date.now() - lastActiveAt;
      if (elapsed >= INACTIVITY_MS) logout();
    }, 1000);

    return () => {
      for (const e of events) window.removeEventListener(e, bump);
      window.clearInterval(interval);
    };
  }, [employee, lastActiveAt]);

  const value = useMemo(
    () => ({
      employee,
      token,
      loading,
      lastActiveAt,
      login,
      logout
    }),
    [employee, token, loading, lastActiveAt]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

