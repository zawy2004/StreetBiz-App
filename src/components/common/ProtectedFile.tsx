import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showToast } from '@/components/feedback/Toast';
import { downloadToCache, errorMessage } from '@/core/api';
import { colors, fonts, radius, text } from '@/theme';
import { Icon } from './Icon';

const isPdf = (url: string) => /\.pdf($|\?)/i.test(url);

/** A file behind the bearer token, fetched once into the cache (the web's blob URL). */
export function useProtectedFile(fileUrl: string | null | undefined) {
  return useQuery({
    queryKey: ['protected-file', fileUrl],
    queryFn: () => downloadToCache(fileUrl!),
    enabled: !!fileUrl,
    staleTime: Infinity,
  });
}

/** Opens a protected file with the phone's own viewer/share sheet (PDF, Word…). */
export async function shareProtectedFile(fileUrl: string, fileName?: string, mimeType?: string) {
  try {
    const uri = await downloadToCache(fileUrl, fileName);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType, dialogTitle: fileName });
    else showToast('Điện thoại không mở được file này.', 'error');
  } catch (err) {
    showToast(errorMessage(err), 'error');
  }
}

/**
 * An evidence document as a tile: the photo itself (fetched with the token), or a PDF mark
 * that opens in the phone's viewer. A photo opens full screen on tap.
 */
export function ProtectedFileTile({ fileUrl, label }: { fileUrl: string; label: string }) {
  const pdf = isPdf(fileUrl);
  const file = useProtectedFile(pdf ? null : fileUrl);
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <View style={{ width: '47.5%', flexGrow: 1, gap: 6 }}>
      <Pressable
        onPress={() => (pdf ? void shareProtectedFile(fileUrl, `${label}.pdf`, 'application/pdf') : file.data && setOpen(true))}
        accessibilityRole="button"
        accessibilityLabel={`${label}${pdf ? ', file PDF' : ', ảnh'}. Bấm để xem`}
        style={{ height: 116, borderRadius: radius.photo, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.sunken, alignItems: 'center', justifyContent: 'center' }}
      >
        {pdf ? (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Icon sf="doc.richtext.fill" md="picture_as_pdf" size={30} color={colors.danger} />
            <Text style={[text.caption, { color: colors.ink }]}>Mở PDF</Text>
          </View>
        ) : file.isLoading ? (
          <ActivityIndicator color={colors.cta} />
        ) : file.isError ? (
          <View style={{ alignItems: 'center', gap: 4, padding: 8 }}>
            <Icon sf="exclamationmark.triangle" md="broken_image" size={22} color={colors.muted} />
            <Text style={[text.caption, { color: colors.muted, textAlign: 'center' }]}>Không tải được ảnh</Text>
          </View>
        ) : (
          <Image source={{ uri: file.data }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        )}
      </Pressable>
      <Text style={[text.footnote, { color: colors.ink, fontFamily: fonts.semibold }]} numberOfLines={1}>
        {label}
      </Text>
      <Modal visible={open} animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: '#0B0F14' }}>
          <Image source={{ uri: file.data }} style={{ flex: 1 }} contentFit="contain" />
          <Pressable
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Đóng"
            style={{ position: 'absolute', top: insets.top + 12, right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon sf="xmark" md="close" size={18} color={colors.white} weight="bold" />
          </Pressable>
          <Text style={{ position: 'absolute', bottom: insets.bottom + 18, alignSelf: 'center', fontFamily: fonts.semibold, color: colors.white }}>{label}</Text>
        </View>
      </Modal>
    </View>
  );
}
