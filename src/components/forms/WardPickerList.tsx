import { useState } from 'react';
import { Text, View } from 'react-native';

import { SheetOption } from '@/components/common/SheetOption';
import { colors, text } from '@/theme';
import { searchWards } from '@/utils/search';
import { TextField } from './TextField';

type WardLike = { unitId: number; unitName: string };

/**
 * The inside of a ward sheet. Đà Nẵng has 94 phường, xã and đặc khu since 1/7/2025, too many to
 * scroll through in a sheet: the person types a few letters (accents optional) and picks from at
 * most six matches. The current choice stays on top while nothing is typed.
 */
export function WardPickerList<T extends WardLike>({
  wards,
  selectedId,
  onPick,
  icon,
}: {
  wards: readonly T[];
  selectedId: number | null | undefined;
  onPick: (ward: T) => void;
  icon: { sf: string; md: string };
}) {
  const [query, setQuery] = useState('');
  const selected = wards.find((w) => w.unitId === selectedId);
  const rows = query.trim() ? searchWards(wards, query) : selected ? [selected] : [];

  return (
    // Inset from the sheet's rounded edge, which would otherwise clip the label and the hint.
    <View style={{ gap: 12, paddingHorizontal: 6, paddingVertical: 4 }}>
      <TextField
        label="Tìm phường, xã"
        value={query}
        onChangeText={setQuery}
        placeholder="VD: Hải Châu, Hòa Vang"
        autoCorrect={false}
        returnKeyType="search"
        hint={`${wards.length} phường, xã của Đà Nẵng. Gõ không dấu cũng được.`}
      />
      {rows.length > 0 ? (
        <View style={{ borderRadius: 20, overflow: 'hidden' }}>
          {rows.map((w, i) => (
            <SheetOption
              key={w.unitId}
              title={w.unitName}
              icon={icon}
              selected={w.unitId === selectedId}
              last={i === rows.length - 1}
              onPress={() => onPick(w)}
            />
          ))}
        </View>
      ) : query.trim() ? (
        <Text style={[text.footnote, { color: colors.muted }]}>Không thấy “{query.trim()}”. Thử gõ tên khác.</Text>
      ) : null}
    </View>
  );
}
