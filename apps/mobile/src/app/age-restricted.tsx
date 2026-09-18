import { MIN_AGE } from '@bsocial/shared';
import { StyleSheet, View } from 'react-native';

import { Screen, TitleBlock } from '@/components/auth-form';
import { Mascot } from '@/components/mascot/mascot';
import { RestartProfileButton } from '@/components/restart-profile-button';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { authClient } from '@/lib/auth-client';

export default function AgeRestrictedScreen() {
  return (
    <Screen
      centered
      footer={
        <>
          <Button label="Sign out" onPress={() => authClient.signOut()} />
          <RestartProfileButton />
        </>
      }>
      <View style={styles.content}>
        <Mascot mood="sleepy" size={140} />
        <TitleBlock
          align="center"
          title="See you when you're 18"
          subtitle={`You must be at least ${MIN_AGE} years old to use Tielo.`}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', gap: Spacing.lg },
});
