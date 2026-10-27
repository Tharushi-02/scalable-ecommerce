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
      const { user } = await api('/auth/me');
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

  // Creates the account; the API logs the new user in straight away
  async register(name, email, password) {
    const data = await api('/auth/register', {
      method: 'POST',
      auth: false,
      body: { name, email, password },
    });
    tokens.set(data.accessToken, data.refreshToken);
    set({ user: data.user, status: 'authenticated' });
  },

  async logout() {
    const refreshToken = tokens.getRefresh();
    if (refreshToken) {
      await api('/auth/logout', { method: 'POST', auth: false, body: { refreshToken } }).catch(
        () => {},
      );
    }
    tokens.clear();
  },
}));

tokens.onClear(() => {
  useAuthStore.setState({ user: null, status: 'guest' });
});