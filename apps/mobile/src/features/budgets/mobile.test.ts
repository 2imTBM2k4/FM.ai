import { beforeEach, expect, it, vi } from 'vitest';
import type { BudgetAlertPort } from './alerts';

const native = vi.hoisted(() => ({
  platform: 'ios',
  channels: [] as string[],
  granted: true,
  provisional: false,
  fail: false,
  requests: [] as {
    identifier: string;
    content: { title: string; body: string; data?: unknown };
    trigger: unknown;
  }[],
  cancelled: [] as string[],
  dismissed: [] as string[],
  permissionRequests: 0,
  handler: undefined as
    | undefined
    | {
        handleNotification(): Promise<{
          shouldShowBanner: boolean;
          shouldShowList: boolean;
        }>;
      },
}));
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return native.platform;
    },
  },
}));
vi.mock('@/data/connection', () => ({
  withDatabase: async (task: (db: object) => Promise<unknown>) => task({}),
}));
vi.mock('./alerts', () => ({
  processBudgetAlerts: async (
    _db: unknown,
    month: string,
    port: BudgetAlertPort,
  ) => {
    if (await port.hasPermission())
      await port.send('synthetic-budget', month, 80);
  },
}));
vi.mock('expo-notifications', () => ({
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
  setNotificationHandler: (handler: typeof native.handler) => {
    native.handler = handler;
  },
  getPermissionsAsync: async () => ({
    granted: native.granted,
    ios: { status: native.provisional ? 3 : 0 },
  }),
  requestPermissionsAsync: async () => {
    native.permissionRequests++;
    return { granted: native.granted, ios: { status: 0 } };
  },
  setNotificationChannelAsync: async (id: string) => {
    native.channels.push(id);
  },
  scheduleNotificationAsync: async (
    request: (typeof native.requests)[number],
  ) => {
    if (native.fail) throw new Error('native failure');
    native.requests.push(request);
    return request.identifier;
  },
  getAllScheduledNotificationsAsync: async () => [
    { identifier: 'pfm-budget-test' },
    { identifier: 'unrelated' },
  ],
  getPresentedNotificationsAsync: async () => [
    { request: { identifier: 'pfm-budget-old' } },
    { request: { identifier: 'unrelated' } },
  ],
  cancelScheduledNotificationAsync: async (id: string) => {
    native.cancelled.push(id);
  },
  dismissNotificationAsync: async (id: string) => {
    native.dismissed.push(id);
  },
}));

beforeEach(() => {
  vi.resetModules();
  native.granted = true;
  native.platform = 'ios';
  native.channels = [];
  native.provisional = false;
  native.fail = false;
  native.requests = [];
  native.cancelled = [];
  native.dismissed = [];
  native.permissionRequests = 0;
  native.handler = undefined;
});

it('uses generic private-content-free local alerts and suppresses foreground banners globally', async () => {
  const mobile = await import('./mobile');
  await mobile.checkBudgetAlerts();
  expect(native.requests).toHaveLength(1);
  expect(native.requests[0]).toMatchObject({
    identifier: expect.stringMatching(
      /^pfm-budget-synthetic-budget-\d{4}-\d{2}-80$/,
    ),
    trigger: null,
    content: { data: { budgetAlert: true } },
  });
  expect(native.requests[0].content.body).not.toContain('synthetic-budget');
  expect(await native.handler?.handleNotification()).toMatchObject({
    shouldShowBanner: false,
    shouldShowList: true,
  });
  expect(native.permissionRequests).toBe(0);
});

it('skips delivery when denied, accepts provisional permission and shows errors only through budget status', async () => {
  const mobile = await import('./mobile');
  native.granted = false;
  await mobile.checkBudgetAlerts();
  expect(native.requests).toHaveLength(0);
  expect(mobile.useBudgetNotifications.getState().status).toBe('denied');
  native.provisional = true;
  await mobile.checkBudgetAlerts();
  expect(native.requests).toHaveLength(1);
  expect(mobile.useBudgetNotifications.getState().status).toBe('granted');
  native.fail = true;
  await mobile.checkBudgetAlerts();
  expect(mobile.useBudgetNotifications.getState().status).toBe('error');
});

it('requests permission on explicit action and schedules the five-second local test', async () => {
  const mobile = await import('./mobile');
  await mobile.requestBudgetNotifications();
  expect(native.permissionRequests).toBe(1);
  expect(await mobile.testBudgetNotification()).toBe(true);
  expect(native.requests.at(-1)).toMatchObject({
    identifier: 'pfm-budget-test',
    trigger: { type: 'timeInterval', seconds: 5, repeats: false },
  });
});

it('cancels and dismisses only this app budget notifications during data reset', async () => {
  const mobile = await import('./mobile');
  await mobile.clearBudgetNotifications();
  expect(native.cancelled).toEqual(['pfm-budget-test']);
  expect(native.dismissed).toEqual(['pfm-budget-old']);
  expect(mobile.useBudgetNotifications.getState().status).toBe('unknown');
});

it('creates the Android budget channel and uses it for local delivery', async () => {
  native.platform = 'android';
  const mobile = await import('./mobile');
  await mobile.requestBudgetNotifications();
  expect(native.channels).toEqual(['pfm-budget', 'pfm-budget']);
  expect(native.requests[0].trigger).toEqual({ channelId: 'pfm-budget' });
});
