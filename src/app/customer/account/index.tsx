import { router, Stack, type Href } from 'expo-router';
import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { ListGroup, ListRow } from '@/components/common/ListGroup';
import { Screen } from '@/components/layout/Screen';
import { AccountScreen } from '@/features/account-management/AccountScreens';
import { LEGAL_ROUTES } from '@/features/legal/legal-content';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, text } from '@/theme';

const go = (href: string) => router.push(href as Href);

/** The buyer's account tab: a guest is invited in; a buyer gets the shared account screen plus shortcuts. */
export default function AccountTab() {
  const user = useAuthStore((s) => s.user);
  if (!user) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Tài khoản' }} />
        <View style={{ padding: 20, gap: 12, alignItems: 'center', borderRadius: radius.pass, borderCurve: 'continuous', backgroundColor: colors.brandTint }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
            <Icon sf="person.crop.circle.fill" md="account_circle" size={36} color={colors.primary} />
          </View>
          <Text style={[text.title3, { color: colors.ink, fontFamily: fonts.heavy, textAlign: 'center' }]}>Đặt trước món vỉa hè có phép</Text>
          <Text style={[text.footnote, { color: colors.ink, textAlign: 'center' }]}>Đăng nhập để đặt món, lấy mã nhận món và theo dõi đơn.</Text>
          <Button label="Đăng nhập" size={56} onPress={() => go('/auth/sign-in')} style={{ alignSelf: 'stretch' }} />
          <Button label="Tạo tài khoản" variant="secondary" onPress={() => go('/auth/register')} style={{ alignSelf: 'stretch' }} />
        </View>
        <ListGroup title="Pháp lý">
          <ListRow title="Điều khoản sử dụng" icon={{ sf: 'doc.text', md: 'description' }} onPress={() => go(LEGAL_ROUTES.terms)} />
          <ListRow title="Chính sách bảo mật" icon={{ sf: 'hand.raised.fill', md: 'privacy_tip' }} onPress={() => go(LEGAL_ROUTES.privacy)} />
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
