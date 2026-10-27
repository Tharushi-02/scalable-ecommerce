import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../api/client.js';

export default function PayPage() {
  const { id } = useParams();
  return <PayOrder key={id} id={id} />;
}

function PayOrder({ id }) {
  const [order, setOrder] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [cardNumber, setCardNumber] = useState('');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(null);

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

  async function handlePay(event) {
    event.preventDefault();
    setPaying(true);
    setPayError(null);
    try {
      const { order: paidOrder } = await api(`/orders/${id}/pay`, {
        method: 'POST',
        body: { cardNumber },
      });
      setOrder(paidOrder); // status is now 'paid' → the confirmation screen shows
    } catch (err) {
      // 400 → our validation message; 402 → "Payment failed: Card declined"
      setPayError(err.details?.[0]?.message ?? err.message);
      // 409 → already paid or cancelled (e.g. in another tab): show the real status
      if (err.status === 409) {
        api(`/orders/${id}`)
          .then((data) => setOrder(data.order))
          .catch(() => {});
      }
    } finally {
      setPaying(false);
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

  return (
    <section>
      <div className="cart-layout">
        <div>
          {order.status === 'pending' && (
            <form className="card form" onSubmit={handlePay}>
              <h2>Pay for order #{order.id}</h2>

              <label className="field">
                <span>Card number</span>
                <input
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="4242 4242 4242 4242"
                  maxLength={19}
                  required
                />
              </label>

              <p className="muted small">
                Test cards: 4242 4242 4242 4242 (success) · ending 0002 (declined) · ending 9995
                (insufficient funds)
              </p>

              {payError && (
                <div className="error-box">
                  <p>{payError}</p>
                </div>
              )}

              <button type="submit" className="button" disabled={paying}>
                {paying ? 'Processing…' : `Pay Rs. ${order.totalAmount}`}
              </button>
            </form>
          )}

          {order.status === 'paid' && (
            <div className="card success-box">
              <h2>✅ Payment received</h2>
              <p>
                Order #{order.id} is paid. We'll ship it soon to {order.shipping.city}.
              </p>
              <p className="muted small">Paid on {new Date(order.paidAt).toLocaleString()}</p>
              <div className="button-row">
                <Link to="/" className="button">
                  Continue shopping
                </Link>
                <Link to="/orders">View my orders</Link>
              </div>
            </div>
          )}

          {order.status !== 'pending' && order.status !== 'paid' && (
            <div className="card">
              <h2>Order #{order.id} is {order.status}</h2>
              <p className="muted">There's nothing to pay for this order.</p>
              <Link to="/orders">← My orders</Link>
            </div>
          )}
        </div>

        <aside className="card cart-summary">
          <h2>Order #{order.id}</h2>
          {order.items.map((item) => (
            <div key={item.productId} className="summary-row small">
              <span>
                {item.productName} × {item.quantity}
              </span>
              <span>Rs. {item.lineTotal}</span>
            </div>
          ))}
          <div className="summary-row summary-total">
            <span>Total</span>
            <span>Rs. {order.totalAmount}</span>
          </div>
          <div className="muted small">
            <strong>Ship to:</strong> {order.shipping.name}, {order.shipping.line1}
            {order.shipping.line2 && `, ${order.shipping.line2}`}, {order.shipping.city}{' '}
            {order.shipping.postalCode}, {order.shipping.country}
          </div>
        </aside>
      </div>
    </section>
  );
}