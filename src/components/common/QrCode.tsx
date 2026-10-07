import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { radius } from '@/theme';

/** Always navy on white so scanners read it in sunlight and in dark mode. */
export function QrCode({ value, size = 240 }: { value: string; size?: number }) {
  return (
    <View style={styles.box} accessibilityLabel={`Mã QR ${value}`}>
      <QRCode value={value} size={size} color="#1D2939" backgroundColor="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: radius.chip },
});
