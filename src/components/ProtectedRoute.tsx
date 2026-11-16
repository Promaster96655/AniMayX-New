import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingScreen } from './LoadingScreen';

export function ProtectedRoute({
  children,
  requireAdmin = false,
  requireSetupComplete = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireSetupComplete?: boolean;
}) {
  const { user, profile, isAdmin, authReady, profileLoading } = useAuth();
  const location = useLocation();

  if (!authReady || (user && profileLoading && !profile)) {
    return <LoadingScreen label="Loading your AniMayX session" />;
  }

  if (!user) {
    return <Navigate to="/register" state={{ from: location.pathname }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-xl bg-[#121212] border border-white/10 p-6 text-center space-y-3">
          <h1 className="font-display text-xl font-bold text-white">Administrator Access Required</h1>
          <p className="text-sm text-[#A0A0A0]">
            Your account does not hold verified administrator permissions for this section.
          </p>
        </div>
      </div>
    );
  }

  if (requireSetupComplete && !profile?.setupCompleted) {
    return <Navigate to="/setup-profile" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
