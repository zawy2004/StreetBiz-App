import { useEffect, useState } from 'react';

import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { ListRow } from '@/components/common/ListRow';
import { EmptyState, LoadingState } from '@/components/feedback/States';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { StackHeader } from '@/components/layout/StackHeader';
import { goTo } from '@/core/navigation/go';
import { VendorCard } from '@/features/discovery/VendorCard';
import { useSearch } from '@/features/discovery/use-discovery';
import { formatVnd } from '@/utils/format';

/** Waits for typing to pause before searching, so the API is not hit on every key. */
function useDebounced(value: string, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function SearchScreen() {
  const [text, setText] = useState('');
  const { query, places, dishes, isLoading } = useSearch(useDebounced(text));

  return (
    <>
      <StackHeader title="Tìm kiếm" />
      <Screen>
        <TextField icon="magnify" placeholder="Tìm món, quán hoặc tuyến phố" value={text} onChangeText={setText} autoFocus />
        {!query ? <AppText color="muted" align="center">Nhập tên món, quán hoặc tuyến phố</AppText> : null}
        {query && isLoading ? <LoadingState /> : null}
        {query && !isLoading && !places.length && !dishes.length ? <EmptyState icon="magnify-close" title="Không tìm thấy kết quả" /> : null}
        {places.length ? (
          <Section title="Quán">
            {places.map((v) => <VendorCard key={v.key} item={v} onPress={() => goTo(`/customer/vendors/${v.vendorId}`)} />)}
          </Section>
        ) : null}
        {dishes.length ? (
          <Section title="Món">
            <Card padded={false}>
              {dishes.map((d, i) => (
                <ListRow
                  key={d.id}
                  icon="food"
                  iconTone="primary"
                  title={d.name}
                  subtitle={`${formatVnd(d.price)} · ${d.storefrontName}`}
                  last={i === dishes.length - 1}
                  onPress={() => goTo(`/customer/items/${d.id}`)}
                />
              ))}
            </Card>
          </Section>
        ) : null}
      </Screen>
    </>
  );
}
