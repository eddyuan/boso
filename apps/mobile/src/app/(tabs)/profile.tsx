import { INTERESTS, getDisplayName, getPetSpecies } from '@bsocial/shared';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/auth-form';
import { CompanionArt } from '@/components/mascot/companions';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Badge, Card, ChipGroup, Divider, IconTile, ListRow } from '@/components/ui/controls';
import { Icon } from '@/components/ui/icon';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';
import { authClient } from '@/lib/auth-client';

type Pet = { id: string; name: string; species: string; autoApprove: boolean };

export default function ProfileTab() {
  const theme = useTheme();
  const { data: session } = authClient.useSession();
  const [pet, setPet] = useState<Pet | null>(null);

  useFocusEffect(
    useCallback(() => {
      apiFetch<{ pet: Pet | null }>('/api/pets')
        .then((r) => setPet(r.pet))
        .catch(() => {});
    }, []),
  );

  const user = session?.user;
  const interests = user?.interests ?? [];
  const species = pet ? getPetSpecies(pet.species) : null;

  return (
    <Screen>
      <View style={styles.profile}>
        {user?.image ? (
          <Image source={{ uri: user.image }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <ThemedText style={{ fontFamily: FontFamily.display, fontSize: 30, color: theme.onPrimary }}>
              {(user?.name?.trim() || user?.username || '?').slice(0, 1).toUpperCase()}
            </ThemedText>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <ThemedText type="subtitle" numberOfLines={1}>
            {user ? getDisplayName(user) : ''}
          </ThemedText>
          {user?.name?.trim() && user.username ? (
            <ThemedText type="small" themeColor="textSecondary">
              @{user.username}
            </ThemedText>
          ) : null}
        </View>
      </View>

      {interests.length > 0 && (
        <ChipGroup gap={8}>
          {interests.map((value) => {
            const interest = INTERESTS.find((i) => i.value === value);
            return (
              <View key={value} style={[styles.interest, { backgroundColor: theme.primarySoft }]}>
                <ThemedText type="small" style={{ color: theme.primaryInk, fontFamily: FontFamily.bodyBold }}>
                  {interest ? `${interest.emoji} ${interest.label}` : value}
                </ThemedText>
              </View>
            );
          })}
        </ChipGroup>
      )}

      {pet && species && (
        <Card style={styles.petCard}>
          <View style={[styles.petHalo, { backgroundColor: theme.primarySoft }]}>
            <CompanionArt species={pet.species} size={80} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <ThemedText type="header">{pet.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Your {species.label.toLowerCase()} · {species.moves.toLowerCase()} on the map
            </ThemedText>
            <Badge
              tone="brand"
              label={pet.autoApprove ? 'Posts on its own' : 'Asks you first'}
              icon={<Icon name={pet.autoApprove ? 'check' : 'bell'} size={12} color={theme.primaryInk} strokeWidth={3} />}
            />
          </View>
        </Card>
      )}

      <Card>
        <ListRow
          icon={
            <IconTile>
              <Icon name="person" />
            </IconTile>
          }
          title="Account"
          subtitle="Contact, sign-in methods"
          trailing={<Icon name="chevron" size={20} color={theme.textSecondary} />}
          onPress={() => router.push('/account')}
        />
        <Divider />
        <ListRow
          icon={
            <IconTile>
              <Icon name="laptop" />
            </IconTile>
          }
          title="Signed-in devices"
          trailing={<Icon name="chevron" size={20} color={theme.textSecondary} />}
          onPress={() => router.push('/devices')}
        />
      </Card>

      <Button
        variant="danger"
        label="Sign out"
        icon={<Icon name="logout" size={20} color={theme.red} />}
        onPress={() => authClient.signOut()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  interest: { paddingHorizontal: 12, height: 32, borderRadius: Radius.pill, justifyContent: 'center' },
  petCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, padding: Spacing.lg },
  petHalo: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center' },
});
