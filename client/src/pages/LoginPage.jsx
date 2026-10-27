import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { useAuthStore } from '../stores/authStore.js';

export default function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const status = useAuthStore((s) => s.status);
  const location = useLocation();
  const from = location.state?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Logged in (already, or just now): go back to where you came from
  if (status === 'authenticated') {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault(); // stop the browser's own full-page form submit
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      // No navigate() needed: status becomes 'authenticated', and the check above redirects
    } catch (err) {
      setError(err.status === 400 ? 'Please enter a valid email and password.' : err.message);
      setSubmitting(false);
    }
  }

  return (
    <section className="card form-card">
      <h1>Log in</h1>

      <form onSubmit={handleSubmit} className="form">
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="button" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="small">
        New here?{' '}
        <Link to="/register" state={{ from }}>
          Create an account
        </Link>
      </p>

      <p className="muted small">
        Demo accounts: customer1@example.com or admin@example.com, password Password123!
      </p>
    </section>
  );
}