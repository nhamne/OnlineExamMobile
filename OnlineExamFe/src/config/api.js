import { Platform } from 'react-native';

const API_PORT = 3000;

const hostByPlatform = {
  android: '10.0.2.2',
  ios: 'localhost',
  web: 'localhost',
  default: 'localhost',
};

const host = hostByPlatform[Platform.OS] || hostByPlatform.default;

export const API_BASE_URL = `http://${host}:${API_PORT}`;
