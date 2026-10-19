import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { colors } from '@/theme';

/**
 * Opens Trợ lý StreetBiz [AI] from a home header: the mango "advice" colour, never the brand CTA.
 * `pageKey` names the page it was opened from (the web's page context, e.g. "ward.dashboard").
 */
export function AssistantButton({ pageKey }: { pageKey?: string }) {
  return (
    <Pressable
      onPress={() => router.push(pageKey ? { pathname: '/assistant', params: { pageKey } } : '/assistant')}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel="Trợ lý StreetBiz [AI]"
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.95 : 1 }] })}
    >
      <LinearGradient
        colors={[colors.mango, colors.brand]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon sf="sparkles" md="auto_awesome" size={19} color={colors.white} />
      </LinearGradient>
    </Pressable>
  );
}
