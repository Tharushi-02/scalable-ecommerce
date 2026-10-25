import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api/client.js';
import { useAuthStore } from '../stores/authStore.js';
import { useCartStore } from '../stores/cartStore.js';

// A new product id = a brand-new component with fresh state (no manual resets)
export default function ProductPage() {
  const { id } = useParams();
  return <ProductDetails key={id} id={id} />;
}

function ProductDetails({ id }) {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const addItem = useCartStore((s) => s.addItem);

  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text }

  useEffect(() => {
    let ignore = false; // set when this component goes away
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
    // Guests log in first, then come back to this product
    if (status !== 'authenticated') {
      navigate('/login', { state: { from: `/products/${id}` } });
      return;
    }

    setAdding(true);
    setMessage(null);
    try {
      await addItem(product.id, 1);
      setMessage({ type: 'success', text: 'Added to your cart.' });
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
        <Link to="/">← Back to the shop</Link>
      </section>
    );
  }

  if (!product) return <p className="muted">Loading…</p>;

  const outOfStock = product.stock === 0;

  return (
    <section>
      <Link to="/">← Back to the shop</Link>
      <h1>{product.name}</h1>
      <p className="muted">{product.category.name}</p>
      <p className="price">Rs. {product.price}</p>
      <p>{product.description}</p>
      <p className="muted">{outOfStock ? 'Out of stock' : `${product.stock} in stock`}</p>

      <button
        type="button"
        className="button"
        onClick={handleAddToCart}
        disabled={adding || outOfStock}
      >
        {outOfStock ? 'Out of stock' : adding ? 'Adding…' : 'Add to cart'}
      </button>

      {message && <p className={message.type}>{message.text}</p>}
    </section>
  );
}