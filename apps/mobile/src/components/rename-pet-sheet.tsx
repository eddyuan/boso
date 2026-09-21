import { PET_NAME_MAX } from '@bsocial/shared';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ModalSheet } from '@/components/modal-sheet';
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
 */
export function RenamePetSheet({
  open,
  currentName,
  onClose,
  onRenamed,
}: {
  open: boolean;
  currentName: string;
  onClose: () => void;
  onRenamed: (name: string) => void;
}) {
  const { t } = useT();
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reopening after a cancel should start from the real name, not the abandoned edit.
  useEffect(() => {
    if (open) {
      setName(currentName);
      setError(null);
    }
  }, [open, currentName]);

  const trimmed = name.trim();
  const unchanged = trimmed === currentName;

  async function save() {
    if (!trimmed || unchanged) return;
    setSaving(true);
    setError(null);
    try {
      const r = await apiFetch<{ pet: { name: string } }>('/api/pets', {
        method: 'PATCH',
        body: JSON.stringify({ name: trimmed }),
      });
      onRenamed(r.pet.name);
      onClose();
    } catch {
      setError(t('pet.rename.error'));
    }
    setSaving(false);
  }

  return (
    <ModalSheet open={open} onClose={onClose} title={t('pet.rename.title')}>
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
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.md },
});
