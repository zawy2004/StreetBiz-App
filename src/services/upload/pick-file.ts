import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import type { PickedFile } from '@/core/api/upload';

/**
 * Picking a document on a phone: the camera (most vendors photograph their CCCD on the spot),
 * the photo library, or a PDF from files. The web's `<input type=file>`.
 */
export type PickSource = 'camera' | 'library' | 'document';

function guessName(uri: string, type: string) {
  const last = uri.split('/').pop() ?? 'file';
  if (last.includes('.')) return last;
  return `${last}.${type === 'application/pdf' ? 'pdf' : type.split('/')[1] ?? 'jpg'}`;
}

async function fromImagePicker(source: 'camera' | 'library', quality: number): Promise<PickedFile | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Chưa có quyền dùng camera', 'Hãy cho phép StreetBiz dùng camera trong Cài đặt, hoặc chọn ảnh có sẵn.');
      return null;
    }
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality, exif: false };
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;
  const a = result.assets[0];
  const type = a.mimeType ?? 'image/jpeg';
  return { uri: a.uri, name: a.fileName ?? guessName(a.uri, type), type, size: a.fileSize };
}

async function fromDocuments(types: string[]): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true });
  if (result.canceled || !result.assets[0]) return null;
  const a = result.assets[0];
  const type = a.mimeType ?? 'application/pdf';
  return { uri: a.uri, name: a.name ?? guessName(a.uri, type), type, size: a.size };
}

export async function pickFile(source: PickSource, opts: { quality?: number; documentTypes?: string[] } = {}) {
  if (source === 'document') return fromDocuments(opts.documentTypes ?? ['application/pdf', 'image/*']);
  return fromImagePicker(source, opts.quality ?? 0.8);
}

