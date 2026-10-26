import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../api/client.js';
import Filters from '../components/Filters.jsx';
import Pagination from '../components/Pagination.jsx';
import ProductCard from '../components/ProductCard.jsx';

const PAGE_SIZE = 12;

export default function HomePage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.toString();

  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;

    const params = new URLSearchParams(query);
    params.set('limit', String(PAGE_SIZE));

    api(`/products?${params}`, { auth: false })
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
  }, [query]);

  const pagination = result?.pagination;

  return (
    <section>
      <h1>Shop</h1>
      <Filters />

      {error && <p className="error">{error}</p>}
      {!result && !error && <p className="muted">Loading…</p>}

      {result && (
        <>
          <p className="muted">
            {pagination.total} products
            {pagination.totalPages > 1 && ` · page ${pagination.page} of ${pagination.totalPages}`}
          </p>

          {result.products.length > 0 ? (
            <div className="product-grid">
              {result.products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : pagination.total > 0 ? (
            <p className="muted">This page doesn't exist. Use the buttons below to go back.</p>
          ) : (
            <p className="muted">No products match your filters.</p>
          )}

          <Pagination page={pagination.page} totalPages={pagination.totalPages} />
        </>
      )}
    </section>
  );
}