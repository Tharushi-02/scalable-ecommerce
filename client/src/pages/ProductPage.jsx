import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { api } from '../api/client.js';
import { useAuthStore } from '../stores/authStore.js';
import { useCartStore } from '../stores/cartStore.js';

// A new product id = a brand-new component with fresh state
export default function ProductPage() {
  const { id } = useParams();
  return <ProductDetails key={id} id={id} />;
}

function ProductDetails({ id }) {
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = location.state?.backTo ?? '/';

  const status = useAuthStore((s) => s.status);
  const addItem = useCartStore((s) => s.addItem);

  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text }

  useEffect(() => {
    let ignore = false;
    api(`/products/${id}`, { auth: false })
      .then((data) => {
        if (!ignore) setProduct(data.product);
      })
      .catch((err) => {
        if (!ignore) setError(err.message);
      });
    return () => {
      ignore = true;
    };
  }, [id]);

  async function handleAddToCart() {
    if (status !== 'authenticated') {
      navigate('/login', { state: { from: `/products/${id}` } });
      return;
    }

    setAdding(true);
    setMessage(null);
    try {
      await addItem(product.id, quantity);
      setMessage({
        type: 'success',
        text: quantity === 1 ? 'Added to your cart.' : `Added ${quantity} to your cart.`,
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setAdding(false);
    }
  }

  if (error) {
    return (
      <section>
        <p className="error">{error}</p>
        <Link to={backTo}>← Back to the shop</Link>
      </section>
    );
  }

  if (!product) return <p className="muted">Loading…</p>;

  const outOfStock = product.stock === 0;
  const maxQuantity = Math.min(product.stock, 99); // same 99 cap as the API

  return (
    <section>
      <Link to={backTo}>← Back to the shop</Link>

      <div className="product-detail">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="product-detail-image" />
        ) : (
          <div className="img-placeholder product-detail-image" />
        )}

        <div className="product-detail-info">
          <Link to={`/?category=${product.category.slug}`} className="muted">
            {product.category.name}
          </Link>
          <h1>{product.name}</h1>
          <p className="price">Rs. {product.price}</p>
          <p>{product.description}</p>
          <p className={outOfStock ? 'error' : 'muted'}>
            {outOfStock ? 'Out of stock' : `${product.stock} in stock`}
          </p>

          {!outOfStock && (
            <div className="add-to-cart">
              <label className="quantity">
                <span>Qty</span>
                <select
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  disabled={adding}
                >
                  {Array.from({ length: maxQuantity }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>

              <button type="button" className="button" onClick={handleAddToCart} disabled={adding}>
                {adding ? 'Adding…' : 'Add to cart'}
              </button>
            </div>
          )}

          {message && <p className={message.type}>{message.text}</p>}
        </div>
      </div>
    </section>
  );
}