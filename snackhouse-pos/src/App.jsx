import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import POS from './pages/POS';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Menu from './pages/Menu';
import Users from './pages/Users';
import OrderHistory from './pages/OrderHistory';

const RequireAuth = ({ children, roles }) => {
  const { employee, loading } = useAuth();
  if (loading) return null;
  if (!employee) return <Navigate to="/" replace />;
  if (roles && roles.length > 0 && !roles.includes(employee.role)) return <Navigate to="/pos" replace />;
  return children;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Login />} />
    <Route
      path="/pos"
      element={
        <RequireAuth roles={['cashier', 'manager']}>
          <POS />
        </RequireAuth>
      }
    />
    <Route
      path="/orders"
      element={
        <RequireAuth roles={['cashier', 'manager']}>
          <OrderHistory />
        </RequireAuth>
      }
    />
    <Route
      path="/dashboard"
      element={
        <RequireAuth roles={['manager']}>
          <Dashboard />
        </RequireAuth>
      }
    />
    <Route
      path="/inventory"
      element={
        <RequireAuth roles={['manager']}>
          <Inventory />
        </RequireAuth>
      }
    />
    <Route
      path="/menu"
      element={
        <RequireAuth roles={['manager']}>
          <Menu />
        </RequireAuth>
      }
    />
    <Route
      path="/users"
      element={
        <RequireAuth roles={['manager']}>
          <Users />
        </RequireAuth>
      }
    />
    <Route path="*" element={<Navigate to="/pos" replace />} />
  </Routes>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

