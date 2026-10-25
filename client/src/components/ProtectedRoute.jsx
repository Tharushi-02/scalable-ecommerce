import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuthStore } from '../stores/authStore.js';

// Wraps pages that need a logged-in user
export default function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  // Still checking the saved session: don't decide yet
  if (status === 'loading') {
    return <p className="muted">Loading…</p>;
  }

  if (status === 'guest') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}