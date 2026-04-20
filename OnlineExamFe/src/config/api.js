import { Platform } from 'react-native';
import Constants from 'expo-constants';

const API_PORT = 3000;

// Optional override, e.g. EXPO_PUBLIC_API_URL=http://192.168.1.10:3000
const explicitApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

function buildDefaultApiUrl() {
  const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];

  if (Platform.OS === 'web') {
    return `http://localhost:${API_PORT}`;
  }

  // Android emulator cannot access host localhost directly.
  if (Platform.OS === 'android' && !expoHost) {
    return `http://10.0.2.2:${API_PORT}`;
  }

  if (expoHost) {
    return `http://${expoHost}:${API_PORT}`;
  }

  return `http://localhost:${API_PORT}`;
}

export const API_BASE_URL = explicitApiUrl
  ? explicitApiUrl.replace(/\/$/, '')
  : buildDefaultApiUrl();
