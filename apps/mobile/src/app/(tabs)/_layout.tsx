import { Tabs } from 'expo-router';

import { FloatingTabBar } from '@/components/floating-tab-bar';
import { TabBarVisibilityProvider } from '@/components/tab-bar-visibility';

const TABS = [
  { name: 'index', title: 'Map' },
  { name: 'feed', title: 'Feed' },
  { name: 'activity', title: 'Activity' },
  { name: 'profile', title: 'Profile' },
];

export default function TabsLayout() {
  return (
    <TabBarVisibilityProvider>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <FloatingTabBar {...props} />}>
        {TABS.map((tab) => (
          <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title }} />
        ))}
      </Tabs>
    </TabBarVisibilityProvider>
  );
}
