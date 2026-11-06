// Pure visibility state and durable outbox, independent of React/native APIs.
export const VISIBILITY_GRACE_MS = 10_000;
export const HEARTBEAT_MS = 2_000;
export type VisibilityReason = 'app-background' | 'app-inactive' | 'focus-loss' | 'screen-focus-loss' | 'split-screen';
export type Interruption = { id: string; reason: VisibilityReason; startedAt: string; returnedAt?: string | null };
export type VisibilityRecord = { startedAt: string; resumeVersion: number; clientId: string; sequence: number; clockSkew: number; pending: Interruption[]; open: Interruption | null };
export type VisibilityPacket = { clientId: string; sequence: number; resumeVersion: number; visible: boolean; observedAt: string; interruptions: Interruption[] };
export type VisibilityStatus = { state: string; resumeVersion?: number; visibilityVerified?: boolean };
export const visibilityId = () => `${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;

export function decodeVisibility(raw: string | null): VisibilityRecord | null {
  try {
    const value = JSON.parse(raw ?? 'null') as VisibilityRecord | null;
    if (!value || !Number.isFinite(Date.parse(value.startedAt)) || !Number.isSafeInteger(value.resumeVersion) || typeof value.clientId !== 'string' || !Number.isSafeInteger(value.sequence) || !Number.isFinite(value.clockSkew) || !Array.isArray(value.pending)) return null;
    const valid = (i: Interruption) => i && typeof i.id === 'string' && ['app-background', 'app-inactive', 'focus-loss', 'screen-focus-loss', 'split-screen'].includes(i.reason) && Number.isFinite(Date.parse(i.startedAt)) && (i.returnedAt == null || Number.isFinite(Date.parse(i.returnedAt)));
    if (value.pending.some(i => !valid(i)) || (value.open && !valid(value.open))) return null;
    return value;
  } catch { return null; }
}

/** Run before loading the examination: a killed process cannot erase its
 * persisted hidden interval by opening the same attempt again. */
export function reopenVisibility(record: VisibilityRecord, now = Date.now() + record.clockSkew): VisibilityPacket {
  return { clientId: visibilityId(), sequence: 1, resumeVersion: record.resumeVersion, visible: true, observedAt: new Date(now).toISOString(),
    interruptions: [...record.pending, ...(record.open ? [{ ...record.open, returnedAt: new Date(now).toISOString() }] : [])] };
}

export function createExamVisibility<T extends VisibilityStatus>({ startedAt, resumeVersion, recovered, now, clockSkew, persist, send, onStatus, onBlocked, onLoss }: {
  startedAt: string; resumeVersion: number; recovered?: VisibilityRecord | null; now: () => number; clockSkew: () => number;
  persist: (record: VisibilityRecord) => void; send: (packet: VisibilityPacket) => Promise<T>; onStatus: (status: T) => void;
  onBlocked: (blocked: boolean) => void; onLoss: () => void;
}) {
  const sources = new Set<string>();
  let record: VisibilityRecord = { startedAt, resumeVersion, clientId: visibilityId(), sequence: 0, clockSkew: clockSkew(),
    pending: recovered?.startedAt === startedAt && recovered.resumeVersion === resumeVersion ? [...recovered.pending, ...(recovered.open ? [{ ...recovered.open, returnedAt: new Date(now()).toISOString() }] : [])] : [], open: null };
  let permitted = false;
  let stopped = false;
  let terminal = false;
  let flight: Promise<void> | null = null;
  let dirty = false;
  let change = 0;
  const snapshot = () => ({ ...record, pending: record.pending.map(i => ({ ...i })), open: record.open ? { ...record.open } : null });
  const store = () => { record.clockSkew = clockSkew(); persist(snapshot()); };
  const block = () => { permitted = false; onBlocked(true); };
  store();

  function accept(status: VisibilityStatus) {
    if ((status.resumeVersion ?? 0) < record.resumeVersion) return;
    if ((status.resumeVersion ?? 0) > record.resumeVersion) {
      record = { startedAt, resumeVersion: status.resumeVersion!, clientId: visibilityId(), sequence: 0, clockSkew: clockSkew(), pending: [], open: null };
      if (sources.size) record.open = { id: visibilityId(), reason: 'screen-focus-loss', startedAt: new Date(now()).toISOString() };
      change++; dirty = true; store(); block();
    }
    terminal = status.state !== 'in-progress';
    if (terminal) block();
  }

  function flush(evidenceOnly = false): Promise<void> {
    if (stopped || (terminal && !evidenceOnly)) return Promise.resolve();
    if (flight) { dirty = true; return flight; }
    const version = change;
    const packet: VisibilityPacket = { clientId: record.clientId, sequence: ++record.sequence, resumeVersion: record.resumeVersion,
      visible: sources.size === 0, observedAt: new Date(now()).toISOString(), interruptions: [...record.pending, ...(record.open ? [record.open] : [])] };
    store(); dirty = false;
    flight = send(packet).then(status => {
      if (stopped) return;
      accept(status); onStatus(status);
      if ((status.resumeVersion ?? 0) !== packet.resumeVersion) return;
      const acknowledged = new Set(packet.interruptions.filter(i => i.returnedAt).map(i => i.id));
      record.pending = record.pending.filter(i => !acknowledged.has(i.id));
      store();
      if (status.state === 'in-progress' && status.visibilityVerified && sources.size === 0 && version === change) { permitted = true; onBlocked(false); }
    }).catch(() => { block(); }).finally(() => {
      flight = null;
      if (dirty && !stopped && !terminal) void flush();
    });
    return flight;
  }

  return {
    flush, accept,
    verify() { block(); return flush(); },
    canAnswer: () => permitted && !terminal && !stopped && sources.size === 0,
    lose(source: string, reason: VisibilityReason) {
      if (stopped || sources.has(source)) return;
      if (terminal) { sources.add(source); block(); return; }
      sources.add(source); change++; block();
      record.open ??= { id: visibilityId(), reason, startedAt: new Date(now()).toISOString() };
      if (reason === 'app-background') record.open.reason = reason;
      store(); onLoss(); void flush();
    },
    gain(source: string) {
      if (stopped || !sources.delete(source)) return;
      if (terminal) {
        if (!sources.size && record.open) {
          record.pending.push({ ...record.open, returnedAt: new Date(now()).toISOString() }); record.open = null;
          store(); void flush(true);
        }
        block(); return;
      }
      change++; block();
      if (!sources.size && record.open) { record.pending.push({ ...record.open, returnedAt: new Date(now()).toISOString() }); record.open = null; }
      store(); void flush();
    },
    dispose() { stopped = true; },
    snapshot,
    visible: () => sources.size === 0,
  };
}
