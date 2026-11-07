import { Redirect } from 'expo-router';

/** The New tab button opens the builder modal; this route only exists for deep links to /new. */
export default function NewTab() {
  return <Redirect href="/builder/idea" />;
}
