// Where a tapped notification leads, from its data payload. Pure, so it is
// testable without the notifications module.

export type NotificationRoute = { tab: string; showStudents?: boolean };

export function routeForNotification(data: unknown): NotificationRoute | null {
  const d = (data ?? {}) as { tab?: unknown; kind?: unknown };
  // A student asked to join a batch: People › Students, where pending enrollments wait.
  if (d.kind === 'batch-enrollment') return { tab: 'people', showStudents: true };
  return typeof d.tab === 'string' ? { tab: d.tab } : null;
}
