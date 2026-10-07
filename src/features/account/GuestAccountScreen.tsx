import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { BrandMark } from '@/components/common/BrandMark';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { HeroCard } from '@/components/common/HeroCard';
import { Icon, type IconName } from '@/components/common/Icon';
import { ListRow } from '@/components/common/ListRow';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { ThemeModeSelector } from '@/components/layout/ThemeControls';
import { requireAuth } from '@/core/auth/require-auth';
import { WELCOME_ROUTE } from '@/core/auth/role-routes';
import { goTo } from '@/core/navigation/go';
import { spacing, useTheme } from '@/theme';

const PERKS: { icon: IconName; text: string }[] = [
  { icon: 'cart-check', text: 'Đặt món trước, đến là lấy' },
  { icon: 'message-text-outline', text: 'Nhắn tin trực tiếp với quán' },
  { icon: 'star-outline', text: 'Đánh giá và theo dõi đơn hàng' },
];

/** Account tab for a signed-out visitor: what an account unlocks, plus appearance settings. */
export function GuestAccountScreen() {
  const { colors } = useTheme();
  return (
    <Screen>
      <HeroCard>
        <BrandMark size={32} plate />
        <AppText variant="display" style={{ color: colors.onHero }}>Bạn đang xem với tư cách khách</AppText>
        <View style={styles.perks}>
          {PERKS.map((p) => (
            <View key={p.text} style={styles.perk}>
              <Icon name={p.icon} size={18} color="#FFB547" />
              <AppText style={{ color: colors.heroMuted }}>{p.text}</AppText>
            </View>
          ))}
        </View>
        <View style={styles.actions}>
          <Button label="Đăng nhập" variant="primary" icon="login" onPress={() => requireAuth()} testID="guest-sign-in" />
          <Button label="Tạo tài khoản người mua" variant="glass" onPress={() => goTo('/(auth)/register')} />
        </View>
      </HeroCard>

      <Card padded={false}>
        <ListRow
          icon="storefront-outline"
          iconTone="secondary"
          title="Bạn bán hàng trên vỉa hè?"
          subtitle="Đăng ký hộ kinh doanh để thuê ô và mở gian hàng online"
          onPress={() => goTo('/(auth)/register?role=VENDOR')}
          last
        />
      </Card>

      <Section title="Giao diện" subtitle="Chọn sáng, tối hoặc theo cài đặt của máy">
        <ThemeModeSelector />
      </Section>

      <Card padded={false}>
        <ListRow icon="information-outline" title="Giới thiệu StreetBiz" onPress={() => goTo(WELCOME_ROUTE)} last />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  perks: { gap: spacing.sm },
  perk: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.xs },
});
