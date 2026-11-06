import { api } from '@/services/api-client';
import { logoContentType } from '@/shared/logo-limits';

// The institute's logo, printed in the header of its exam papers. Kept by the
// server with the institute: the tuition's own account sets or removes it, and
// its teachers' papers carry it when they ask. The phone only picks the image
// and shows what is saved.

export interface InstituteLogo {
  /** The image, ready to show: data:image/...;base64,... */
  dataUri: string;
  contentType: string;
  size: number;
  width: number;
  height: number;
  updatedAt: string;
}

/** The institute's logo, or null when it has none. */
export async function fetchInstituteLogo(): Promise<InstituteLogo | null> {
  const { logo } = await api<{ logo: InstituteLogo | null }>('/tuition/logo');
  return logo ?? null;
}

/** Saves a PNG or JPEG (base64, without a data: prefix) as the institute's logo, replacing the one it has. */
export async function saveInstituteLogo(imageBase64: string): Promise<InstituteLogo> {
  const contentType = logoContentType(imageBase64);
  if (!contentType) throw new Error('The logo must be a PNG or JPEG image.');
  const { logo } = await api<{ logo: InstituteLogo }>('/tuition/logo', {
    method: 'PUT',
    body: { contentType, data: imageBase64 },
  });
  return logo;
}

export async function removeInstituteLogo(): Promise<void> {
  await api('/tuition/logo', { method: 'DELETE' });
}
