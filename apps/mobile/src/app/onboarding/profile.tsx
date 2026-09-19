import {
  DISPLAY_NAME_MAX,
  USERNAME_MAX,
  USERNAME_MIN,
  normalizeUsername,
  usernameErrorKey,
  validateUsername,
  type UsernameError,
} from '@bsocial/shared';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { OnboardingScreen } from '@/components/onboarding-screen';
import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { authClient } from '@/lib/auth-client';
import { submitStep } from '@/lib/onboarding';

const AVATAR_SIZE = 104;

type Availability =
  | { state: 'idle' | 'checking' }
  | { state: 'available' }
  | { state: 'unavailable'; reason: UsernameError | 'taken' };

async function uploadAvatar(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const form = new FormData();
  const name = asset.fileName ?? 'avatar.jpg';
  const type = asset.mimeType ?? 'image/jpeg';
  if (Platform.OS === 'web') {
    form.append('file', await (await fetch(asset.uri)).blob(), name);
  } else {
    // React Native's FormData accepts { uri, name, type } file descriptors.
    form.append('file', { uri: asset.uri, name, type } as unknown as Blob);
  }
  const { url } = await apiFetch<{ url: string }>('/api/uploads/avatar', { method: 'POST', body: form });
  return url;
}

// Step 4: nickname (@handle, required) + display name and photo (optional).
export default function ProfileStep() {
  const theme = useTheme();
  const { t } = useT();
  const { data: session } = authClient.useSession();
  const [username, setUsername] = useState(session?.user.username ?? '');
  const [name, setName] = useState(session?.user.name ?? '');
  const [image, setImage] = useState<string | null>(session?.user.image ?? null);
  const [availability, setAvailability] = useState<Availability>({ state: 'idle' });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Validate locally right away; ask the server (debounced) only for valid input.
  useEffect(() => {
    if (!username) return setAvailability({ state: 'idle' });
    const invalid = validateUsername(username);
    if (invalid) return setAvailability({ state: 'unavailable', reason: invalid });

    setAvailability({ state: 'checking' });
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch<{ available: boolean; reason?: UsernameError | 'taken' }>(
          `/api/username-available?username=${encodeURIComponent(username)}`,
        );
        if (!cancelled) {
          setAvailability(res.available ? { state: 'available' } : { state: 'unavailable', reason: res.reason ?? 'taken' });
        }
      } catch {
        if (!cancelled) setAvailability({ state: 'idle' });
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username]);

  async function pickPhoto() {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      setImage(await uploadAvatar(result.assets[0]));
    } catch {
      setError(t('onboarding.profile.error.photo'));
    } finally {
      setUploading(false);
    }
  }

  async function onContinue() {
    setError(null);
    setLoading(true);
    const code = await submitStep('profile', { username, name: name.trim(), image });
    setLoading(false);
    if (code) {
      // Any code that isn't a username complaint gets the generic sentence.
      setError(usernameError(code as UsernameError | 'taken') ?? t('onboarding.error.save'));
      if (code === 'taken') setAvailability({ state: 'unavailable', reason: 'taken' });
    }
  }

  // `too_short` / `too_long` carry the bounds; the rest ignore the extra vars.
  const usernameError = (code: UsernameError | 'taken') =>
    t(usernameErrorKey(code), { min: USERNAME_MIN, max: USERNAME_MAX });

  const handle = normalizeUsername(username);
  const unavailable = availability.state === 'unavailable';

  return (
    <OnboardingScreen
      step="profile"
      title={t('onboarding.profile.title')}
      subtitle={t('onboarding.profile.subtitle')}
      onContinue={onContinue}
      continueDisabled={availability.state !== 'available' || uploading}
      loading={loading}
      error={error}>
      <Pressable onPress={pickPhoto} style={styles.avatarWrap} accessibilityRole="button" accessibilityLabel={t('onboarding.profile.choosePhoto')}>
        <View>
          <View
            style={[
              styles.avatar,
              { backgroundColor: theme.backgroundElement, borderColor: theme.line, borderStyle: image ? 'solid' : 'dashed' },
            ]}>
            {uploading ? (
              <ActivityIndicator color={theme.primaryPress} />
            ) : image ? (
              <Image source={{ uri: image }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <Icon name="camera" size={34} color={theme.textSecondary} strokeWidth={1.8} />
            )}
          </View>
          <View style={[styles.plus, { backgroundColor: theme.primary, boxShadow: `0px 3px 0px ${theme.primaryPress}` }]}>
            <Icon name="plus" size={20} color={theme.onPrimary} strokeWidth={3} />
          </View>
        </View>
        <ThemedText type="linkPrimary" style={{ fontSize: 15 }}>
          {t(image ? 'onboarding.profile.changePhoto' : 'onboarding.profile.addPhoto')}
        </ThemedText>
      </Pressable>

      <View style={styles.group}>
        <View style={styles.labelRow}>
          <ThemedText type="label">{t('onboarding.profile.nickname')}</ThemedText>
          <Badge label={t('onboarding.profile.required')} tone="brand" />
        </View>
        <Field
          value={username}
          onChangeText={(v) => setUsername(v.replace(/\s/g, ''))}
          placeholder={t('onboarding.profile.nicknamePlaceholder')}
          maxLength={USERNAME_MAX + 1}
          autoComplete="username-new"
          error={unavailable}
          style={{ fontSize: 18 }}
          leading={<ThemedText style={{ fontFamily: FontFamily.bodyHeavy, color: theme.textSecondary, fontSize: 18 }}>@</ThemedText>}
          trailing={
            availability.state === 'checking' ? (
              <ActivityIndicator size="small" color={theme.textSecondary} />
            ) : availability.state === 'available' ? (
              <Icon name="check" size={20} color={theme.green} strokeWidth={2.8} />
            ) : null
          }
        />
        {availability.state === 'available' && (
          <ThemedText type="smallBold" style={{ color: theme.green, paddingLeft: 4 }}>
            {t('onboarding.profile.available', { handle })}
          </ThemedText>
        )}
        {unavailable && (
          <ThemedText type="smallBold" style={{ color: theme.red, paddingLeft: 4 }}>
            {usernameError(availability.reason)}
          </ThemedText>
        )}
      </View>

      <View style={styles.group}>
        <View style={styles.labelRow}>
          <ThemedText type="label">{t('onboarding.profile.displayName')}</ThemedText>
          <Badge label={t('onboarding.profile.optional')} />
        </View>
        <Field
          value={name}
          onChangeText={setName}
          placeholder={t('onboarding.profile.displayName')}
          maxLength={DISPLAY_NAME_MAX}
          autoCapitalize="words"
          autoCorrect
          autoComplete="name"
        />
        <ThemedText type="small" themeColor="textSecondary" style={{ paddingLeft: 4 }}>
          {name.trim() || !handle
            ? t('onboarding.profile.displayNameHint')
            : t('onboarding.profile.fallsBackToHandle', { handle })}
        </ThemedText>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  avatarWrap: { alignItems: 'center', gap: Spacing.sm },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: AVATAR_SIZE, height: AVATAR_SIZE },
  plus: {
    position: 'absolute',
    right: 0,
    bottom: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  group: { gap: Spacing.sm },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
});
