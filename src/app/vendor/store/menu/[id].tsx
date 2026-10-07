import { useLocalSearchParams } from 'expo-router';

import { EmptyState, QueryView } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { ItemForm } from '@/features/storefront/ItemForm';
import { useSellerMenu } from '@/features/storefront/use-store';
import { useMarketplaceGate } from '@/features/storefront/useMarketplaceGate';

export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { storefront } = useMarketplaceGate();
  const menu = useSellerMenu(storefront?.id);
  const item = menu.data?.items.find((m) => m.id === id);

  if (item) return <ItemForm item={item} />;
  return (
    <>
      <StackHeader title="Sửa món" />
      <Screen>
        <QueryView query={menu}>{() => <EmptyState title="Không tìm thấy món" />}</QueryView>
      </Screen>
    </>
  );
}
