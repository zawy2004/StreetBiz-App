import { Sheet } from '@/components/common/Sheet';
import { SheetOption } from '@/components/common/SheetOption';
import type { StorefrontSort } from '@/core/api/commerce-api';
import { formatDistance } from '@/utils/format';
import { useServiceAreas } from '../discovery-api';
import { SORT_LABELS, useDiscoveryStore } from '../discovery-store';
import { LOCATE_MESSAGES } from '../geolocation';

type SheetProps = { visible: boolean; onClose: () => void };

/**
 * Where to browse (the web's LocationBar + area select): "around me" from the phone's
 * position, every ward, or one ward (nearest first once the position is known).
 */
export function AreaSheet({ visible, onClose }: SheetProps) {
  const areas = useServiceAreas();
  const wardId = useDiscoveryStore((s) => s.filters.wardId);
  const position = useDiscoveryStore((s) => s.position);
  const status = useDiscoveryStore((s) => s.locateStatus);
  const { setFilters, locate, clearPosition } = useDiscoveryStore.getState();
  const list = areas.data ?? [];
  const failure =
    status === 'DENIED' || status === 'FAILED' || status === 'UNAVAILABLE' ? LOCATE_MESSAGES[status] : null;

  return (
    <Sheet visible={visible} onClose={onClose} title="Khu vực" subtitle="Phường có quán vỉa hè được cấp phép.">
      <SheetOption
        title={position ? 'Quanh vị trí của tôi' : 'Tìm quanh tôi'}
        subtitle={
          status === 'LOCATING'
            ? 'Đang lấy vị trí…'
            : position
              ? 'Quán gần bạn lên trước. Chạm để tắt.'
              : (failure ?? 'Dùng vị trí điện thoại để xếp quán gần nhất lên trước')
        }
        icon={{ sf: 'location.fill', md: 'my_location' }}
        selected={!!position}
        onPress={async () => {
          if (position) {
            clearPosition();
            return;
          }
          await locate();
          if (useDiscoveryStore.getState().position) onClose();
        }}
      />
      <SheetOption
        title="Tất cả khu vực"
        subtitle={`${list.reduce((n, a) => n + a.storefrontCount, 0)} quán ở ${list.length} phường`}
        icon={{ sf: 'map.fill', md: 'map' }}
        selected={wardId == null}
        last={list.length === 0}
        onPress={() => {
          setFilters({ wardId: null });
          onClose();
        }}
      />
      {list.map((a, i) => (
        <SheetOption
          key={a.wardId}
          title={a.wardName}
          subtitle={`${a.storefrontCount} quán${a.distanceMeters != null ? `, cách ${formatDistance(a.distanceMeters)}` : ''}`}
          icon={{ sf: 'mappin.and.ellipse', md: 'location_on' }}
          selected={a.wardId === wardId}
          last={i === list.length - 1}
          onPress={() => {
            setFilters({ wardId: a.wardId });
            onClose();
          }}
        />
      ))}
    </Sheet>
  );
}

const SORT_OPTIONS: { key: StorefrontSort; note: string; icon: { sf: string; md: string } }[] = [
  { key: 'distance', note: 'Quán gần bạn lên trước', icon: { sf: 'location.north.fill', md: 'near_me' } },
  { key: 'rating', note: 'Điểm cộng đồng cao lên trước', icon: { sf: 'star.fill', md: 'star' } },
  { key: 'name', note: 'Theo bảng chữ cái', icon: { sf: 'textformat', md: 'sort_by_alpha' } },
];

/** Sort order. "Gần nhất" needs the phone's position, so it asks for it first. */
export function SortSheet({ visible, onClose }: SheetProps) {
  const sort = useDiscoveryStore((s) => s.sort);
  const position = useDiscoveryStore((s) => s.position);
  const status = useDiscoveryStore((s) => s.locateStatus);
  const { setSort, locate } = useDiscoveryStore.getState();
  const failure =
    status === 'DENIED' || status === 'FAILED' || status === 'UNAVAILABLE' ? LOCATE_MESSAGES[status] : null;
  return (
    <Sheet visible={visible} onClose={onClose} title="Sắp xếp">
      {SORT_OPTIONS.map((o, i) => (
        <SheetOption
          key={o.key}
          title={SORT_LABELS[o.key]}
          subtitle={
            o.key === 'distance' && !position
              ? status === 'LOCATING'
                ? 'Đang lấy vị trí…'
                : (failure ?? 'Cần vị trí của bạn, chạm để cho phép')
              : o.note
          }
          icon={o.icon}
          selected={o.key === sort}
          last={i === SORT_OPTIONS.length - 1}
          onPress={async () => {
            if (o.key === 'distance' && !position) {
              await locate();
              if (!useDiscoveryStore.getState().position) return;
            }
            setSort(o.key);
            onClose();
          }}
        />
      ))}
    </Sheet>
  );
}
