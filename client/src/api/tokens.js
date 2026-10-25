const REFRESH_KEY = 'refreshToken';

let accessToken = null; // memory only
const clearListeners = new Set();

// localStorage can throw (private browsing, blocked storage), so be careful
function readRefresh() {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export const tokens = {
  getAccess: () => accessToken,
  getRefresh: readRefresh,

  set(access, refresh) {
    accessToken = access;
    try {
      localStorage.setItem(REFRESH_KEY, refresh);
    } catch {
      // storage unavailable: still works until the page is refreshed
    }
  },

  clear() {
    accessToken = null;
    try {
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      // ignore
    }
    clearListeners.forEach((listener) => listener());
  },

  // Lets other code react when the session ends (used by the auth store in step 4)
  onClear(listener) {
    clearListeners.add(listener);
    return () => clearListeners.delete(listener);
  },
};