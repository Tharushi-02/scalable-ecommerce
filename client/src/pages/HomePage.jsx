import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api/client.js';

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/products?limit=8', { auth: false })
      .then((data) => setProducts(data.products))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <section>
      <h1>Shop</h1>
      <p className="muted">Newest products (the full catalogue with filters comes on Day 12)</p>

      {error && <p className="error">Could not load products: {error}</p>}

      <ul className="product-list">
        {products.map((p) => (
          <li key={p.id}>
            <Link to={`/products/${p.id}`}>{p.name}</Link>
            <span>Rs. {p.price}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}