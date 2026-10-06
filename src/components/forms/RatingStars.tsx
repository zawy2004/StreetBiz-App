import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '../common/Icon';

type Props = { value: number; onChange?: (value: number) => void; size?: number };

export function RatingStars({ value, onChange, size = 48 }: Props) {
  return (
    <View style={styles.row} accessibilityLabel={`${value} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          disabled={!onChange}
          accessibilityRole="button"
          accessibilityLabel={`${n} sao`}
          onPress={() => onChange?.(n)}
          hitSlop={4}
        >
          <Icon name={n <= value ? 'star' : 'star-outline'} size={size} color={n <= value ? 'secondary' : 'muted'} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 4, justifyContent: 'center' } });
