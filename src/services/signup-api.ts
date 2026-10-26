import { api } from '@/services/api-client';
import type { SchoolSubject } from '@/constants/school';

// Teacher sign-up with a tuition's join code (no login needed).

export const signupApi = {
  checkCode: (code: string) =>
    api<{ tuition: { name: string; address: string } }>('/auth/join/check', { method: 'POST', body: { code }, auth: false }).then((r) => r.tuition),
  joinAsTeacher: (input: { code: string; name: string; email: string; phone: string; subjects: SchoolSubject[]; password: string }) =>
    api<{ ok: true; tuition: { name: string } }>('/auth/join', { method: 'POST', body: input, auth: false }),
};
