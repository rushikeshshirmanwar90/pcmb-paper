import { api } from '@/services/api-client';
import { PROGRAM_INFO, programOf, type Program, type SchoolStandard, type SchoolSubject, type Track } from '@/constants/school';

// The tuition's data on the papers backend: batches, teachers, students,
// announcements, chapter weightage and the syllabus.

export interface BatchSlot {
  /** 0 = Sunday … 6 = Saturday */
  day: number;
  start: string;
  end: string;
}

export type Coverage = Record<string, { covered: number; total: number; percent: number }>;

export interface Batch {
  id: string;
  name: string;
  /** Always set here: filled from `track` when an older server doesn't send it. */
  program: Program;
  /** The older field the server keeps beside the program. */
  track: Track;
  standard: SchoolStandard | null;
  /** e.g. "2026-2027"; null for batches made before academic years. */
  academicYear: string | null;
  subjects: SchoolSubject[];
  venue: string;
  schedule: BatchSlot[];
  weeklyMinutes: number;
  teachers: { teacherId: string; name: string; subject: SchoolSubject }[];
  studentCount: number;
  /** The subject timetable at a glance (zeros from servers before it). */
  classes: TimetableSummary;
  coverage?: Coverage;
}

export interface TimetableSummary {
  /** Classes a week. */
  classes: number;
  weeklyMinutes: number;
  /** Weekdays with a class, 0 = Sunday. */
  days: number[];
  withoutTeacher: number;
}

const NO_CLASSES: TimetableSummary = { classes: 0, weeklyMinutes: 0, days: [], withoutTeacher: 0 };

export interface Teacher {
  id: string;
  name: string;
  email: string;
  phone: string;
  subjects: SchoolSubject[];
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  batches: { id: string; name: string; subject: SchoolSubject }[];
}

export type AccountStatus = 'invited' | 'active';
export type InvitationStatus = 'pending_send' | 'sent' | 'send_failed';

export interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  parentPhone: string;
  /** Filled from `track` when an older server doesn't send it; null when neither is set. */
  program: Program | null;
  track: Track | null;
  standard: SchoolStandard | null;
  batch: { id: string; name: string } | null;
  active: boolean;
  accountStatus: AccountStatus;
  invitationStatus: InvitationStatus | null;
  invitedAt: string | null;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Announcement {
  id: string;
  kind: 'schedule' | 'update';
  title: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; role: string };
  batches: { id: string; name: string }[];
  allBatches: boolean;
}

export interface Overview {
  totals: { students: number; teachers: number; batches: number; unassignedStudents: number };
  batches: (Batch & { coverage: Coverage })[];
}

export interface TuitionDetails {
  name: string;
  address: string;
  phone: string;
  email: string;
}

export interface SyllabusChapter {
  standard: SchoolStandard;
  chapter: string;
  topics: string[];
  questionCount: number;
}

export interface Weightage {
  track: Track;
  subject: SchoolSubject;
  chapters: { standard: SchoolStandard; chapter: string; marks: number | null }[];
  totalMarks: number;
}

export type BatchInput = Partial<{
  name: string;
  program: Program;
  standard: SchoolStandard | null;
  academicYear: string;
  subjects: SchoolSubject[];
  venue: string;
  schedule: BatchSlot[];
  teachers: { teacherId: string; subject: SchoolSubject }[];
}>;

export type TeacherInput = Partial<{ name: string; email: string; phone: string; subjects: SchoolSubject[]; password: string; active: boolean }>;

export type EnrollmentMethod = 'enroll_immediately' | 'require_approval';

export type StudentInput = Partial<{
  name: string;
  email: string;
  phone: string;
  parentPhone: string;
  program: Program;
  standard: SchoolStandard | null;
  batchId: string | null;
  password: string;
  active: boolean;
  enrollmentMethod: EnrollmentMethod;
}>;

export interface CreateStudentResult {
  student: Student;
  enrollment: 'enrolled' | 'approval_pending' | 'batch_pending';
  pendingCreated: boolean;
  emailSent: boolean;
  emailError: string | null;
}

// The server sends `program` and `academicYear` from Step 2 on; older
// servers don't, so they're filled in here from the legacy track.
type FromServer<T> = Omit<T, 'program' | 'academicYear' | 'classes'> & { program?: Program | null; academicYear?: string | null; classes?: TimetableSummary };
const withBatch = <T extends Batch>(b: FromServer<T>) => ({ ...b, program: programOf(b) ?? 'GENERAL', academicYear: b.academicYear ?? null, classes: b.classes ?? NO_CLASSES }) as T;
const withStudent = (s: FromServer<Student>): Student => ({
  ...s,
  program: programOf(s),
  accountStatus: s.accountStatus ?? 'active',
  invitationStatus: s.invitationStatus ?? null,
  invitedAt: s.invitedAt ?? null,
  mustChangePassword: s.mustChangePassword ?? false,
});
// The program's legacy track goes along with it, so an older server (which
// only knows tracks) still saves the batch or student. Newer servers check
// that the two agree.
const withTrack = <T extends { program?: Program }>(input: T) => (input.program ? { ...input, track: PROGRAM_INFO[input.program].track } : input);

const q = (params: Record<string, string | undefined | null>) => {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) search.set(k, v);
  const s = search.toString();
  return s ? `?${s}` : '';
};

export const tuitionApi = {
  overview: () =>
    api<Omit<Overview, 'batches'> & { batches: FromServer<Overview['batches'][number]>[] }>('/tuition/overview').then((r) => ({ ...r, batches: r.batches.map(withBatch) })),

  profile: () => api<{ tuition: TuitionDetails }>('/tuition/profile').then((r) => r.tuition),
  updateProfile: (changes: Partial<TuitionDetails>) =>
    api<{ tuition: TuitionDetails }>('/tuition/profile', { method: 'PATCH', body: changes }).then((r) => r.tuition),

  batches: () => api<{ batches: FromServer<Batch>[] }>('/tuition/batches').then((r) => r.batches.map(withBatch)),
  /** `coverage: false` skips the syllabus coverage ({}), which is the slow part. */
  batch: (id: string, coverage = true) =>
    api<{ batch: FromServer<Batch & { coverage: Coverage }>; students: FromServer<Student>[] }>(`/tuition/batches/${id}${coverage ? '' : '?coverage=0'}`).then((r) => ({
      batch: withBatch<Batch & { coverage: Coverage }>(r.batch),
      students: r.students.map(withStudent),
    })),
  /**
   * Just the syllabus coverage. A server that knows `coverage=only` skips the
   * students and the rest; an older one answers in full, which is read the same.
   */
  batchCoverage: (id: string) =>
    api<{ batch: { coverage?: Coverage } }>(`/tuition/batches/${id}?coverage=only`).then((r) => r.batch.coverage ?? {}),
  createBatch: (input: BatchInput) =>
    api<{ batch: FromServer<Batch> }>('/tuition/batches', { method: 'POST', body: withTrack(input) }).then((r) => withBatch(r.batch)),
  updateBatch: (id: string, input: BatchInput) =>
    api<{ batch: FromServer<Batch> }>(`/tuition/batches/${id}`, { method: 'PATCH', body: withTrack(input) }).then((r) => withBatch(r.batch)),
  deleteBatch: (id: string) => api(`/tuition/batches/${id}`, { method: 'DELETE' }),
  /** Sets the subjects one of the tuition's teachers takes in the batch (assigning them if new). */
  assignTeacher: (id: string, teacherId: string, subjects: SchoolSubject[]) =>
    api<{ batch: FromServer<Batch> }>(`/tuition/batches/${id}/teachers`, { method: 'PUT', body: { teacherId, subjects } }).then((r) => withBatch(r.batch)),
  /** Takes the teacher off this batch only; their account and other batches stay. */
  removeTeacher: (id: string, teacherId: string) =>
    api<{ batch: FromServer<Batch> }>(`/tuition/batches/${id}/teachers?teacherId=${teacherId}`, { method: 'DELETE' }).then((r) => withBatch(r.batch)),

  teacher: (id: string) => api<{ teacher: Teacher }>(`/tuition/teachers/${encodeURIComponent(id)}`).then((r) => r.teacher),
  teachers: () => api<{ teachers: Teacher[] }>('/tuition/teachers').then((r) => r.teachers),
  createTeacher: (input: TeacherInput) => api<{ teacher: Teacher }>('/tuition/teachers', { method: 'POST', body: input }).then((r) => r.teacher),
  updateTeacher: (id: string, input: TeacherInput) =>
    api<{ teacher: Teacher }>(`/tuition/teachers/${id}`, { method: 'PATCH', body: input }).then((r) => r.teacher),
  deleteTeacher: (id: string) => api(`/tuition/teachers/${id}`, { method: 'DELETE' }),
  resetTeacherPassword: (id: string, password: string) => api(`/tuition/teachers/${id}/password`, { method: 'POST', body: { password } }),

  checkStudentEmail: (email: string) =>
    api<{ available: boolean; reason?: string; accountStatus?: string | null; studentId?: string | null }>(`/tuition/students/check-email${q({ email })}`),
  student: (id: string) => api<{ student: FromServer<Student> }>(`/tuition/students/${encodeURIComponent(id)}`).then((r) => withStudent(r.student)),
  students: (filter: { batchId?: string | null; q?: string; accountStatus?: string | null } = {}) =>
    api<{ students: FromServer<Student>[] }>(`/tuition/students${q({ batchId: filter.batchId, q: filter.q, accountStatus: filter.accountStatus })}`).then((r) => r.students.map(withStudent)),
  createStudent: (input: StudentInput) =>
    api<{ student: FromServer<Student>; enrollment: CreateStudentResult['enrollment']; pendingCreated: boolean; emailSent: boolean; emailError: string | null }>(
      '/tuition/students', { method: 'POST', body: withTrack(input) }
    ).then((r) => ({ student: withStudent(r.student), enrollment: r.enrollment, pendingCreated: r.pendingCreated, emailSent: r.emailSent, emailError: r.emailError })),
  updateStudent: (id: string, input: StudentInput) =>
    api<{ student: FromServer<Student> }>(`/tuition/students/${id}`, { method: 'PATCH', body: withTrack(input) }).then((r) => withStudent(r.student)),
  deleteStudent: (id: string) => api(`/tuition/students/${id}`, { method: 'DELETE' }),
  resetStudentPassword: (id: string, password: string) => api(`/tuition/students/${id}/password`, { method: 'POST', body: { password } }),
  resendInvitation: (id: string) =>
    api<{ student: FromServer<Student>; emailSent: boolean; emailError: string | null }>(
      `/tuition/students/${id}/resend-invitation`, { method: 'POST' }
    ).then((r) => ({ student: withStudent(r.student), emailSent: r.emailSent, emailError: r.emailError })),

  weightage: (track: Track, subject: SchoolSubject) => api<Weightage>(`/tuition/weightage${q({ track, subject })}`),
  saveWeightage: (track: Track, subject: SchoolSubject, chapters: Weightage['chapters']) =>
    api<Weightage>('/tuition/weightage', { method: 'PUT', body: { track, subject, chapters } }),
};

/** A teacher waiting to be approved: who they are and the subjects they said they teach. */
export interface JoinRequest {
  id: string;
  createdAt: string;
  subjects: SchoolSubject[];
  person: { name: string; email: string; emailVerified: boolean };
}

export const joinRequestsApi = {
  /** Teachers waiting to join with the institute's teacher code (tuition). */
  pending: () => api<{ requests: JoinRequest[] }>('/tuition/join-requests').then((r) => r.requests),
  approve: (id: string) => api(`/tuition/join-requests/${id}/accept`, { method: 'POST' }),
  reject: (id: string) => api(`/tuition/join-requests/${id}/reject`, { method: 'POST' }),
};

export interface MyJoinRequest {
  id?: string;
  status: 'pending' | 'accepted' | 'rejected';
  /** What the code they used makes them. */
  role?: 'student' | 'teacher';
  /** Teacher requests: the subjects they asked with. */
  subjects?: SchoolSubject[];
  acceptedAs?: 'student' | 'teacher' | null;
  createdAt?: string;
  tuition: { name: string; address: string };
  /** Set when the request came with a batch's joining code. */
  batch?: { name: string; program: Program | null; standard: SchoolStandard | null } | null;
}

/** What a joining code leads to, shown before the student confirms. */
export interface JoinPreview {
  kind: 'batch' | 'teacher';
  institute: string;
  batch: { name: string; program: Program | null; standard: SchoolStandard | null } | null;
}

export const myJoinApi = {
  /** The signed-in person's latest request (before they're in a tuition). */
  latest: () => api<{ request: MyJoinRequest | null }>('/join-requests/mine').then((r) => r.request),
  /** Checks a joining code without asking to join. */
  validate: (code: string) => api<{ preview: JoinPreview }>('/join-requests/validate', { method: 'POST', body: { code } }).then((r) => r.preview),
  /** `subjects` are the PCMB subjects a teacher says they teach; students send none. */
  send: (code: string, subjects?: SchoolSubject[]) =>
    api<{ request: MyJoinRequest }>('/join-requests', { method: 'POST', body: subjects ? { code, subjects } : { code } }).then((r) => r.request),
  cancel: () => api('/join-requests/mine', { method: 'DELETE' }),
};

/** A joining code, as the tuition manages it. */
export interface JoinInvite {
  status: 'active' | 'expired' | 'revoked';
  /** null once turned off. */
  code: string | null;
  /** null: never expires. */
  expiresAt: string | null;
  institute: string;
}

/** A batch's code (students). */
export interface BatchInvite extends JoinInvite {
  batch: { id: string; name: string; program: Program | null; standard: SchoolStandard | null };
}

/** The institute's code (teachers): no batch. */
export type TeacherInvite = JoinInvite;

export type InviteChange = { action: 'regenerate'; expiresInDays: number | null } | { action: 'extend'; expiresInDays: number | null } | { action: 'revoke' };

export const batchInviteApi = {
  get: (batchId: string) => api<{ invite: BatchInvite }>(`/tuition/batches/${batchId}/invite`).then((r) => r.invite),
  change: (batchId: string, input: InviteChange) => api<{ invite: BatchInvite }>(`/tuition/batches/${batchId}/invite`, { method: 'POST', body: input }).then((r) => r.invite),
};

export const teacherInviteApi = {
  get: () => api<{ invite: TeacherInvite }>('/tuition/teacher-invite').then((r) => r.invite),
  change: (input: InviteChange) => api<{ invite: TeacherInvite }>('/tuition/teacher-invite', { method: 'POST', body: input }).then((r) => r.invite),
};

/** A student waiting to be let into a batch. */
export interface Enrollment {
  id: string;
  createdAt: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  source?: 'join_code' | 'admin_created';
  batch: { id: string; name: string; program: Program | null; standard: SchoolStandard | null } | null;
}

export interface EnrollmentResult {
  approved: number;
  rejected: number;
  failed: { id: string; name: string; reason: string }[];
}

export const enrollmentsApi = {
  pending: () => api<{ enrollments: Enrollment[] }>('/tuition/enrollments').then((r) => r.enrollments),
  decide: (ids: string[], action: 'approve' | 'reject', batchId?: string) =>
    api<EnrollmentResult>('/tuition/enrollments/decide', { method: 'POST', body: { ids, action, ...(batchId ? { batchId } : {}) } }),
  dismiss: (id: string) => api<EnrollmentResult>('/tuition/enrollments/decide', { method: 'POST', body: { ids: [id], action: 'dismiss' } }),
};

export const announcementsApi = {
  list: (limit = 30) => api<{ announcements: Announcement[] }>(`/announcements?limit=${limit}`).then((r) => r.announcements),
  create: (input: { title: string; body: string; kind: Announcement['kind']; batchIds: string[] }) =>
    api<{ announcement: Announcement }>('/announcements', { method: 'POST', body: input }).then((r) => r.announcement),
  remove: (id: string) => api(`/announcements/${id}`, { method: 'DELETE' }),
};

export const syllabusApi = {
  chapters: (subject: SchoolSubject, standard?: SchoolStandard | null) =>
    api<{ chapters: SyllabusChapter[] }>(`/syllabus${q({ subject, standard })}`).then((r) => r.chapters),
};

// ─── Display helpers ───────────────────────────────────────────────────────

/** "16:30" → "4:30 PM" */
export function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** 270 → "4 h 30 min" */
export function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Mon, Wed · 7:00 AM – 9:00 AM", grouping days that share a time. */
export function describeSchedule(schedule: BatchSlot[]) {
  if (!schedule.length) return 'No timings yet';
  const groups = new Map<string, number[]>();
  for (const slot of schedule) {
    const key = `${slot.start}-${slot.end}`;
    groups.set(key, [...(groups.get(key) ?? []), slot.day]);
  }
  return [...groups.entries()]
    .map(([key, days]) => {
      const [start, end] = key.split('-');
      return `${days.map((d) => DAY_SHORT[d]).join(', ')} · ${formatTime(start)} – ${formatTime(end)}`;
    })
    .join('\n');
}

/** "2 days ago", "just now"… */
export function timeAgo(iso: string) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
