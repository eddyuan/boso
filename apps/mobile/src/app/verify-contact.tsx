import { getContactStatus, isAppleRelayEmail } from '@bsocial/shared';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen, TitleBlock } from '@/components/auth-form';
import { Mascot } from '@/components/mascot/mascot';
import { ThemedText } from '@/components/themed-text';
import { IconTile, OptionCard } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { useT } from '@/lib/i18n';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authClient } from '@/lib/auth-client';

// Shown to signed-in accounts without a verified email or phone (unverified
// email sign-ups, Apple "Hide My Email" users). The root layout lifts this gate
// as soon as the session shows a verified contact.
export default function VerifyContactScreen() {
  const theme = useTheme();
  const { t } = useT();
  const { data: session } = authClient.useSession();
  if (!session) return null;

  const { hasRealEmail } = getContactStatus(session.user);
  const hiddenAppleEmail = isAppleRelayEmail(session.user.email);

  return (
    <Screen
      footer={
        <Pressable onPress={() => authClient.signOut()} accessibilityRole="button" style={styles.signOut}>
          <ThemedText type="link" themeColor="textSecondary">
            {t('dialog.signOut')}
          </ThemedText>
        </Pressable>
      }>
      <View style={styles.mascot}>
        <Mascot mood="thinking" size={120} />
      </View>
      <TitleBlock
        title={t('contact.reach.title')}
        subtitle={t(hiddenAppleEmail ? 'contact.reach.apple' : 'contact.reach.body')}
      />
      <View style={styles.options}>
        {hasRealEmail && (
          <OptionCard
            title={t('contact.verifyAddress', { address: session.user.email })}
            description={t('contact.codeByEmail')}
            onPress={() => router.push({ pathname: '/email', params: { mode: 'verify' } })}
            leading={
              <IconTile tone="brand">
                <Icon name="mail" color={theme.primaryInk} />
              </IconTile>
            }
            trailing={<Icon name="chevron" size={20} color={theme.textSecondary} />}
          />
        )}
        <OptionCard
          title={t(hasRealEmail ? 'contact.email.useDifferent' : 'contact.email.addShort')}
          description={t('contact.codeByEmail')}
          onPress={() => router.push({ pathname: '/email', params: { mode: 'change' } })}
          leading={
            <IconTile>
              <Icon name="mail" />
            </IconTile>
          }
          trailing={<Icon name="chevron" size={20} color={theme.textSecondary} />}
        />
        <OptionCard
          title={t('contact.phone.addNumber')}
          description={t('contact.codeBySms')}
          onPress={() => router.push('/phone')}
          leading={
            <IconTile>
              <Icon name="phone" />
            </IconTile>
          }
          trailing={<Icon name="chevron" size={20} color={theme.textSecondary} />}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mascot: { alignItems: 'center', marginTop: Spacing.xl },
  options: { gap: Spacing.sm + 4, marginTop: Spacing.lg },
  signOut: { alignItems: 'center', paddingVertical: Spacing.sm },
});
