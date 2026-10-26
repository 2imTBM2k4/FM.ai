import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
  type ErrorBoundaryProps,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';
import {
  ActivityIndicator,
  Button,
  MD3DarkTheme,
  MD3LightTheme,
  PaperProvider,
  Text,
} from 'react-native-paper';
import AppTabs from '@/components/app-tabs';
import { Onboarding } from '@/components/onboarding';
import { Screen } from '@/components/screen';
import { vi } from '@/messages/vi';
import { useApp } from '@/state/app';
import { LockGate } from '@/features/lock/lock-gate';
import { BudgetNotificationWatcher } from '@/features/budgets/notification-watcher';
import { RecurringWatcher } from '@/features/recurring/watcher';

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <Screen title={vi.appName}>
      <Text>{vi.screenError}</Text>
      <Button onPress={retry}>{vi.retry}</Button>
    </Screen>
  );
}

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);
  const base = dark ? MD3DarkTheme : MD3LightTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: dark ? '#9CC5FF' : '#195DB7',
      onPrimary: dark ? '#102747' : '#FFFFFF',
      primaryContainer: dark ? '#203957' : '#E3EFFF',
      onPrimaryContainer: dark ? '#D9E8FC' : '#143C70',
      background: dark ? '#111111' : '#F7F7F7',
      surface: dark ? '#191919' : '#FFFFFF',
      surfaceVariant: dark ? '#262626' : '#EEEEEE',
      onSurfaceVariant: dark ? '#C5C5C5' : '#555555',
      onBackground: dark ? '#EEEEEE' : '#191919',
      onSurface: dark ? '#EEEEEE' : '#191919',
      outline: dark ? '#858585' : '#767676',
      outlineVariant: dark ? '#383838' : '#DDDDDD',
    },
  };
  const navigation = dark ? DarkTheme : DefaultTheme;
  return (
    <PaperProvider
      theme={theme}
      settings={{ icon: (props) => <MaterialCommunityIcons {...props} /> }}
    >
      <ThemeProvider
        value={{
          ...navigation,
          colors: {
            ...navigation.colors,
            primary: theme.colors.primary,
            background: theme.colors.background,
            card: theme.colors.surface,
            text: theme.colors.onSurface,
            border: theme.colors.outlineVariant,
          },
        }}
      >
        <StatusBar style={dark ? 'light' : 'dark'} />
        <LockGate>
          <ApplicationContent />
        </LockGate>
      </ThemeProvider>
    </PaperProvider>
  );
}

function ApplicationContent() {
  const status = useApp((state) => state.status);
  const onboarded = useApp((state) => state.onboarded);
  const initialize = useApp((state) => state.initialize);
  useEffect(() => {
    void initialize();
  }, [initialize]);
  return status === 'error' ? (
    <Screen title={vi.appName}>
      <Text accessibilityRole="alert">
        {Platform.OS === 'web' ? vi.expoGoOnly : vi.databaseError}
      </Text>
      <Button onPress={initialize}>{vi.retry}</Button>
    </Screen>
  ) : status !== 'ready' ? (
    <Screen title={vi.appName}>
      <ActivityIndicator accessibilityLabel={vi.loading} />
      <Text>{vi.loading}</Text>
    </Screen>
  ) : !onboarded ? (
    <Onboarding />
  ) : (
    <>
      <BudgetNotificationWatcher />
      <RecurringWatcher />
      <AppTabs />
    </>
  );
}
