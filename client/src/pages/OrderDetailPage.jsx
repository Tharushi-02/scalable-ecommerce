import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';

function formatDateTime(isoString) {
  return new Date(isoString).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// The steps to show, using the order's timestamps
function timelineSteps(order) {
  const steps = [
    { label: 'Ordered', at: order.createdAt },
    { label: 'Paid', at: order.paidAt },
  ];
  if (order.status === 'cancelled') {
    steps.push({ label: 'Cancelled', at: order.cancelledAt });
  } else {
    steps.push({ label: 'Shipped', at: order.shippedAt });
    steps.push({ label: 'Delivered', at: order.deliveredAt });
  }
  return steps;
}

export default function OrderDetailPage() {
  const { id } = useParams();
  return <OrderDetail key={id} id={id} />;
}

function OrderDetail({ id }) {
  const [order, setOrder] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState(null); // { type, text }

  useEffect(() => {
    let ignore = false;
    api(`/orders/${id}`)
      .then((data) => {
        if (!ignore) setOrder(data.order);
      })
      .catch((err) => {
        if (!ignore) setLoadError(err.message);
      });
    return () => {
      ignore = true;
    };
  }, [id]);

  async function handleCancel() {
    const wasPaid = order.status === 'paid';
    const question = wasPaid
      ? 'Cancel this order? You will be refunded in full.'
      : 'Cancel this order?';
    if (!window.confirm(question)) return;

    setCancelling(true);
    setMessage(null);
    try {
      const { order: cancelled } = await api(`/orders/${id}/cancel`, { method: 'POST' });
      setOrder(cancelled);
      setMessage({
        type: 'success',
        text: wasPaid ? 'Order cancelled. Your refund is on its way.' : 'Order cancelled.',
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
      // e.g. it was shipped in the meantime: show the real status
      api(`/orders/${id}`)
        .then((data) => setOrder(data.order))
        .catch(() => {});
    } finally {
      setCancelling(false);
    }
  }

  if (loadError) {
    return (
      <section>
        <p className="error">{loadError}</p>
        <Link to="/orders">← My orders</Link>
      </section>
    );
  }

  if (!order) return <p className="muted">Loading your order…</p>;

  const canCancel = order.status === 'pending' || order.status === 'paid';

  return (
    <section>
      <Link to="/orders">← My orders</Link>

      <div className="page-title-row">
        <h1>Order #{order.id}</h1>
        <StatusBadge status={order.status} />
      </div>

      {message && <p className={message.type}>{message.text}</p>}

      <div className="cart-layout">
        <div className="card">
          <h2>Items</h2>
          {order.items.map((item) => (
            <div key={item.productId} className="summary-row">
              <span>
                <Link to={`/products/${item.productId}`}>{item.productName}</Link> ×{' '}
                {item.quantity}
                <span className="muted small"> (Rs. {item.unitPrice} each)</span>
              </span>
              <span>Rs. {item.lineTotal}</span>
            </div>
          ))}
          <div className="summary-row summary-total">
            <span>Total</span>
            <span>Rs. {order.totalAmount}</span>
          </div>

          <h2>Ship to</h2>
          <p className="muted">
            {order.shipping.name}
            <br />
            {order.shipping.line1}
            {order.shipping.line2 && (
              <>
                <br />
                {order.shipping.line2}
              </>
            )}
            <br />
            {order.shipping.city} {order.shipping.postalCode}
            <br />
            {order.shipping.country}
          </p>
        </div>

        <aside className="card cart-summary">
          <h2>Progress</h2>
          <ol className="timeline">
            {timelineSteps(order).map((step) => (
              <li key={step.label} className={step.at ? 'done' : undefined}>
                <span>{step.label}</span>
                <span className="muted small">{step.at ? formatDateTime(step.at) : '—'}</span>
              </li>
            ))}
          </ol>

          {order.status === 'pending' && (
            <Link to={`/orders/${order.id}/pay`} className="button">
              Pay now
            </Link>
          )}
          {canCancel && (
            <button
              type="button"
              className="link-button danger"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling…' : 'Cancel order'}
            </button>
          )}
        </aside>
      </div>
    </section>
  );
}