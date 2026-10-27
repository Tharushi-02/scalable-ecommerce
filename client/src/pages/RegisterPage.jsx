import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { useAuthStore } from '../stores/authStore.js';

export default function RegisterPage() {
  const register = useAuthStore((s) => s.register);
  const status = useAuthStore((s) => s.status);
  const location = useLocation();
  const from = location.state?.from ?? '/';

  const [error, setError] = useState(null); // general message
  const [fieldErrors, setFieldErrors] = useState({}); // { email: '...', password: '...' }
  const [submitting, setSubmitting] = useState(false);

  // Logged in (just now, or already): go back to where you came from
  if (status === 'authenticated') {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = form.get('name');
    const email = form.get('email');
    const password = form.get('password');

    setError(null);
    setFieldErrors({});

    // Checked in the browser: the API never sees the confirmation box
    if (password !== form.get('confirmPassword')) {
      setFieldErrors({ confirmPassword: "Passwords don't match" });
      return;
    }

    setSubmitting(true);
    try {
      await register(name, email, password);
      // status becomes 'authenticated' → the check above redirects
    } catch (err) {
      if (err.status === 400 && err.details) {
        // "body.email" → "email", so each message goes under its own box
        setFieldErrors(
          Object.fromEntries(err.details.map((d) => [d.field.replace('body.', ''), d.message])),
        );
      } else {
        setError(err.message); // e.g. 409 "Email is already registered"
      }
      setSubmitting(false);
    }
  }

  return (
    <section className="card form-card">
      <h1>Create an account</h1>

      <form onSubmit={handleSubmit} className="form">
        <label className="field">
          <span>Name</span>
          <input name="name" autoComplete="name" required maxLength={100} />
          {fieldErrors.name && <small className="error">{fieldErrors.name}</small>}
        </label>

        <label className="field">
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" required maxLength={255} />
          {fieldErrors.email && <small className="error">{fieldErrors.email}</small>}
        </label>

        <label className="field">
          <span>Password</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
          />
          <small className="muted">At least 8 characters</small>
          {fieldErrors.password && <small className="error">{fieldErrors.password}</small>}
        </label>

        <label className="field">
          <span>Confirm password</span>
          <input name="confirmPassword" type="password" autoComplete="new-password" required />
          {fieldErrors.confirmPassword && (
            <small className="error">{fieldErrors.confirmPassword}</small>
          )}
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="button" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="small">
        Already have an account?{' '}
        <Link to="/login" state={{ from }}>
          Log in
        </Link>
      </p>
    </section>
  );
}