import { MIN_AGE } from '@bsocial/shared';
import { StyleSheet, View } from 'react-native';

import { Screen, TitleBlock } from '@/components/auth-form';
import { Mascot } from '@/components/mascot/mascot';
import { RestartProfileButton } from '@/components/restart-profile-button';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';
import { Spacing } from '@/constants/theme';
import { authClient } from '@/lib/auth-client';

export default function AgeRestrictedScreen() {
  const { t } = useT();
  return (
    <Screen
      centered
      footer={
        <>
          <Button label={t('dialog.signOut')} onPress={() => authClient.signOut()} />
          <RestartProfileButton />
        </>
      }>
      <View style={styles.content}>
        <Mascot mood="sleepy" size={140} />
        {/* The age appeared twice, once hardcoded: changing MIN_AGE used to
            leave the heading claiming 18 regardless. */}
        <TitleBlock
          align="center"
          title={t('ageGate.headline', { age: MIN_AGE })}
          subtitle={t('ageGate.body', { age: MIN_AGE })}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', gap: Spacing.lg },
});
