import { useCallback, useRef, useState } from 'react';

import { Sheet } from '@/components/common/Sheet';
import { SheetOption } from '@/components/common/SheetOption';
import type { PickedFile } from '@/core/api/upload';
import { pickFile, type PickSource } from '@/services/upload/pick-file';

type Request = { title: string; allowPdf: boolean };

/**
 * "Chụp ảnh / Chọn từ thư viện / Chọn file PDF" in a native bottom sheet (an Android alert
 * holds only three buttons). `pick(title)` resolves with the file, or null if cancelled.
 */
export function useFilePicker() {
  const [request, setRequest] = useState<Request | null>(null);
  const resolver = useRef<((f: PickedFile | null) => void) | null>(null);

  const pick = useCallback((title: string, allowPdf = true) => {
    return new Promise<PickedFile | null>((resolve) => {
      resolver.current = resolve;
      setRequest({ title, allowPdf });
    });
  }, []);

  const close = (file: PickedFile | null) => {
    resolver.current?.(file);
    resolver.current = null;
  };

  const choose = async (source: PickSource) => {
    setRequest(null);
    // Let the sheet close before the system picker opens over it.
    await new Promise((r) => setTimeout(r, 250));
    close(await pickFile(source).catch(() => null));
  };

  const sheet = (
    <Sheet
      visible={request != null}
      onClose={() => {
        setRequest(null);
        close(null);
      }}
      title={request?.title ?? ''}
      subtitle="Ảnh rõ nét, đủ bốn góc, không loá đèn."
    >
      <SheetOption title="Chụp ảnh" icon={{ sf: 'camera.fill', md: 'photo_camera' }} selected={false} onPress={() => void choose('camera')} />
      <SheetOption
        title="Chọn từ thư viện ảnh"
        icon={{ sf: 'photo.on.rectangle', md: 'photo_library' }}
        selected={false}
        last={!request?.allowPdf}
        onPress={() => void choose('library')}
      />
      {request?.allowPdf ? (
        <SheetOption title="Chọn file PDF" icon={{ sf: 'doc.fill', md: 'picture_as_pdf' }} selected={false} last onPress={() => void choose('document')} />
      ) : null}
    </Sheet>
  );

  return { pick, sheet };
}
