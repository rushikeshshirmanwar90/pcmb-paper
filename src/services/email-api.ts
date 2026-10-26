import { api } from '@/services/api-client';
import type { AuthUser } from '@/context/auth-context';

// Email codes: verifying the signed-in user's email, and resetting a
// forgotten password (no login needed).

export const emailApi = {
  sendVerification: () => api<{ verified: boolean; resendAfter: number }>('/auth/verify-email/send', { method: 'POST' }),
  verify: (code: string) => api<{ user: AuthUser }>('/auth/verify-email', { method: 'POST', body: { code } }).then((r) => r.user),
  forgotPassword: (email: string) => api<{ ok: true; message: string }>('/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    api('/auth/reset-password', { method: 'POST', body: { email, code, newPassword }, auth: false }),
};
