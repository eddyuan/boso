import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useConfirm } from '@/components/confirm-dialog';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ErrorText } from '@/components/ui/controls';
import { Spacing } from '@/constants/theme';
import { apiFetch } from '@/lib/api';
import { authClient, refreshSession } from '@/lib/auth-client';

const MESSAGE =
  'This wipes your birthday, nickname, profile, interests and pet (including its posts and activity), then restarts onboarding. Your account and sign-in methods are kept.';

// Admin-only tool for testing onboarding. Renders nothing for other users
// (the API also rejects non-admins).
export function RestartProfileButton() {
  const { data: session } = authClient.useSession();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session?.user.isAdmin) return null;

  async function restart() {
    setError(null);
    setLoading(true);
    try {
      await apiFetch('/api/me/onboarding/reset', { method: 'POST' });
      // Session now shows onboarding as incomplete; the root layout switches
      // to the first onboarding step.
      refreshSession();
    } catch {
      setError("Couldn't restart your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Button
        variant="danger"
        label="Restart profile (admin)"
        onPress={async () => {
          // Admin-only, so deliberately untranslated like the rest of this button.
          if (await confirm({ title: 'Restart profile?', message: MESSAGE, action: 'Restart', destructive: true })) {
            restart();
          }
        }}
        loading={loading}
      />
      <ErrorText message={error} />
      <ThemedText type="caption" style={styles.center}>
        Only visible to admins
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs, marginTop: Spacing.sm },
  center: { textAlign: 'center' },
});
