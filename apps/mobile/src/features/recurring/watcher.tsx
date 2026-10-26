import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useApp } from '@/state/app';
import { RECURRING_NOTIFICATION_PREFIX } from './reminders';
import { DEBT_NOTIFICATION_PREFIX } from '@/features/debts/reminders';

export function RecurringWatcher() {
  const refresh = useApp((state) => state.refreshRecurring);
  const router = useRouter();
  useEffect(() => {
    const active = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    const response = (event: Notifications.NotificationResponse | null) => {
      if (
        event &&
        (event.notification.request.identifier.startsWith(
          RECURRING_NOTIFICATION_PREFIX,
        ) ||
          event.notification.request.identifier.startsWith(
            DEBT_NOTIFICATION_PREFIX,
          ))
      ) {
        router.navigate('/transactions');
        Notifications.clearLastNotificationResponse();
      }
    };
    const listener =
      Notifications.addNotificationResponseReceivedListener(response);
    void Notifications.getLastNotificationResponseAsync()
      .then(response)
      .catch(() => undefined);
    return () => {
      active.remove();
      listener.remove();
    };
  }, [refresh, router]);
  return null;
}
