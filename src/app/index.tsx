import AppTabs from '@/components/app-tabs';
import { useAuth } from '@/context/auth-context';
import { tabsFor } from '@/navigation/role-tabs';

/** The signed-in app: the role's tabs. Screens pushed over them (e.g. a batch) sit above this route. */
export default function SignedInTabs() {
  const { user } = useAuth();
  return user?.role ? <AppTabs tabs={tabsFor(user.role)} /> : null;
}
