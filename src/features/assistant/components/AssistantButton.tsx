import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { colors } from '@/theme';

/**
 * Opens Trợ lý StreetBiz [AI] from a home header. v5: a plain round button like the cart next
 * to it (no gradient); on an orange signboard it is translucent white, elsewhere mango paper.
 * `pageKey` names the page it was opened from (the web's page context, e.g. "ward.dashboard").
 */
export function AssistantButton({ pageKey, tone = 'plain' }: { pageKey?: string; tone?: 'plain' | 'onSign' }) {
  const onSign = tone === 'onSign';
  return (
    <Pressable
      onPress={() => router.push(pageKey ? { pathname: '/assistant', params: { pageKey } } : '/assistant')}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel="Trợ lý StreetBiz [AI]"
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: onSign ? (pressed ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.22)') : pressed ? colors.sticker : colors.mangoTint,
      })}
    >
      <Icon sf="sparkles" md="auto_awesome" size={20} color={onSign ? colors.white : colors.onMango} />
    </Pressable>
  );
}
