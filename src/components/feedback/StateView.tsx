import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { colors, text } from '@/theme';
import { selectableText } from '@/utils/platform';

type Props = {
  icon: { sf: string; md: string };
  tone?: 'brand' | 'danger' | 'neutral';
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
};

const tones = {
  brand: { wash: colors.brandTint, ink: colors.primary },
  danger: { wash: colors.dangerTint, ink: colors.onDanger },
  neutral: { wash: colors.sunken, ink: colors.muted },
};

/** Empty and error states: say what happened and offer the next step. */
export function StateView({ icon, tone = 'brand', title, body, action }: Props) {
  const t = tones[tone];
  return (
    <View style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: 28, gap: 6 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: t.wash,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 10,
        }}
      >
        <Icon sf={icon.sf} md={icon.md} size={28} color={t.ink} />
      </View>
      <Text style={[text.title3, { color: colors.ink, textAlign: 'center' }]}>{title}</Text>
      <Text
        selectable={selectableText}
        style={[text.callout, { color: colors.muted, textAlign: 'center', maxWidth: 300 }]}
      >
        {body}
      </Text>
      {action ? (
        <Button
          label={action.label}
          variant="secondary"
          onPress={action.onPress}
          style={{ marginTop: 14 }}
        />
      ) : null}
    </View>
  );
}
