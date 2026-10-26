import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

// Hydration has no external updates after React selects the client snapshot.
const subscribe = () => () => {};
// Report that rendering is happening on the client.
const getClientSnapshot = () => true;
// Keep the initial server-rendered theme stable until hydration finishes.
const getServerSnapshot = () => false;

// Use the device color scheme after hydration without a state-setting effect.
export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
