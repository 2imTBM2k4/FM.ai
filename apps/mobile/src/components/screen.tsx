import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Screen({
  title,
  children,
  scroll = true,
}: PropsWithChildren<{ title: string; scroll?: boolean }>) {
  const theme = useTheme();
  const content = (
    <View style={[styles.column, scroll ? styles.scrollColumn : styles.fill]}>
      <Text accessibilityRole="header" variant="headlineSmall">
        {title}
      </Text>
      {children}
    </View>
  );
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.fill, { backgroundColor: theme.colors.background }]}
    >
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {scroll ? (
          <ScrollView
            style={styles.fill}
            // Forms can mount after the tab's initial native scroll-view discovery.
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.scroll}
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { flexGrow: 1 },
  // Keep long forms at their natural height so the last action stays scrollable.
  scrollColumn: { flexGrow: 1, flexShrink: 0 },
  // One column: viewport width minus two 20-point gutters; rows grow with text.
  column: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: 20,
    gap: 20,
  },
  panel: { padding: 20, borderRadius: 20, gap: 12 },
  number: { fontVariant: ['tabular-nums'] },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: { minHeight: 48, justifyContent: 'center' },
});
