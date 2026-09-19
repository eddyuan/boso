import { Tabs } from 'expo-router';

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
  { name: 'index', title: 'Map' },
  { name: 'feed', title: 'Feed' },
  { name: 'pet', title: 'Your pet' },
  { name: 'profile', title: 'You' },
];

export default function TabsLayout() {
  return (
    <TabBarVisibilityProvider>
      <PetSummaryProvider>
        <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <FloatingTabBar {...props} />}>
          {TABS.map((tab) => (
          <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title }} />
          ))}
        </Tabs>
      </PetSummaryProvider>
    </TabBarVisibilityProvider>
  );
}
