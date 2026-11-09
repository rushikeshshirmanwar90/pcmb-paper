import * as ImagePicker from 'expo-image-picker';
import { base64Bytes, MAX_LOGO_BYTES, MAX_LOGO_KB } from '@/shared/logo-limits';

// Choosing a logo from the phone's photos. The picker hands back the image as
// base64 (normally JPEG) after the teacher crops it; the server checks it again.

/** The picked image can't be used; the message says why, for the screen to show. */
export class LogoPickError extends Error {}

/** Opens the photo library; null when the user backs out, else the chosen image as base64. */
export async function pickLogo(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.5,
    base64: true,
    exif: false,
  });
  if (result.canceled) return null;
  const base64 = result.assets[0]?.base64;
  if (!base64) throw new LogoPickError("That image couldn't be read. Choose another.");
  const bytes = base64Bytes(base64);
  if (bytes > MAX_LOGO_BYTES) {
    throw new LogoPickError(`That image is ${Math.round(bytes / 1024)} KB. Choose one under ${MAX_LOGO_KB} KB, such as a smaller or cropped copy.`);
  }
  return base64;
}
