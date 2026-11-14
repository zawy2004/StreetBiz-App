import { fireEvent, render, screen } from '@testing-library/react-native';

import { WardPickerList } from '@/components/forms/WardPickerList';
import { searchWards } from '@/utils/search';

const CITY = 'Thành phố Đà Nẵng';
const wards = [
  { unitId: 10, unitName: 'Phường Hải Châu', parentName: CITY },
  { unitId: 101, unitName: 'Phường Hòa Cường', parentName: CITY },
  { unitId: 102, unitName: 'Phường An Khê', parentName: CITY },
  { unitId: 12, unitName: 'Phường An Hải', parentName: CITY },
  { unitId: 117, unitName: 'Phường Hội An', parentName: CITY },
  { unitId: 120, unitName: 'Xã Hòa Vang', parentName: CITY },
  { unitId: 190, unitName: 'Đặc khu Hoàng Sa', parentName: CITY },
];

describe('ward search (94 phường, xã since 1/7/2025)', () => {
  it('matches the start of a word, accents optional, names starting with it first', () => {
    const names = (q: string) => searchWards(wards, q).map((w) => w.unitName);
    expect(names('hoa cuong')).toEqual(['Phường Hòa Cường']);
    expect(names('xã hòa vang')).toEqual(['Xã Hòa Vang']);
    expect(names('hoang sa')).toEqual(['Đặc khu Hoàng Sa']);
    expect(names('an')).toEqual(['Phường An Khê', 'Phường An Hải', 'Phường Hội An']);
    expect(names(' ')).toEqual([]);
  });

  it('the sheet shows the current choice, then only what the person types finds', async () => {
    const onPick = jest.fn();
    await render(<WardPickerList wards={wards} selectedId={10} onPick={onPick} icon={{ sf: 'mappin', md: 'location_on' }} />);
    expect(screen.getByText('Phường Hải Châu')).toBeTruthy();
    expect(screen.queryByText('Xã Hòa Vang')).toBeNull();

    await fireEvent.changeText(screen.getByLabelText('Tìm phường, xã'), 'hoa vang');
    await fireEvent.press(screen.getByText('Xã Hòa Vang'));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ unitId: 120 }));

    await fireEvent.changeText(screen.getByLabelText('Tìm phường, xã'), 'zzz');
    expect(screen.getByText('Không thấy “zzz”. Thử gõ tên khác.')).toBeTruthy();
  });
});
