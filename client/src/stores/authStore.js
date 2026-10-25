import { create } from 'zustand';
import { api } from '../api/client.js';
import { tokens } from '../api/tokens.js';

export const useAuthStore = create((set) => ({
  user: null,
  status: 'loading', // 'loading' | 'authenticated' | 'guest'

  // On app start: restore the session if a refresh token was saved
  async init() {
    if (!tokens.getRefresh()) {
      set({ user: null, status: 'guest' });
      return;
    }
    try {
      const { user } = await api('/auth/me'); // 401 → automatic refresh → retry
      set({ user, status: 'authenticated' });
    } catch {
      set({ user: null, status: 'guest' });
    }
  },

  async login(email, password) {
    const data = await api('/auth/login', {
      method: 'POST',
      auth: false,
      body: { email, password },
    });
    tokens.set(data.accessToken, data.refreshToken);
    set({ user: data.user, status: 'authenticated' });
  },

  async logout() {
    const refreshToken = tokens.getRefresh();
    if (refreshToken) {
      // Revoke it on the server; ignore network errors, we log out locally anyway
      await api('/auth/logout', { method: 'POST', auth: false, body: { refreshToken } }).catch(
        () => {},
      );
    }
    tokens.clear(); // triggers the onClear listener below
  },
}));

// Whenever the session ends (logout, or a failed refresh), reset the user
tokens.onClear(() => {
  useAuthStore.setState({ user: null, status: 'guest' });
});