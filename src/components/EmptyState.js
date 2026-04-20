import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { spacing, font } from '../lib/theme';

export function EmptyState({ icon = 'document-text-outline', title, message, children }) {
  const { c } = useTheme();
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={56} color={c.textTertiary} />
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      {message ? <Text style={[styles.msg, { color: c.textSecondary }]}>{message}</Text> : null}
      {children ? <View style={{ marginTop: spacing.lg, width: '100%' }}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  title: { ...font.title3, marginTop: spacing.md, textAlign: 'center' },
  msg: { ...font.callout, textAlign: 'center' },
});
