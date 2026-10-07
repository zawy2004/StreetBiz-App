import { Text, type TextProps, type TextStyle } from 'react-native';

import { typography, useTheme, type ColorTokens, type TypeVariant } from '@/theme';

type Props = TextProps & {
  variant?: TypeVariant;
  color?: keyof ColorTokens;
  align?: TextStyle['textAlign'];
};

export function AppText({ variant = 'body', color = 'text', align, style, ...rest }: Props) {
  const { colors } = useTheme();
  return <Text {...rest} style={[typography[variant], { color: colors[color] }, align ? { textAlign: align } : null, style]} />;
}
