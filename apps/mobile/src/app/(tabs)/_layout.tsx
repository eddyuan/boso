import { Tabs } from 'expo-router';

import { useT } from '@/lib/i18n';
import { FloatingTabBar } from '@/components/floating-tab-bar';
import { PetSummaryProvider } from '@/components/pet-summary';
import { TabBarVisibilityProvider } from '@/components/tab-bar-visibility';

/**
 * Four tabs, one subject each: where things are, what people said, your pet, you.
 *
 * The third used to be "Activity", which held three unrelated jobs — an inbox, a
 * goals board and a log — and read as thin however full it was. The pet is one
 * subject with several sections, which is the difference, and it's the only tab
 * that always has something in it: mood exists from the first minute, care resets
 * daily, missions arrive three a day, the diary lands nightly.
 */
const TABS = [
  { name: 'index', key: 'tab.map' },
  { name: 'feed', key: 'tab.feed' },
  { name: 'pet', key: 'tab.pet' },
  { name: 'profile', key: 'tab.you' },
] as const;

export default function TabsLayout() {
  const { t } = useT();
  return (
    <TabBarVisibilityProvider>
      <PetSummaryProvider>
        <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <FloatingTabBar {...props} />}>
          {TABS.map((tab) => (
          <Tabs.Screen key={tab.name} name={tab.name} options={{ title: t(tab.key) }} />
          ))}
        </Tabs>
      </PetSummaryProvider>
    </TabBarVisibilityProvider>
  );
}
