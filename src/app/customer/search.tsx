import { useState } from 'react';

import { AppText } from '@/components/common/AppText';
import { EmptyState } from '@/components/feedback/States';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { StackHeader } from '@/components/layout/StackHeader';
import { ListRow } from '@/components/common/ListRow';
import { Card } from '@/components/common/Card';
import { goTo } from '@/core/navigation/go';
import { VendorCard } from '@/features/discovery/VendorCard';
import { useActiveVendors } from '@/features/discovery/useActiveVendors';
import { useMockDb } from '@/mocks/db';
import { formatVnd } from '@/utils/format';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const vendors = useActiveVendors();
  const items = useMockDb((s) => s.menuItems);
  const q = fold(query.trim());

  const places = q
    ? vendors.filter((v) => fold(`${v.storefront?.name ?? ''} ${v.vendor.business_name} ${v.slot.street}`).includes(q))
    : [];
  const dishes = q
    ? items.filter((i) => {
        const store = vendors.find((v) => v.storefront?.id === i.storefrontId);
        return store && fold(i.name).includes(q);
      })
    : [];

  return (
    <>
      <StackHeader title="Tìm kiếm" />
      <Screen>
        <TextField icon="magnify" placeholder="Tìm món, quán hoặc tuyến phố" value={query} onChangeText={setQuery} autoFocus />
        {!q ? <AppText color="muted" align="center">Nhập tên món, quán hoặc tuyến phố</AppText> : null}
        {q && !places.length && !dishes.length ? <EmptyState icon="magnify-close" title="Không tìm thấy kết quả" /> : null}
        {places.length ? (
          <Section title="Quán">
            {places.map((v) => <VendorCard key={v.vendor.id} item={v} onPress={() => goTo(`/customer/vendors/${v.vendor.id}`)} />)}
          </Section>
        ) : null}
        {dishes.length ? (
          <Section title="Món">
            <Card padded={false}>
              {dishes.map((d) => (
                <ListRow key={d.id} icon="food" title={d.name} subtitle={formatVnd(d.price)} onPress={() => goTo(`/customer/items/${d.id}`)} />
              ))}
            </Card>
          </Section>
        ) : null}
      </Screen>
    </>
  );
}
