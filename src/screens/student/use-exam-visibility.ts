import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { createExamVisibility, HEARTBEAT_MS } from './exam-visibility';
import { loadVisibility, saveVisibility } from '@/services/attempt-store';
import { studentApi, type Attempt, type TestQuestion } from '@/services/student-api';

export function useExamVisibility({ userId, testId, attempt, focused, splitBlocked, skew, onStatus, onLoss }: {
  userId: string; testId: string; attempt: Attempt; focused: boolean; splitBlocked: boolean; skew: React.RefObject<number>;
  onStatus: (attempt: Attempt, questions?: TestQuestion[]) => void; onLoss: () => void;
}) {
  const [blocked, setBlocked] = useState(true);
  const controller = useRef<ReturnType<typeof createExamVisibility<Attempt>> | null>(null);
  const callbacks = useRef({ onStatus, onLoss });
  useEffect(() => { callbacks.current = { onStatus, onLoss }; }, [onStatus, onLoss]);
  useEffect(() => {
    const tracker = createExamVisibility<Attempt>({
      startedAt: attempt.startedAt, resumeVersion: attempt.resumeVersion ?? 0, recovered: loadVisibility(userId, testId),
      now: () => Date.now() + skew.current, clockSkew: () => skew.current,
      persist: record => { saveVisibility(userId, testId, record); }, onBlocked: setBlocked,
      send: async packet => {
        const response = await studentApi.reportVisibility(testId, packet);
        callbacks.current.onStatus(response.attempt, response.questions);
        return response.attempt;
      }, onStatus: () => {}, onLoss: () => callbacks.current.onLoss(),
    });
    controller.current = tracker;
    if (AppState.currentState !== 'active') tracker.lose('app', 'app-background');
    const state = AppState.addEventListener('change', next => {
      if (next === 'active') { tracker.gain('app'); void tracker.verify(); }
      else tracker.lose('app', next === 'inactive' ? 'app-inactive' : 'app-background');
    });
    const blur = Platform.OS === 'android' ? AppState.addEventListener('blur', () => tracker.lose('android-focus', 'focus-loss')) : null;
    const focus = Platform.OS === 'android' ? AppState.addEventListener('focus', () => { tracker.gain('android-focus'); void tracker.verify(); }) : null;
    const timer = setInterval(() => void tracker.flush(), HEARTBEAT_MS);
    void tracker.flush();
    return () => {
      tracker.lose('screen', 'screen-focus-loss'); tracker.dispose(); controller.current = null;
      state.remove(); blur?.remove(); focus?.remove(); clearInterval(timer);
    };
    // The controller keeps generations and callback refs current without a remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, testId, attempt.startedAt, skew]);
  const { state: attemptState, resumeVersion } = attempt;
  useEffect(() => {
    controller.current?.accept({ state: attemptState, resumeVersion });
    if (attemptState === 'in-progress') void controller.current?.flush();
  }, [attemptState, resumeVersion]);
  useEffect(() => { if (focused) controller.current?.gain('screen'); else controller.current?.lose('screen', 'screen-focus-loss'); }, [focused]);
  useEffect(() => { if (splitBlocked) controller.current?.lose('split', 'split-screen'); else controller.current?.gain('split'); }, [splitBlocked]);
  const visible = useCallback(() => controller.current?.visible() ?? false, []);
  const canAnswer = useCallback(() => controller.current?.canAnswer() ?? false, []);
  return { blocked, visible, canAnswer };
}
