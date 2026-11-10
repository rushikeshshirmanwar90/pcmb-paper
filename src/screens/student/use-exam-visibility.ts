import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createExamVisibility, HEARTBEAT_MS } from './exam-visibility';
import { trackAppBackground } from './exam-app-state';
import { loadVisibility, saveVisibility } from '@/services/attempt-store';
import { studentApi, type Attempt, type TestQuestion } from '@/services/student-api';

export function useExamVisibility({ userId, testId, attempt, skew, onStatus, onLoss }: {
  userId: string; testId: string; attempt: Attempt; skew: React.RefObject<number>;
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
    const background = trackAppBackground(AppState, tracker);
    const timer = setInterval(() => { background.sync(); void tracker.flush(); }, HEARTBEAT_MS);
    void tracker.flush();
    return () => {
      tracker.dispose(); controller.current = null;
      background.dispose(); clearInterval(timer);
    };
    // The controller keeps generations and callback refs current without a remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, testId, attempt.startedAt, skew]);
  const { state: attemptState, resumeVersion } = attempt;
  useEffect(() => {
    controller.current?.accept({ state: attemptState, resumeVersion });
    if (attemptState === 'in-progress') void controller.current?.flush();
  }, [attemptState, resumeVersion]);
  const visible = useCallback(() => controller.current?.visible() ?? false, []);
  const canAnswer = useCallback(() => controller.current?.canAnswer() ?? false, []);
  return { blocked, visible, canAnswer };
}
