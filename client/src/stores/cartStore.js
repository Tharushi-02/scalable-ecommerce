import { create } from 'zustand';
import { api } from '../api/client.js';
import { tokens } from '../api/tokens.js';

export const useCartStore = create((set) => ({
  cart: null, // exactly what GET /api/v1/cart returns

  async fetchCart() {
    try {
      const { cart } = await api('/cart');
      set({ cart });
    } catch {
      set({ cart: null });
    }
  },

  // All the actions below throw ApiError on failure, so the page can show the message.
  // Every cart endpoint returns the full updated cart, so we just store it.

  async addItem(productId, quantity = 1) {
    const { cart } = await api('/cart/items', {
      method: 'POST',
      body: { productId, quantity },
    });
    set({ cart });
  },

  async setQuantity(productId, quantity) {
    const { cart } = await api(`/cart/items/${productId}`, {
      method: 'PATCH',
      body: { quantity },
    });
    set({ cart });
  },

  async removeItem(productId) {
    const { cart } = await api(`/cart/items/${productId}`, { method: 'DELETE' });
    set({ cart });
  },

  async clearCart() {
    const { cart } = await api('/cart', { method: 'DELETE' });
    set({ cart });
  },
}));

// A logged-out user has no cart
tokens.onClear(() => {
  useCartStore.setState({ cart: null });
});

// Total units in the cart, for the header badge
export const selectCartCount = (state) =>
  state.cart?.items.reduce((total, item) => total + item.quantity, 0) ?? 0;