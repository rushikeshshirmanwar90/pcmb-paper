import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Small settings kept on this device between launches (a few bytes each, like
// "dark"): in the phone's secure storage, as the login token is, or the
// browser's local storage on the web.

export async function loadPreference(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function savePreference(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // Not kept: the default applies next launch.
  }
}
