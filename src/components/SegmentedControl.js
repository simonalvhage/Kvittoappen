import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../hooks/useTheme';
import { spacing, font, radius } from '../lib/theme';

export function SegmentedControl({ options, value, onChange }) {
  const { c } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync().catch(() => {});
              onChange(opt.value);
            }}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.segment,
              active && {
                backgroundColor: c.card,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.08,
                shadowRadius: 2,
                elevation: 2,
              },
              { opacity: pressed && !active ? 0.6 : 1 },
            ]}
          >
            <Text
              style={[
                font.subhead,
                { color: active ? c.text : c.textSecondary, fontWeight: active ? '600' : '500' },
              ]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: radius.sm,
    padding: 2,
    gap: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm - 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
});
