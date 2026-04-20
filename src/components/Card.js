import { View, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { radius, spacing, shadow } from '../lib/theme';

export function Card({ children, style, elevated }) {
  const { c } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: elevated ? c.cardElevated : c.card },
        elevated && shadow.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
});
