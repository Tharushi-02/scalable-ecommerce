import { useEffect } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { useAuthStore } from '../stores/authStore.js';
import { useCartStore, selectCartCount } from '../stores/cartStore.js';

export default function Layout() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const logout = useAuthStore((s) => s.logout);
  const fetchCart = useCartStore((s) => s.fetchCart);
  const cartCount = useCartStore(selectCartCount);

  // Load the cart whenever someone logs in (or their session is restored)
  useEffect(() => {
    if (status === 'authenticated') fetchCart();
  }, [status, fetchCart]);

  return (
    <div className="app">
      <header className="header">
        <div className="container header-inner">
          <Link to="/" className="logo">
            Scalable Store
          </Link>
          <nav className="nav">
            <NavLink to="/" end>
              Shop
            </NavLink>
            <NavLink to="/cart">
              Cart
              {cartCount > 0 && <span className="badge">{cartCount}</span>}
            </NavLink>
            {status === 'authenticated' && <NavLink to="/orders">Orders</NavLink>}

            {status === 'authenticated' && (
              <>
                <span className="muted">Hi, {user.name.split(' ')[0]}</span>
                <button type="button" className="link-button" onClick={logout}>
                  Log out
                </button>
              </>
            )}
            {status === 'guest' && <NavLink to="/login">Log in</NavLink>}
          </nav>
        </div>
      </header>

      <main className="container main">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="container">Scalable E-Commerce · built with React, Express and PostgreSQL</div>
      </footer>
    </div>
  );
}