import { NativeTabs } from 'expo-router/native-tabs';
import { useTheme } from 'react-native-paper';
import { vi } from '@/messages/vi';

export default function AppTabs() {
  const { colors } = useTheme();
  return (
    <NativeTabs
      backgroundColor={colors.surface}
      tintColor={colors.primary}
      labelStyle={{
        color: colors.onSurfaceVariant,
        selected: { color: colors.primary },
      }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{vi.overview}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house" md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="transactions">
        <NativeTabs.Trigger.Label>{vi.transactions}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="arrow.left.arrow.right" md="swap_horiz" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="budgets">
        <NativeTabs.Trigger.Label>{vi.budgets}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.pie" md="pie_chart" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat">
        <NativeTabs.Trigger.Label>{vi.chat}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="bubble.left.and.bubble.right"
          md="chat_bubble_outline"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>{vi.settings}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
