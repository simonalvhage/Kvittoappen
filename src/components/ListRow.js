import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../hooks/useTheme';
import { spacing, font } from '../lib/theme';

export function ListRow({ title, subtitle, left, right, value, onPress, showChevron = true, tint, destructive }) {
  const { c } = useTheme();
  const textColor = destructive ? c.danger : c.text;

  const Content = (
    <View style={styles.row}>
      {left ? <View style={styles.left}>{left}</View> : null}
      <View style={styles.center}>
        <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: c.textSecondary }]} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>
      {value ? (
        <Text style={[styles.value, { color: tint || c.textSecondary }]} numberOfLines={1}>{value}</Text>
      ) : null}
      {right}
      {onPress && showChevron ? (
        <Ionicons name="chevron-forward" size={18} color={c.textTertiary} style={{ marginLeft: 4 }} />
      ) : null}
    </View>
  );

  if (!onPress) return <View style={[styles.wrap, { backgroundColor: c.card }]}>{Content}</View>;

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [styles.wrap, { backgroundColor: c.card, opacity: pressed ? 0.6 : 1 }]}
    >
      {Content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 56, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  left: { marginRight: spacing.md },
  center: { flex: 1 },
  title: { ...font.body },
  subtitle: { ...font.footnote, marginTop: 2 },
  value: { ...font.body, marginLeft: spacing.sm },
});

export function ListSection({ title, footer, children }) {
  const { c } = useTheme();
  return (
    <View style={{ marginBottom: spacing.xl }}>
      {title ? (
        <Text style={[sectionStyles.header, { color: c.textSecondary }]}>{title.toUpperCase()}</Text>
      ) : null}
      <View style={[sectionStyles.group, { backgroundColor: c.card }]}>
        {children}
      </View>
      {footer ? (
        <Text style={[sectionStyles.footer, { color: c.textSecondary }]}>{footer}</Text>
      ) : null}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  header: { ...font.footnote, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  group: { borderRadius: 12, overflow: 'hidden', marginHorizontal: spacing.lg },
  footer: { ...font.footnote, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
});

export function Separator() {
  const { c } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginLeft: spacing.lg }} />;
}
