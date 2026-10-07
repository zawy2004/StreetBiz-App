import { View } from 'react-native';

import { AppHeader, HeaderIconButton } from '@/components/layout/AppHeader';
import { goTo } from '@/core/navigation/go';
import { QrScanner } from '@/services/qr/QrScanner';

export default function PatrolScanScreen() {
  return (
    <View style={{ flex: 1 }}>
      <AppHeader
        title="Tuần tra"
        right={<HeaderIconButton icon="account-circle-outline" label="Tài khoản" onPress={() => goTo('/ward/account')} />}
      />
      <QrScanner hint="Quét mã giấy phép của hộ kinh doanh" onDetected={(code) => goTo(`/ward/result?code=${encodeURIComponent(code)}`)} />
    </View>
  );
}
