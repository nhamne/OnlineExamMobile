import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const canUseBiometric = Platform.OS === 'ios' || Platform.OS === 'android';

function normalizeRole(role) {
  const value = String(role || '').toLowerCase();
  return value === 'teacher' ? 'teacher' : 'student';
}

function getBiometricEnabledKey(role) {
  return `onlineexam.biometric.${normalizeRole(role)}.enabled`;
}

function getBiometricUserKey(role) {
  return `onlineexam.biometric.${normalizeRole(role)}.user`;
}

function getBiometricLabel(types = []) {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'khuon mat';
  }

  if (
    types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT) ||
    types.includes(LocalAuthentication.AuthenticationType.IRIS)
  ) {
    return 'van tay';
  }

  return 'sinh trac hoc';
}

export async function getBiometricInfo(role) {
  if (!canUseBiometric) {
    return { available: false, enabled: false, label: 'sinh trac hoc', user: null, role: normalizeRole(role) };
  }

  const resolvedRole = normalizeRole(role);

  const [hasHardware, isEnrolled, supportedTypes, enabledRaw, storedUserRaw] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
    SecureStore.getItemAsync(getBiometricEnabledKey(resolvedRole)),
    SecureStore.getItemAsync(getBiometricUserKey(resolvedRole)),
  ]);

  let user = null;
  if (storedUserRaw) {
    try {
      user = JSON.parse(storedUserRaw);
    } catch {
      user = null;
    }
  }

  return {
    available: Boolean(hasHardware && isEnrolled),
    enabled: enabledRaw === 'true' && !!user,
    label: getBiometricLabel(supportedTypes || []),
    user,
    role: resolvedRole,
  };
}

export async function enableBiometricLogin(user) {
  if (!canUseBiometric || !user) return false;

  const role = normalizeRole(user?.role);
  await SecureStore.setItemAsync(getBiometricUserKey(role), JSON.stringify(user));
  await SecureStore.setItemAsync(getBiometricEnabledKey(role), 'true');
  return true;
}

export async function authenticateBiometricLogin(role) {
  const info = await getBiometricInfo(role);
  if (!info.available || !info.enabled || !info.user) {
    throw new Error('Biometric login is not enabled.');
  }

  const authResult = await LocalAuthentication.authenticateAsync({
    promptMessage: `Dang nhap bang ${info.label}`,
    cancelLabel: 'Huy',
    disableDeviceFallback: false,
  });

  if (!authResult.success) {
    throw new Error('Biometric authentication failed.');
  }

  return info.user;
}
