import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-teal-400 font-mono text-sm">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
          <span>Verifying Session & System Authorization...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user?.role) {
    const isAuthorized = allowedRoles.some(
      (r) => r.toUpperCase() === user.role.toUpperCase()
    );
    if (!isAuthorized) {
      const roleUpper = (user.role || '').toUpperCase();
      const redirectPath = roleUpper === 'ADMIN' 
        ? '/admin/dashboard' 
        : (roleUpper === 'PUBLIC' ? '/public/dashboard' : '/operator/dashboard');
      return <Navigate to={redirectPath} replace />;
    }
  }

  return children;
};
