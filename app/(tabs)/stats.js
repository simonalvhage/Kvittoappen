import { View } from 'react-native';
import { useTheme } from '../../src/hooks/useTheme';
import { EmptyState } from '../../src/components/EmptyState';

export default function StatsScreen() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <EmptyState
        icon="stats-chart-outline"
        title="Statistik"
        message="Här kommer total spendering, butiker och taggar."
      />
    </View>
  );
}
