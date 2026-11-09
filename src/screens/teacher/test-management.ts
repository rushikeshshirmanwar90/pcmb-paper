import type { AccessStudent, TestMonitor, TestMonitorRow } from '../../services/school-api';

export type ParticipationGroup = 'taking' | 'allowed' | 'waiting' | 'submitted' | 'restricted' | 'requests' | 'violations';
export const PARTICIPATION_GROUPS: { key: ParticipationGroup; label: string; description: string }[] = [
  { key: 'taking', label: 'Taking', description: 'Students with an attempt in progress.' },
  { key: 'allowed', label: 'Allowed', description: 'Students currently authorized to attend this test.' },
  { key: 'waiting', label: 'Not Started', description: 'Students who have permission but have not started.' },
  { key: 'submitted', label: 'Submitted', description: 'Finished attempts, including automatic and violation submissions.' },
  { key: 'restricted', label: 'Restricted', description: 'Students without permission to start this test.' },
  { key: 'requests', label: 'Requests', description: 'Students waiting for your approval.' },
  { key: 'violations', label: 'Violations', description: 'Students with examination violations, including paused attempts awaiting a decision.' },
];

export const matchesParticipation = (row: TestMonitorRow, group: ParticipationGroup) =>
  group === 'taking' ? row.state === 'in-progress'
    : group === 'waiting' ? row.state === 'not-started'
      : group === 'violations' ? row.state === 'violation'
        : group === 'submitted' && !row.resumable && ['submitted', 'auto-submitted', 'violation'].includes(row.state);

export const matchesAccess = (row: AccessStudent, group: ParticipationGroup) => group === 'allowed' ? row.allowed : !row.started &&
  (group === 'requests' ? row.request === 'pending' : group === 'restricted' ? !row.allowed : false);

export function participationCounts(monitor: TestMonitor): Record<ParticipationGroup, number> {
  return {
    taking: monitor.counts.inProgress,
    allowed: (monitor.accessStudents ?? []).filter(r => r.allowed).length,
    waiting: monitor.counts.notStarted,
    submitted: monitor.counts.submitted,
    violations: monitor.counts.violations,
    restricted: (monitor.accessStudents ?? []).filter(r => matchesAccess(r, 'restricted')).length,
    requests: (monitor.accessStudents ?? []).filter(r => matchesAccess(r, 'requests')).length,
  };
}

/** Candidates are limited by the server to activated students in the test's batches. */
export const studentsToAdd = (monitor: TestMonitor) => (monitor.accessStudents ?? []).filter(r => r.eligible && !r.allowed && !r.started);

/** Restricted remains visible at zero, including legacy monitors. */
export const availableParticipationGroups = (monitor: TestMonitor) => PARTICIPATION_GROUPS.filter(item => item.key !== 'requests' || monitor.accessStudents !== undefined);
