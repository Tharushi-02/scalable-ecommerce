import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useCartStore } from '../stores/cartStore.js';

function issueText(item) {
  switch (item.issue) {
    case 'unavailable':
      return 'No longer available. Please remove it.';
    case 'out_of_stock':
      return 'Out of stock. Please remove it.';
    case 'insufficient_stock':
      return `Only ${item.product.stock} left. Please lower the quantity.`;
    default:
      return null;
  }
}

// Quantity choices: 1 up to what's buyable (max 99).
// If the cart already holds more than that, keep the current value visible too.
function quantityOptions(item) {
  const limit = Math.min(item.product.stock, 99);
  const options = Array.from({ length: limit }, (_, i) => i + 1);
  if (item.quantity > limit) options.push(item.quantity);
  return options;
}

export default function CartPage() {
  const navigate = useNavigate();
  const cart = useCartStore((s) => s.cart);
  const fetchCart = useCartStore((s) => s.fetchCart);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // Runs one cart action with a "busy" flag and error message
  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleClear() {
    if (window.confirm('Remove everything from your cart?')) {
      run(() => clearCart());
    }
  }

  if (!cart) return <p className="muted">Loading your cart…</p>;

  if (cart.items.length === 0) {
    return (
      <section>
        <h1>Your cart</h1>
        <p className="muted">Your cart is empty.</p>
        <Link to="/" className="button">
          Start shopping
        </Link>
      </section>
    );
  }

  const { summary } = cart;

  return (
    <section>
      <div className="page-title-row">
        <h1>Your cart</h1>
        <button type="button" className="link-button" onClick={handleClear} disabled={busy}>
          Empty cart
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="cart-layout">
        <ul className="cart-items">
          {cart.items.map((item) => {
            const canChange = item.issue !== 'unavailable' && item.issue !== 'out_of_stock';

            return (
              <li
                key={item.product.id}
                className={item.issue ? 'cart-item has-issue' : 'cart-item'}
              >
                {item.product.imageUrl ? (
                  <img src={item.product.imageUrl} alt={item.product.name} />
                ) : (
                  <div className="img-placeholder" />
                )}

                <div className="cart-item-info">
                  <Link to={`/products/${item.product.id}`}>{item.product.name}</Link>
                  <span className="muted small">Rs. {item.product.price} each</span>
                  {item.issue && <span className="error small">{issueText(item)}</span>}
                  <button
                    type="button"
                    className="link-button small"
                    onClick={() => run(() => removeItem(item.product.id))}
                    disabled={busy}
                  >
                    Remove
                  </button>
                </div>

                <select
                  className="cart-item-qty"
                  value={item.quantity}
                  onChange={(e) => run(() => setQuantity(item.product.id, Number(e.target.value)))}
                  disabled={busy || !canChange}
                  aria-label={`Quantity of ${item.product.name}`}
                >
                  {quantityOptions(item).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>

                <div className="cart-item-total">Rs. {item.lineTotal}</div>
              </li>
            );
          })}
        </ul>

        <aside className="card cart-summary">
          <h2>Summary</h2>
          <div className="summary-row">
            <span>Items</span>
            <span>{summary.itemCount}</span>
          </div>
          <div className="summary-row summary-total">
            <span>Subtotal</span>
            <span>Rs. {summary.subtotal}</span>
          </div>

          {!summary.canCheckout && (
            <p className="error small">Fix the items marked in red to continue.</p>
          )}

          <button
            type="button"
            className="button"
            onClick={() => navigate('/checkout')}
            disabled={!summary.canCheckout || busy}
          >
            Checkout
          </button>
        </aside>
      </div>
    </section>
  );
}