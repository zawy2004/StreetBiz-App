import { router, Stack, type Href } from 'expo-router';
import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { ListGroup, ListRow } from '@/components/common/ListGroup';
import { Screen } from '@/components/layout/Screen';
import { AccountScreen } from '@/features/account-management/AccountScreens';
import { LEGAL_ROUTES } from '@/features/legal/legal-content';
import { useAuthStore } from '@/store/auth-store';
import { colors, radius, shadow, text } from '@/theme';
import { PhotoTile } from '@/ui';

const go = (href: string) => router.push(href as Href);

/** The buyer's account tab: a guest is invited in; a buyer gets the shared account screen plus shortcuts. */
export default function AccountTab() {
  const user = useAuthStore((s) => s.user);
  if (!user) {
    return (
      <Screen gap={22}>
        <Stack.Screen options={{ title: 'Tài khoản' }} />
        {/* The invitation: the street in a photo, one line, the two ways in */}
        <View style={{ borderRadius: radius.pass, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card, padding: 10, gap: 16 }}>
          <PhotoTile source={require('@/assets/images/hero/hanoi-street-960.webp')} illustrative style={{ height: 168 }} />
          <View style={{ paddingHorizontal: 10, gap: 6 }}>
            <Text accessibilityRole="header" style={[text.title2, { color: colors.ink }]}>Đặt trước món vỉa hè có phép</Text>
            <Text style={[text.callout, { color: colors.muted }]}>Đăng nhập để đặt món, lấy mã nhận món và theo dõi đơn.</Text>
          </View>
          <View style={{ paddingHorizontal: 10, paddingBottom: 10, gap: 10 }}>
            <Button label="Đăng nhập" size={56} onPress={() => go('/auth/sign-in')} />
            <Button label="Tạo tài khoản" variant="secondary" onPress={() => go('/auth/register')} />
          </View>
        </View>
        <ListGroup title="Pháp lý">
          <ListRow title="Điều khoản sử dụng" icon={{ sf: 'doc.text', md: 'description' }} tint={colors.sign} tileColor={colors.signTint} onPress={() => go(LEGAL_ROUTES.terms)} />
          <ListRow title="Chính sách bảo mật" icon={{ sf: 'hand.raised.fill', md: 'privacy_tip' }} tint={colors.sign} tileColor={colors.signTint} onPress={() => go(LEGAL_ROUTES.privacy)} />
        </ListGroup>
      </Screen>
    );
  }
  return (
    <AccountScreen>
      <ListGroup title="Mua hàng">
        <ListRow title="Đơn hàng của tôi" subtitle="Mã nhận món, theo dõi, đánh giá" icon={{ sf: 'bag.fill', md: 'shopping_bag' }} onPress={() => router.navigate('/customer/orders' as Href)} />
        <ListRow title="Bản đồ quán" subtitle="Quán có phép quanh bạn" icon={{ sf: 'map.fill', md: 'map' }} tint={colors.sign} tileColor={colors.signTint} onPress={() => go('/customer/explore/map')} />
        <ListRow title="Kiểm tra giấy phép quán" subtitle="Quét mã QR ở quầy" icon={{ sf: 'qrcode.viewfinder', md: 'qr_code_scanner' }} tint={colors.onLeaf} tileColor={colors.leafTint} onPress={() => router.navigate('/customer/scan' as Href)} />
        <ListRow title="Thông báo" icon={{ sf: 'bell.fill', md: 'notifications' }} onPress={() => go('/notifications')} />
      </ListGroup>
    </AccountScreen>
  );
}
