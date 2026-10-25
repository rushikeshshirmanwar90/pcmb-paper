import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Keeps the login token between app launches: in the phone's secure storage
// (Keychain / Keystore), or the browser's local storage on the web, which has
// no secure store.

const KEY = 'pcmb.session.token';

export async function loadToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function saveToken(token: string): Promise<void> {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, token);
    else await SecureStore.setItemAsync(KEY, token);
  } catch {
    // Not kept: the user logs in again next launch.
  }
}

export async function clearToken(): Promise<void> {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Nothing to clear.
  }
}
