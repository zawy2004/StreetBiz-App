import * as ImagePicker from 'expo-image-picker';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';

type Props = {
  uri?: string;
  onChange: (uri: string | undefined) => void;
  label?: string;
  size?: number;
};

async function pick(): Promise<string | undefined> {
  if (Platform.OS !== 'web') {
    const camera = await ImagePicker.requestCameraPermissionsAsync();
    if (camera.granted) {
      const shot = await ImagePicker.launchCameraAsync({ quality: 0.6 });
      return shot.canceled ? undefined : shot.assets[0]?.uri;
    }
  }
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
  return picked.canceled ? undefined : picked.assets[0]?.uri;
}

/** Square slot: dashed "take photo" tile, or a thumbnail with a remove button. */
export function PhotoSlot({ uri, onChange, label = 'Chụp ảnh', size = 88 }: Props) {
  const { colors } = useTheme();

  if (uri) {
    return (
      <View style={{ width: size, height: size }}>
        <Image source={{ uri }} style={[styles.img, { width: size, height: size }]} accessibilityLabel="Ảnh đã chọn" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Xoá ảnh"
          onPress={() => onChange(undefined)}
          style={[styles.remove, { backgroundColor: colors.indigo }]}
          hitSlop={8}
        >
          <Icon name="close" size={14} color="onIndigo" />
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={async () => onChange(await pick())}
      style={[styles.empty, { width: size, height: size, borderColor: colors.primary, backgroundColor: colors.card }]}
    >
      <Icon name="camera-plus-outline" size={24} color="primary" />
      <AppText variant="small" color="primary">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  img: { borderRadius: radius.card },
  remove: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  empty: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
});
