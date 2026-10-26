import { TabList, TabSlot, Tabs, TabTrigger } from 'expo-router/ui';
import { vi } from '@/messages/vi';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot />
      <TabList>
        <TabTrigger name="index" href="/">
          {vi.overview}
        </TabTrigger>
        <TabTrigger name="transactions" href="/transactions">
          {vi.transactions}
        </TabTrigger>
        <TabTrigger name="budgets" href="/budgets">
          {vi.budgets}
        </TabTrigger>
        <TabTrigger name="chat" href="/chat">
          {vi.chat}
        </TabTrigger>
        <TabTrigger name="settings" href="/settings">
          {vi.settings}
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}
