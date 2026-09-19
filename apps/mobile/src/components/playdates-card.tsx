import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CompanionArt } from '@/components/mascot/companions';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/controls';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';

export type PlaydateCandidate = {
  petId: string;
  petName: string;
  species: string;
  ownerName: string | null;
  distanceKm: number;
  affinity: number;
};

export type PlaydateInvite = {
  id: string;
  otherPetName: string;
  otherSpecies: string;
  placeName: string | null;
  expiresAt: string;
};

export type Playdates = {
  candidates: PlaydateCandidate[];
  invites: PlaydateInvite[];
  sent: PlaydateInvite[];
};

/**
 * Meeting up, for real.
 *
 * Only ever an invitation: the other person has to accept, and the list is
 * built from people genuinely nearby rather than padded with bots, because a
 * playdate that can't actually happen is worse than no playdate. Proposals
 * expire instead of lingering — proximity was the whole basis for suggesting it.
 */
export function PlaydatesCard({ data, onChange }: { data: Playdates; onChange: () => void }) {
  const theme = useTheme();
  const [busy, setBusy] = useState<string | null>(null);

  const { candidates, invites, sent } = data;
  if (candidates.length === 0 && invites.length === 0 && sent.length === 0) return null;

  const answer = async (id: string, decision: 'accept' | 'decline') => {
    setBusy(id);
    try {
      await apiFetch('/api/me/playdates', { method: 'PATCH', body: JSON.stringify({ id, decision }) });
      onChange();
    } catch {
      // A failed tap shouldn't produce an error screen; the list just stays put.
    }
    setBusy(null);
  };

  const propose = async (toPetId: string) => {
    setBusy(toPetId);
    try {
      await apiFetch('/api/me/playdates', { method: 'POST', body: JSON.stringify({ toPetId }) });
      onChange();
    } catch {
      // Same: silent. The most likely cause is someone else got there first.
    }
    setBusy(null);
  };

  return (
    <Card style={styles.card}>
      <ThemedText type="label">Playdates</ThemedText>

      {invites.map((invite) => (
        <View key={invite.id} style={styles.inviteBlock}>
          <View style={styles.row}>
            <View style={[styles.art, { backgroundColor: theme.primarySoft }]}>
              <CompanionArt species={invite.otherSpecies} size={28} />
            </View>
            <View style={styles.rowText}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {invite.otherPetName} wants to meet
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {invite.placeName ? `At ${invite.placeName}` : 'Somewhere between you'} · {expiry(invite.expiresAt)}
              </ThemedText>
            </View>
          </View>
          <View style={styles.buttons}>
            <Button
              label="Yes, let's"
              onPress={() => answer(invite.id, 'accept')}
              disabled={busy === invite.id}
              style={{ flex: 1 }}
            />
            <Button
              variant="secondary"
              label="Not now"
              onPress={() => answer(invite.id, 'decline')}
              disabled={busy === invite.id}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ))}

      {sent.map((invite) => (
        <View key={invite.id} style={styles.row}>
          <View style={[styles.art, { backgroundColor: theme.backgroundElement }]}>
            <CompanionArt species={invite.otherSpecies} size={28} />
          </View>
          <View style={styles.rowText}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {invite.otherPetName}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              Waiting on them · {expiry(invite.expiresAt)}
            </ThemedText>
          </View>
          <Badge label="Asked" />
        </View>
      ))}

      {candidates.length > 0 && (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {invites.length > 0 || sent.length > 0 ? 'Also nearby' : 'Nearby right now'}
          </ThemedText>
          {candidates.slice(0, 4).map((c) => (
            <View key={c.petId} style={styles.row}>
              <View style={[styles.art, { backgroundColor: theme.primarySoft }]}>
                <CompanionArt species={c.species} size={28} />
              </View>
              <View style={styles.rowText}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {c.petName}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {[
                    c.ownerName?.trim(),
                    `${c.distanceKm.toFixed(1)} km`,
                    // Familiarity is the useful signal here: asking someone your
                    // pet already knows is a different proposition to a stranger.
                    c.affinity > 0 ? 'met before' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </ThemedText>
              </View>
              <Button
                variant="secondary"
                label="Ask"
                onPress={() => propose(c.petId)}
                disabled={busy === c.petId}
              />
            </View>
          ))}
        </>
      )}
    </Card>
  );
}

/** Proposals go stale, so the window is the useful part, not the timestamp. */
function expiry(iso: string): string {
  const hours = (new Date(iso).getTime() - Date.now()) / 3_600_000;
  if (hours <= 0) return 'Expired';
  if (hours < 1) return `${Math.round(hours * 60)} min left`;
  if (hours < 24) return `${Math.round(hours)}h left`;
  return `${Math.round(hours / 24)}d left`;
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, gap: Spacing.md },
  inviteBlock: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  art: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  buttons: { flexDirection: 'row', gap: Spacing.sm },
});
