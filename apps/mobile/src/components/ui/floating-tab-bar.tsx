import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createSoftShadow,
  DesignRadius,
  DesignSpacing,
  useDesignTheme,
} from '@/constants/theme';

export interface TabBarItem {
  key: string;
  label: string;
  icon: string;
  activeIcon?: string;
}

export interface FloatingTabBarProps {
  items: readonly TabBarItem[];
  activeKey: string;
  onSelect(key: string): void;
  onAddPress(): void;
  addAccessibilityLabel?: string;
}

/**
 * Renders an individual circular icon button inside the floating black pill tab bar.
 */
function TabIconButton({
  item,
  active,
  onPress,
}: {
  item: TabBarItem;
  active: boolean;
  onPress(): void;
}) {
  const theme = useDesignTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const iconName = active && item.activeIcon ? item.activeIcon : item.icon;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={item.label}
        onPress={onPress}
        onPressIn={() => {
          scale.set(withSpring(0.9, { damping: 15, stiffness: 320 }));
        }}
        onPressOut={() => {
          scale.set(withSpring(1, { damping: 15, stiffness: 320 }));
        }}
        style={[
          styles.tabCircle,
          active && {
            backgroundColor: theme.tabBar.activeTab,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={iconName as never}
          size={22}
          color={
            active ? theme.tabBar.activeIcon : theme.tabBar.inactiveIcon
          }
        />
      </Pressable>
    </Animated.View>
  );
}

/**
 * Floating black pill tab bar with circular tab icons (purple active background)
 * and a separate circular purple "+" button on the right to add a transaction.
 */
export const FloatingTabBar = memo(function FloatingTabBar({
  items,
  activeKey,
  onSelect,
  onAddPress,
  addAccessibilityLabel = 'Add transaction',
}: FloatingTabBarProps) {
  const theme = useDesignTheme();
  const insets = useSafeAreaInsets();
  const addScale = useSharedValue(1);

  const addAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: addScale.value }],
  }));

  const bottomOffset = Math.max(insets.bottom, DesignSpacing.sm) + 4;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { bottom: bottomOffset }]}
    >
      <View style={styles.row}>
        {/* Floating Black Pill Container */}
        <View
          style={[
            styles.pillBar,
            createSoftShadow(theme.mode, 'lg'),
            {
              backgroundColor: theme.tabBar.pillBackground,
              borderColor: theme.tabBar.pillBorder,
            },
          ]}
        >
          {items.map((item) => (
            <TabIconButton
              key={item.key}
              item={item}
              active={item.key === activeKey}
              onPress={() => onSelect(item.key)}
            />
          ))}
        </View>

        {/* Separate Circular "+" Button on the Right */}
        <Animated.View style={addAnimatedStyle}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={addAccessibilityLabel}
            onPress={onAddPress}
            onPressIn={() => {
              addScale.set(withSpring(0.9, { damping: 15, stiffness: 320 }));
            }}
            onPressOut={() => {
              addScale.set(withSpring(1, { damping: 15, stiffness: 320 }));
            }}
            style={[
              styles.addButton,
              createSoftShadow(theme.mode, 'lg'),
              {
                backgroundColor: theme.tabBar.addButton,
                shadowColor: theme.brand.primary,
                shadowOpacity: 0.4,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="plus"
              size={28}
              color={theme.text.onPrimary}
            />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: DesignSpacing.screenPadding,
    right: DesignSpacing.screenPadding,
    alignItems: 'center',
    zIndex: 50,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DesignSpacing.sm,
  },
  pillBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: DesignRadius.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 6,
  },
  tabCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

