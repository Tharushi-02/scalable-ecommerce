import { Link, useLocation } from 'react-router';

export default function ProductCard({ product }) {
  const location = useLocation();

  return (
    <Link
      to={`/products/${product.id}`}
      state={{ backTo: location.pathname + location.search }}
      className="product-card"
    >
      {product.imageUrl ? (
        <img src={product.imageUrl} alt={product.name} loading="lazy" />
      ) : (
        <div className="img-placeholder" />
      )}
      <div className="product-card-body">
        <span className="muted small">{product.category.name}</span>
        <h3>{product.name}</h3>
        <div className="product-card-footer">
          <span className="price-small">Rs. {product.price}</span>
          {product.stock === 0 && <span className="tag">Out of stock</span>}
        </div>
      </div>
    </Link>
  );
}