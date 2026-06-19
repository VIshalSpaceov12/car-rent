import { View, Pressable, StyleSheet, Text } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '@car-rental/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          bottom: insets.bottom + 12,
          backgroundColor: theme.color.surface,
          borderRadius: theme.radius.pill ?? 32,
          ...theme.elevation.md,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key] ?? {};
        const isFocused = state.index === index;

        const label =
          typeof options?.tabBarLabel === 'string'
            ? options.tabBarLabel
            : typeof options?.title === 'string'
            ? options.title
            : route.name;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.tab}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
          >
            <View
              style={[
                styles.iconContainer,
                isFocused && {
                  backgroundColor: theme.color.primary,
                  borderRadius: 20,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: isFocused ? '700' : '400',
                  color: isFocused ? theme.color.onPrimary : theme.color.textMuted,
                }}
              >
                {label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    top: undefined,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
  },
  iconContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
