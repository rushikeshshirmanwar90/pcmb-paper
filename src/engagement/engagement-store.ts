// The student's progress (XP, level, today's goal, streak) as the server last
// reported it. The server computes everything; this store only remembers the
// latest answer and tells the screens. It is filled two ways:
//   - GET /api/engagement/me (the provider loads it on start and on return to the app)
//   - the `engagement` field of practice, self-assessment and test-submit responses
// Plain TypeScript with no React Native imports, so the unit tests can run it.

/** papers/src/lib/engagement/award.ts → MeSnapshot */
export interface MeSnapshot {
  enabled: true;
  xp: {
    total: number;
    level: number;
    levelStartXp: number;
    nextLevelXp: number;
    intoLevel: number;
    toNext: number;
    /** 0 ≤ progress < 1 within the current level */
    progress: number;
  };
  today: { date: string; xp: number; goal: number; goalKey: string; goalMet: boolean; practiceXp: number; practiceCap: number };
  streak: { current: number; longest: number; freezes: number; maxFreezes: number; securedToday: boolean };
}

/** The `engagement` field of a learning response (null when gamification failed on the server). */
export type EngagementField = { enabled: true; xpAwarded: number; duplicate: boolean; me: MeSnapshot } | { enabled: false };

/** GET /api/engagement/me */
export type MeResponse = MeSnapshot | { enabled: false };

export interface EngagementState {
  /** The signed-in student these numbers belong to. */
  owner: string | null;
  /** null until the server has said; false when the tuition has engagement switched off. */
  enabled: boolean | null;
  me: MeSnapshot | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  /** The last load failed for lack of a connection (numbers shown are the last known). */
  offline: boolean;
}

export interface LoadToken {
  owner: string | null;
  seq: number;
}

const initial = (owner: string | null): EngagementState => ({ owner, enabled: null, me: null, status: 'idle', error: null, offline: false });

export function createEngagementStore() {
  let state = initial(null);
  // Bumped by every learning response, so a slower /me load that started
  // earlier can't overwrite newer numbers.
  let seq = 0;
  const listeners = new Set<() => void>();
  const set = (next: EngagementState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };

  return {
    get: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** A different student signed in (or out): forget the last one's numbers. */
    reset(owner: string | null) {
      if (state.owner === owner) return;
      seq++;
      set(initial(owner));
    },
    beginLoad(): LoadToken {
      if (state.status !== 'loading') set({ ...state, status: state.me || state.enabled === false ? state.status : 'loading' });
      return { owner: state.owner, seq };
    },
    finishLoad(token: LoadToken, res: MeResponse) {
      if (token.owner !== state.owner) return;
      if (token.seq !== seq) {
        // A learning response arrived while this load was under way: it is newer.
        set({ ...state, status: 'ready', error: null, offline: false });
        return;
      }
      set(res.enabled ? { ...state, enabled: true, me: res, status: 'ready', error: null, offline: false } : { ...state, enabled: false, me: null, status: 'ready', error: null, offline: false });
    },
    failLoad(token: LoadToken, message: string, offline: boolean) {
      if (token.owner !== state.owner) return;
      set({ ...state, status: 'error', error: message, offline });
    },
    /**
     * The `engagement` field of a response. `owner` is who was signed in when the
     * request was sent; a reply that lands after a sign-out is ignored.
     */
    publish(field: EngagementField | null | undefined, owner: string | null) {
      if (!field || owner !== state.owner) return;
      seq++;
      set(field.enabled ? { ...state, enabled: true, me: field.me, status: 'ready', error: null, offline: false } : { ...state, enabled: false, me: null, status: 'ready', error: null, offline: false });
    },
  };
}

export type EngagementStore = ReturnType<typeof createEngagementStore>;

/** The app's one store. */
export const engagementStore = createEngagementStore();
