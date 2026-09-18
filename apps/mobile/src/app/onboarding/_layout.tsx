import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  // Steps replace each other (no back stack); gestures off so users can't
  // swipe back to a step the server has already moved past.
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />;
}
