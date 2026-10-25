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

  // Throws ApiError on failure (e.g. 409 "Only 3 left in stock") so the page can show it
  async addItem(productId, quantity = 1) {
    const { cart } = await api('/cart/items', {
      method: 'POST',
      body: { productId, quantity },
    });
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