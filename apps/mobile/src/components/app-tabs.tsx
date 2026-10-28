import { NativeTabs } from 'expo-router/native-tabs';
import { Platform } from 'react-native';
import { useDesignTheme } from '@/constants/theme';
import { vi } from '@/messages/vi';

/**
 * Native iOS Liquid Glass / Material tab bar navigator.
 * Uses Pastel Sunset background color on tab triggers so native iOS containers stay bright.
 */
export default function AppTabs() {
  const theme = useDesignTheme();
  const isDark = theme.mode === 'dark';

  return (
    <NativeTabs
      tintColor={theme.brand.primary}
      backgroundColor={
        Platform.OS === 'android' ? theme.card.surfaceElevated : undefined
      }
      blurEffect={
        isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'
      }
      minimizeBehavior="automatic"
      iconColor={{
        default: theme.text.muted,
        selected: theme.brand.primary,
      }}
      labelStyle={{
        default: {
          color: theme.text.muted,
          fontSize: 11,
          fontWeight: '500',
        },
        selected: {
          color: theme.brand.primary,
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <NativeTabs.Trigger
        name="index"
        contentStyle={{ backgroundColor: theme.sky.upperMid }}
      >
        <NativeTabs.Trigger.Label>{vi.overview}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger
        name="transactions"
        contentStyle={{ backgroundColor: theme.sky.upperMid }}
      >
        <NativeTabs.Trigger.Label>{vi.transactions}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="arrow.left.arrow.right.circle.fill"
          md="swap_horiz"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger
        name="budgets"
        contentStyle={{ backgroundColor: theme.sky.upperMid }}
      >
        <NativeTabs.Trigger.Label>{vi.budgets}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.pie.fill" md="pie_chart" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger
        name="chat"
        disableAutomaticContentInsets={Platform.OS === 'ios'}
        contentStyle={{ backgroundColor: theme.sky.upperMid }}
      >
        <NativeTabs.Trigger.Label>{vi.chat}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="sparkles" md="auto_awesome" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger
        name="settings"
        contentStyle={{ backgroundColor: theme.sky.upperMid }}
      >
        <NativeTabs.Trigger.Label>{vi.settings}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
