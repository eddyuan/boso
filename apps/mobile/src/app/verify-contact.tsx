import { getContactStatus, isAppleRelayEmail } from '@bsocial/shared';
import { Link } from 'expo-router';

import { AuthScreen, PrimaryButton } from '@/components/auth-form';
import { SecondaryButton } from '@/components/social-sign-in';
import { ThemedText } from '@/components/themed-text';
import { authClient } from '@/lib/auth-client';

// Shown to signed-in accounts without a verified email or phone (unverified
// email sign-ups, Apple "Hide My Email" users). The root layout lifts this gate
// as soon as the session shows a verified contact.
export default function VerifyContactScreen() {
  const { data: session } = authClient.useSession();
  if (!session) return null;

  const { hasRealEmail } = getContactStatus(session.user);
  const hiddenAppleEmail = isAppleRelayEmail(session.user.email);

  return (
    <AuthScreen title="Confirm how to reach you">
      <ThemedText themeColor="textSecondary">
        {hiddenAppleEmail
          ? 'You chose to hide your email with Apple. Add an email or phone number so we can reach you and help you recover your account.'
          : 'Verify your email or add a phone number to finish setting up your account.'}
      </ThemedText>

      {hasRealEmail && (
        <Link href={{ pathname: '/email', params: { mode: 'verify' } }} asChild>
          <PrimaryButton label={`Verify ${session.user.email}`} onPress={() => {}} />
        </Link>
      )}
      <Link href={{ pathname: '/email', params: { mode: 'change' } }} asChild>
        <SecondaryButton label={hasRealEmail ? 'Use a different email' : 'Add email'} />
      </Link>
      <Link href="/phone" asChild>
        <SecondaryButton label="Add phone number" />
      </Link>

      <ThemedText type="link" onPress={() => authClient.signOut()}>
        Sign out
      </ThemedText>
    </AuthScreen>
  );
}
