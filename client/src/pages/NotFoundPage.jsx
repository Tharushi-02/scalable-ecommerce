import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <section>
      <h1>Page not found</h1>
      <p className="muted">There's nothing at this address.</p>
      <Link to="/">← Back to the shop</Link>
    </section>
  );
}