import { createStore } from 'zustand/vanilla';
import type { PinLock } from './service';

interface LockSession {
  status: 'checking' | 'locked' | 'unlocked' | 'error';
  enabled: boolean;
  visible: boolean;
  busy: boolean;
  blockedUntil: number;
  initialize(): Promise<void>;
  refresh(): Promise<void>;
  unlock(pin: string): Promise<'unlocked' | 'invalid' | 'cancelled'>;
  lock(): void;
  setVisible(visible: boolean): void;
}

export function createLockSession(
  service: Pick<PinLock, 'status' | 'verify'>,
  now: () => number,
  enforcePin = true,
) {
  let backgroundAt: number | undefined;
  let revision = 0;
  return createStore<LockSession>()((set, get) => ({
    status: 'checking',
    enabled: false,
    visible: true,
    busy: false,
    blockedUntil: 0,
    async initialize() {
      if (!enforcePin) {
        set({ status: 'unlocked', enabled: false, blockedUntil: 0 });
        return;
      }
      set({ status: 'checking' });
      try {
        const record = await service.status();
        set({
          enabled: record.enabled,
          blockedUntil: record.blockedUntil,
          status: record.enabled ? 'locked' : 'unlocked',
        });
      } catch {
        set({ status: 'error' });
      }
    },
    async refresh() {
      if (!enforcePin) {
        set({ status: 'unlocked', enabled: false, blockedUntil: 0 });
        return;
      }
      try {
        const record = await service.status();
        set({
          enabled: record.enabled,
          blockedUntil: record.blockedUntil,
          status:
            record.enabled && (get().status !== 'unlocked' || !get().visible)
              ? 'locked'
              : 'unlocked',
        });
      } catch (error) {
        set({ status: 'error' });
        throw error;
      }
    },
    async unlock(pin) {
      if (!enforcePin) return 'cancelled';
      if (get().busy || !get().visible || get().status !== 'locked')
        return 'cancelled';
      set({ busy: true });
      const startedAtRevision = revision;
      try {
        const valid = await service.verify(pin);
        const record = await service.status();
        set({ blockedUntil: record.blockedUntil });
        if (startedAtRevision !== revision || !get().visible)
          return 'cancelled';
        if (!valid) return 'invalid';
        set({ status: 'unlocked' });
        return 'unlocked';
      } catch (error) {
        try {
          set({ blockedUntil: (await service.status()).blockedUntil });
        } catch {
          set({ status: 'error' });
        }
        throw error;
      } finally {
        set({ busy: false });
      }
    },
    lock() {
      revision++;
      if (enforcePin && get().enabled) set({ status: 'locked' });
    },
    setVisible(visible) {
      if (visible === get().visible) return;
      if (!visible) {
        revision++;
        backgroundAt = now();
        set({ visible: false });
      } else {
        const elapsed = backgroundAt === undefined ? 0 : now() - backgroundAt;
        const shouldLock =
          enforcePin && get().enabled && (elapsed >= 60000 || elapsed < 0);
        backgroundAt = undefined;
        set({
          visible: true,
          ...(shouldLock ? { status: 'locked' as const } : {}),
        });
      }
    },
  }));
}
