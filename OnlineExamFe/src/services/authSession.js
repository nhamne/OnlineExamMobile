import { Platform } from 'react-native';

const SESSION_KEY = 'onlineexam.session';

const canUseWebStorage = Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage;

export const saveAuthSession = (user) => {
  if (!user) return;

  const payload = JSON.stringify({ user });

  if (canUseWebStorage) {
    window.localStorage.setItem(SESSION_KEY, payload);
  }
};

export const loadAuthSession = () => {
  if (!canUseWebStorage) return null;

  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed?.user || null;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
};

export const clearAuthSession = () => {
  if (canUseWebStorage) {
    window.localStorage.removeItem(SESSION_KEY);
  }
};