import { useColorScheme } from 'react-native';
import { colors } from '../lib/theme';

export function useTheme() {
  const scheme = useColorScheme() ?? 'light';
  return { c: colors[scheme], scheme };
}
