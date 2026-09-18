import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BackButton } from '@/components/ui/controls';

// Back button + centered title for settings-style screens.
export function PageHeader({ title }: { title: string }) {
  return (
    <View style={styles.header}>
      <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <ThemedText type="header" numberOfLines={1} style={styles.title}>
        {title}
      </ThemedText>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', height: 44, gap: 12 },
  title: { flex: 1, textAlign: 'center' },
  spacer: { width: 44 },
});
