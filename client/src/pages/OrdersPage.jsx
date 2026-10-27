import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api/client.js';
import Pagination from '../components/Pagination.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const PAGE_SIZE = 10;

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function OrdersPage() {
  const [searchParams] = useSearchParams();
  const page = searchParams.get('page') ?? '1';

  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    api(`/orders?page=${encodeURIComponent(page)}&limit=${PAGE_SIZE}`)
      .then((data) => {
        if (ignore) return;
        setResult(data);
        setError(null);
      })
      .catch((err) => {
        if (!ignore) setError(err.message);
      });
    return () => {
      ignore = true;
    };
  }, [page]);

  if (error) return <p className="error">{error}</p>;
  if (!result) return <p className="muted">Loading your orders…</p>;

  const { orders, pagination } = result;

  if (pagination.total === 0) {
    return (
      <section>
        <h1>Your orders</h1>
        <p className="muted">You haven't placed any orders yet.</p>
        <Link to="/" className="button">
          Start shopping
        </Link>
      </section>
    );
  }

  return (
    <section>
      <h1>Your orders</h1>
      <p className="muted">{pagination.total} orders</p>

      <ul className="order-list">
        {orders.map((order) => (
          <li key={order.id} className="order-row">
            <Link to={`/orders/${order.id}`} className="order-id">
              #{order.id}
            </Link>
            <span className="muted">{formatDate(order.createdAt)}</span>
            <span className="muted">
              {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
            </span>
            <span className="price-small">Rs. {order.totalAmount}</span>
            <StatusBadge status={order.status} />
            <span className="order-actions">
              {order.status === 'pending' && <Link to={`/orders/${order.id}/pay`}>Pay now</Link>}
              <Link to={`/orders/${order.id}`}>View</Link>
            </span>
          </li>
        ))}
      </ul>

      <Pagination page={pagination.page} totalPages={pagination.totalPages} />
    </section>
  );
}