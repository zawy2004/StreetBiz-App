import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { TextField } from '@/components/forms/TextField';
import { spacing, useTheme } from '@/theme';

type Props = {
  hint: string;
  onDetected: (code: string) => void;
  manualLabel?: string;
};

const FRAME = 260;

/** Full-bleed camera with a scan frame. Manual entry is always available as a fallback. */
export function QrScanner({ hint, onDetected, manualLabel = 'Nhập mã' }: Props) {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [manual, setManual] = useState(false);
  const [code, setCode] = useState('');
  const handled = useRef(false);

  const detect = (value: string) => {
    if (handled.current || !value.trim()) return;
    handled.current = true;
    onDetected(value.trim());
    setTimeout(() => {
      handled.current = false;
    }, 1500);
  };

  const cameraReady = permission?.granted;

  return (
    <View style={styles.root}>
      <View style={styles.camera}>
        {cameraReady ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => detect(data)}
          />
        ) : (
          <View style={styles.noCamera}>
            <Icon name="camera-off-outline" size={40} color="#FFFFFF" />
            <AppText color="onIndigo" align="center">Cần quyền camera để quét mã</AppText>
            {permission?.canAskAgain !== false ? (
              <Button label="Cho phép camera" variant="outline" fullWidth={false} onPress={requestPermission} />
            ) : null}
          </View>
        )}

        <View style={styles.overlay} pointerEvents="none">
          <AppText variant="headline" style={styles.hint}>{hint}</AppText>
          <View style={styles.frame}>
            {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
              <View key={c} style={[styles.corner, styles[c], { borderColor: colors.primary }]} />
            ))}
          </View>
        </View>
      </View>

      <View style={[styles.bottom, { backgroundColor: colors.card }]}>
        {manual ? (
          <View style={styles.manual}>
            <TextField
              placeholder="Mã giấy phép hoặc mã đơn"
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              autoFocus
            />
            <Button label="Xác nhận" onPress={() => detect(code)} />
          </View>
        ) : (
          <View style={styles.tools}>
            <Tool icon={torch ? 'flashlight-off' : 'flashlight'} label="Đèn pin" onPress={() => setTorch((t) => !t)} />
            <Tool icon="keyboard-outline" label={manualLabel} onPress={() => setManual(true)} />
          </View>
        )}
      </View>
    </View>
  );
}

function Tool({ icon, label, onPress }: { icon: 'flashlight' | 'flashlight-off' | 'keyboard-outline'; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.tool}>
      <View style={[styles.toolIcon, { backgroundColor: colors.sunken }]}>
        <Icon name={icon} size={26} color="indigo" />
      </View>
      <AppText variant="small">{label}</AppText>
    </Pressable>
  );
}

const CORNER = 28;
const styles = StyleSheet.create({
  root: { flex: 1 },
  camera: { flex: 1, backgroundColor: '#12161C', alignItems: 'center', justifyContent: 'center' },
  noCamera: { alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  hint: { color: '#FFFFFF', textAlign: 'center' },
  frame: { width: FRAME, height: FRAME },
  corner: { position: 'absolute', width: CORNER, height: CORNER },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  bottom: { padding: spacing.lg },
  manual: { gap: spacing.md },
  tools: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xxl },
  tool: { alignItems: 'center', gap: spacing.xs },
  toolIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});
