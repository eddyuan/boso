import * as Contacts from 'expo-contacts';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { TitleBlock } from '@/components/auth-form';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { ThemedText } from '@/components/themed-text';
import { Badge, Card, Divider } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { findFriendsFromContacts, type FriendMatch } from '@/lib/contacts';
import { submitStep } from '@/lib/onboarding';

const AVATAR_TINTS = [
  ['#FFD8C2', '#8A3A14'],
  ['#CDEBD8', '#1F6B40'],
  ['#DCD6FF', '#3F358F'],
  ['#FFE7A8', '#7A5600'],
];

function Avatar({ match, index }: { match: FriendMatch; index: number }) {
  const [bg, fg] = AVATAR_TINTS[index % AVATAR_TINTS.length];
  if (match.image) return <Image source={{ uri: match.image }} style={styles.avatar} />;
  return (
    <View style={[styles.avatar, { backgroundColor: bg }]}>
      <ThemedText style={{ fontFamily: FontFamily.display, fontSize: 18, color: fg }}>
        {(match.name || match.username || '?').slice(0, 1).toUpperCase()}
      </ThemedText>
    </View>
  );
}

export default function ContactsStep() {
  const theme = useTheme();
  const [matches, setMatches] = useState<FriendMatch[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = Platform.OS !== 'web';

  async function finish(granted: boolean) {
    setError(null);
    setLoading(true);
    const code = await submitStep('contacts', { granted });
    setLoading(false);
    if (code) setError("Couldn't save. Please try again.");
  }

  async function findFriends() {
    setError(null);
    setLoading(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        setLoading(false);
        return finish(false);
      }
      setMatches(await findFriendsFromContacts());
    } catch {
      setError("Couldn't check your contacts. You can try again later.");
    } finally {
      setLoading(false);
    }
  }

  // After matching: show results, then continue.
  if (matches) {
    const count = matches.length;
    return (
      <OnboardingScreen
        step="contacts"
        title={count ? `${count} friend${count === 1 ? '' : 's'} already here` : 'No friends here yet'}
        subtitle={count ? "Your pet can follow them for you once you're set up." : "We'll let you know when someone from your contacts joins."}
        onContinue={() => finish(true)}
        loading={loading}
        error={error}>
        {count > 0 && (
          <Card>
            {matches.map((m, i) => (
              <View key={m.id}>
                {i > 0 && <Divider />}
                <View style={styles.row}>
                  <Avatar match={m} index={i} />
                  <View style={styles.rowText}>
                    <ThemedText type="label" style={{ fontSize: 16 }}>
                      {m.name || `@${m.username}`}
                    </ThemedText>
                    {m.username && (
                      <ThemedText type="small" themeColor="textSecondary">
                        @{m.username}
                      </ThemedText>
                    )}
                  </View>
                  <Badge label="In contacts" />
                </View>
              </View>
            ))}
          </Card>
        )}
      </OnboardingScreen>
    );
  }

  return (
    <OnboardingScreen
      step="contacts"
      centered
      continueLabel={supported ? 'Find friends' : 'Continue'}
      onContinue={supported ? findFriends : () => finish(false)}
      onSkip={supported ? () => finish(false) : undefined}
      loading={loading}
      error={error}>
      <View style={styles.bubbles}>
        <View style={[styles.bubble, styles.bubbleSide, { backgroundColor: '#FFD8C2', borderColor: theme.background, marginRight: -18 }]}>
          <ThemedText style={[styles.bubbleText, { color: '#8A3A14' }]}>J</ThemedText>
        </View>
        <View style={[styles.bubble, { backgroundColor: theme.primary, borderColor: theme.background, zIndex: 1 }]}>
          <Icon name="users" size={48} color={theme.onPrimary} strokeWidth={2} />
        </View>
        <View style={[styles.bubble, styles.bubbleSide, { backgroundColor: '#CDEBD8', borderColor: theme.background, marginLeft: -18 }]}>
          <ThemedText style={[styles.bubbleText, { color: '#1F6B40' }]}>S</ThemedText>
        </View>
      </View>
      <TitleBlock title="Find your friends" subtitle="See who from your contacts is already on Tielo." />
      <Card style={styles.privacy}>
        <Icon name="shield" color={theme.green} />
        <ThemedText type="small" style={{ flex: 1 }}>
          {supported
            ? 'Numbers and emails are scrambled on your phone before we check them. We never store your contacts.'
            : 'Finding friends from contacts is available in the mobile app.'}
        </ThemedText>
      </Card>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.lg, paddingVertical: 12 },
  rowText: { flex: 1, minWidth: 0 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  bubbles: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  bubble: { width: 108, height: 108, borderRadius: 54, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  bubbleSide: { width: 84, height: 84, borderRadius: 42 },
  bubbleText: { fontFamily: FontFamily.display, fontSize: 30, lineHeight: 36 },
  privacy: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'flex-start', marginTop: Spacing.sm },
});
