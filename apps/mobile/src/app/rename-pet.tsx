import { PET_NAME_MAX } from '@bsocial/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SheetScreen } from '@/components/sheet-screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ErrorText } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { Spacing } from '@/constants/theme';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';

/**
 * Renaming the pet.
 *
 * Open from the first minute. This was advertised on the bond screen as a level-2
 * unlock, which was wrong twice: nothing enforced it, and making somebody earn the
 * right to fix a typo in their companion's name is a bad first hour.
 *
 * A rename reaches every place the pet is *labelled*, since those all read the name
 * through a join. It does not rewrite prose that already contains it — a diary
 * entry, the pet's reasoning on a past decision — because that would be falsifying
 * a record of what was written. The copy says so rather than leaving it to be
 * found out.
 *
 * The current name arrives as a param rather than being fetched again: the pet tab
 * already has it, and this screen is opened from there. The tab refetches on focus,
 * so returning with a new name is enough to update it — no callback to thread back.
 */
export default function RenamePetScreen() {
  const { t } = useT();
  const { current } = useLocalSearchParams<{ current?: string }>();
  const currentName = current ?? '';
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const unchanged = trimmed === currentName;

  async function save() {
    if (!trimmed || unchanged) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/api/pets', { method: 'PATCH', body: JSON.stringify({ name: trimmed }) });
      router.back();
    } catch {
      setError(t('pet.rename.error'));
      setSaving(false);
    }
  }

  return (
    <SheetScreen title={t('pet.rename.title')}>
      <View style={styles.body}>
        <Field
          value={name}
          onChangeText={setName}
          maxLength={PET_NAME_MAX}
          autoCapitalize="words"
          autoFocus
          onSubmitEditing={save}
          style={{ fontSize: 18 }}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {t('pet.rename.note')}
        </ThemedText>
        <ErrorText message={error} />
        <Button
          label={t('pet.rename.save')}
          onPress={save}
          loading={saving}
          disabled={!trimmed || unchanged || saving}
        />
      </View>
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.md },
});
