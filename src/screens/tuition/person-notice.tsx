import { useSyncExternalStore } from 'react';
import { Notice } from '@/components/kit';
import { useAuth } from '@/context/auth-context';

type Kind = 'student' | 'teacher';
type Feedback = { message: string; owner: string; id?: string };
let notices: Partial<Record<Kind, Feedback>> = {};
const listeners = new Set<() => void>();
function setNotice(kind: Kind, notice?: Feedback) {
  notices = { ...notices, [kind]: notice };
  listeners.forEach((listener) => listener());
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function usePersonFeedback(kind: Kind, id?: string) {
  const { user } = useAuth();
  return (message: string) => { if (user) setNotice(kind, { message, owner: user.id, id }); };
}
export function PersonNotice({ kind, id }: { kind: Kind; id?: string }) {
  const { user } = useAuth();
  const notice = useSyncExternalStore(subscribe, () => notices[kind], () => undefined);
  if (!notice || notice.owner !== user?.id || (id && id !== notice.id)) return null;
  return <Notice tone="success" live text={notice.message} onDismiss={() => setNotice(kind)} />;
}
