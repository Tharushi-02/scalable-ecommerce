import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { api } from '../api/client.js';
import { useAuthStore } from '../stores/authStore.js';
import { useCartStore } from '../stores/cartStore.js';

// Turns one item from the API's 409 "details" list into a sentence
function problemText(problem) {
  if (problem.issue === 'unavailable') return `${problem.name} is no longer available.`;
  if (problem.issue === 'out_of_stock') return `${problem.name} is out of stock.`;
  return `${problem.name}: you asked for ${problem.requested}, only ${problem.available} left.`;
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const cart = useCartStore((s) => s.cart);
  const fetchCart = useCartStore((s) => s.fetchCart);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null); // { message, problems }

  // Fresh cart: prices and stock may have changed since the cart page
  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  if (!cart) return <p className="muted">Loading…</p>;

  // Nothing to check out (unless we're mid-submit, when the cart is being emptied)
  if (cart.items.length === 0 && !submitting) return <Navigate to="/cart" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const shipping = {
      name: form.get('name'),
      line1: form.get('line1'),
      line2: form.get('line2') || undefined, // optional: don't send an empty string
      city: form.get('city'),
      postalCode: form.get('postalCode'),
      country: form.get('country'),
    };

    setSubmitting(true);
    setError(null);
    try {
      const { order } = await api('/orders', { method: 'POST', body: { shipping } });
      await fetchCart(); // the server emptied the cart, so the badge clears
      navigate(`/orders/${order.id}/pay`, { replace: true });
    } catch (err) {
      setError({
        message: err.message,
        problems: err.status === 409 ? (err.details ?? []) : [],
        fields: err.status === 400 ? (err.details ?? []) : [],
      });
      setSubmitting(false);
      if (err.status === 409) fetchCart(); // show the updated stock
    }
  }

  const { summary } = cart;

  return (
    <section>
      <Link to="/cart">← Back to cart</Link>
      <h1>Checkout</h1>

      <div className="cart-layout">
        <form className="card form" onSubmit={handleSubmit}>
          <h2>Shipping address</h2>

          <label className="field">
            <span>Full name</span>
            <input name="name" defaultValue={user?.name ?? ''} required maxLength={100} />
          </label>
          <label className="field">
            <span>Address line 1</span>
            <input name="line1" required maxLength={200} autoComplete="address-line1" />
          </label>
          <label className="field">
            <span>Address line 2 (optional)</span>
            <input name="line2" maxLength={200} autoComplete="address-line2" />
          </label>
          <div className="field-row">
            <label className="field">
              <span>City</span>
              <input name="city" required maxLength={100} autoComplete="address-level2" />
            </label>
            <label className="field">
              <span>Postal code</span>
              <input name="postalCode" required maxLength={20} autoComplete="postal-code" />
            </label>
          </div>
          <label className="field">
            <span>Country</span>
            <input name="country" defaultValue="Sri Lanka" required maxLength={100} />
          </label>

          {error && (
            <div className="error-box">
              <p>{error.message}</p>
              {error.problems.length > 0 && (
                <>
                  <ul>
                    {error.problems.map((p) => (
                      <li key={p.productId}>{problemText(p)}</li>
                    ))}
                  </ul>
                  <Link to="/cart">Review your cart</Link>
                </>
              )}
              {error.fields.length > 0 && (
                <ul>
                  {error.fields.map((f) => (
                    <li key={f.field}>{f.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button
            type="submit"
            className="button"
            disabled={submitting || !summary.canCheckout}
          >
            {submitting ? 'Placing order…' : `Place order · Rs. ${summary.subtotal}`}
          </button>
        </form>

        <aside className="card cart-summary">
          <h2>Your order</h2>
          {cart.items.map((item) => (
            <div key={item.product.id} className="summary-row small">
              <span>
                {item.product.name} × {item.quantity}
              </span>
              <span>Rs. {item.lineTotal}</span>
            </div>
          ))}
          <div className="summary-row summary-total">
            <span>Total</span>
            <span>Rs. {summary.subtotal}</span>
          </div>
          {!summary.canCheckout && (
            <p className="error small">
              Some items have problems. <Link to="/cart">Fix them in your cart</Link>.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}