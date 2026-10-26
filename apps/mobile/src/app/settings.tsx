import { View } from 'react-native';
import { useState } from 'react';
import { Button, Divider, Text, useTheme } from 'react-native-paper';
import { CategoryManager } from '@/features/categories/category-manager';
import { Screen, styles } from '@/components/screen';
import { DeleteDataControl } from '@/components/delete-data-control';
import { PinSettings } from '@/features/lock/pin-controls';
import { vi } from '@/messages/vi';

export default function Settings() {
  const [managingCategories, setManagingCategories] = useState(false);
  const { colors } = useTheme();
  if (managingCategories)
    return <CategoryManager onClose={() => setManagingCategories(false)} />;
  return (
    <Screen title={vi.settings}>
      <Button
        mode="contained"
        contentStyle={styles.button}
        onPress={() => setManagingCategories(true)}
      >
        {vi.manageCategories}
      </Button>
      <View style={[styles.panel, { backgroundColor: colors.surface }]}>
        <Text variant="titleMedium">{vi.localData}</Text>
        <Text>{vi.localDataDescription}</Text>
        <Divider />
        <Text variant="titleMedium">{vi.currency}</Text>
        <Text>{vi.currencyValue}</Text>
        <Divider />
        <Text variant="titleMedium">{vi.timeZone}</Text>
        <Text>{vi.timeZoneValue}</Text>
      </View>
      <PinSettings />
      <Divider />
      <Text accessibilityRole="header" variant="titleMedium">
        {vi.security}
      </Text>
      <Text>{vi.securityDescription}</Text>
      <Text accessibilityRole="header" variant="titleMedium">
        {vi.previewTitle}
      </Text>
      <Text>{vi.previewDescription}</Text>
      <Divider />
      <DeleteDataControl />
    </Screen>
  );
}
