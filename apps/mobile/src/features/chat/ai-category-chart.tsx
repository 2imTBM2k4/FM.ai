import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { formatVnd } from '@pfm/domain';
import { styles as screenStyles } from '@/components/screen';
import {
  DesignRadius,
  DesignSpacing,
  useDesignTheme,
} from '@/constants/theme';
import { vi } from '@/messages/vi';
import type { AIChartItem } from '@/services/ai-service';

export interface AICategoryBarChartProps {
  title?: string;
  items: readonly AIChartItem[];
}

/**
 * Renders a vertical percentage column chart and category breakdown legend
 * inside an AI chat response bubble.
 */
export const AICategoryBarChart = memo(function AICategoryBarChart({
  title = vi.aiChartTitle,
  items,
}: AICategoryBarChartProps) {
  const theme = useDesignTheme();
  if (!items.length) return null;

  const maxPercentage = Math.max(1, ...items.map((item) => item.percentage));

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.card.surfaceElevated,
          borderColor: theme.card.border,
        },
      ]}
    >
      <Text
        variant="labelLarge"
        style={{ color: theme.text.primary, fontWeight: '700' }}
      >
        {title}
      </Text>

      {/* Vertical Percentage Columns */}
      <View style={styles.columnsRow}>
        {items.map((item, idx) => {
          const fillRatio = Math.max(
            0.14,
            Math.min(1, item.percentage / maxPercentage),
          );
          const barHeight = Math.round(fillRatio * 88);
          return (
            <View key={`${item.category}-${idx}`} style={styles.columnItem}>
              <Text
                variant="labelSmall"
                style={[
                  screenStyles.number,
                  styles.percentText,
                  { color: theme.text.primary },
                ]}
              >
                {item.percentage}%
              </Text>
              <View
                style={[
                  styles.barTrack,
                  { backgroundColor: theme.brand.primarySoft },
                ]}
              >
                <View
                  style={[
                    styles.barFill,
                    {
                      height: barHeight,
                      backgroundColor: item.color,
                    },
                  ]}
                />
              </View>
              <Text
                variant="labelSmall"
                numberOfLines={1}
                style={[styles.categoryShort, { color: theme.text.secondary }]}
              >
                {item.category}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Detailed Category Legend with Integer Amounts */}
      <View style={styles.legendList}>
        {items.map((item, idx) => (
          <View key={`legend-${item.category}-${idx}`} style={styles.legendRow}>
            <View style={styles.legendLeft}>
              <View
                style={[styles.colorDot, { backgroundColor: item.color }]}
              />
              <Text
                variant="bodySmall"
                numberOfLines={1}
                style={{
                  color: theme.text.primary,
                  fontWeight: '600',
                  flexShrink: 1,
                }}
              >
                {item.category}
              </Text>
            </View>
            <Text
              variant="bodySmall"
              style={[
                screenStyles.number,
                { color: theme.text.secondary, fontWeight: '700' },
              ]}
            >
              {item.percentage}% · {formatVnd(item.amount)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    padding: DesignSpacing.md,
    borderRadius: DesignRadius.md,
    borderWidth: 1,
    gap: 12,
  },
  columnsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 6,
  },
  columnItem: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  percentText: {
    fontWeight: '800',
    fontSize: 11,
  },
  barTrack: {
    width: 24,
    height: 88,
    borderRadius: 12,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 12,
  },
  categoryShort: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 64,
  },
  legendList: {
    gap: 6,
    paddingTop: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  colorDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
});

