import { Redirect } from 'expo-router';

import { useSession } from '@/stores/session';

export default function Index() {
  const status = useSession((s) => s.status);
  const user = useSession((s) => s.user);
  if (status === 'guest') return <Redirect href="/builder/idea" />;
  if (status !== 'signedIn') return <Redirect href="/welcome" />;
  if (user && user.onboardingCompleted === false) return <Redirect href="/onboarding" />;
  return <Redirect href="/home" />;
}
