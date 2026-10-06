import { useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { ItemForm } from '@/features/storefront/ItemForm';
import { useMockDb } from '@/mocks/db';

export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useMockDb((s) => s.menuItems).find((m) => m.id === id);

  if (!item) {
    return (
      <>
        <StackHeader title="Sửa món" />
        <Screen><EmptyState title="Không tìm thấy món" /></Screen>
      </>
    );
  }
  return <ItemForm item={item} />;
}
