import { formatVnd } from '@/utils/format';

import { AppText } from './AppText';

export function Money({ amountVnd, size = 'md', color = 'text' }: { amountVnd: number; size?: 'md' | 'lg'; color?: 'text' | 'primary' | 'error' }) {
  return (
    <AppText variant={size === 'lg' ? 'moneyLg' : 'money'} color={color}>
      {formatVnd(amountVnd)}
    </AppText>
  );
}
