import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { RatingStars } from '@/components/forms/RatingStars';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';

export default function OrderReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const order = useMockDb((s) => s.orders).find((o) => o.id === id);
  const store = useMockDb((s) => s.storefronts).find((s) => s.id === order?.storefrontId);
  const addReview = useMockDb((s) => s.addReview);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');

  return (
    <>
      <StackHeader title="Đánh giá" />
      <Screen
        footer={
          <Button
            label="Gửi đánh giá"
            onPress={() => {
              if (!order || !user) return;
              addReview({ orderId: order.id, customerId: user.id, storefrontId: order.storefrontId, rating, text: text.trim() });
              router.back();
            }}
          />
        }
      >
        <Card><AppText variant="headline">{store?.name}</AppText></Card>
        <RatingStars value={rating} onChange={setRating} />
        <TextField label="Nhận xét" multiline value={text} onChangeText={setText} />
      </Screen>
    </>
  );
}
