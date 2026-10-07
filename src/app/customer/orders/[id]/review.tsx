import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { QueryView } from '@/components/feedback/States';
import { showError, showToast } from '@/components/feedback/Toast';
import { RatingStars } from '@/components/forms/RatingStars';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { useMyOrder, useOrderReview, useSaveReview } from '@/features/orders/use-orders';

/** ORD-04: rate a completed order (saving again edits the review). */
export default function OrderReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = useOrderReview(id);

  return (
    <>
      <StackHeader title={existing.data ? 'Sửa đánh giá' : 'Đánh giá'} />
      <QueryView query={existing}>
        {(review) => <ReviewForm key={review ? 'edit' : 'new'} orderId={id ?? ''} initial={review ?? { rating: 5, text: '' }} />}
      </QueryView>
    </>
  );
}

function ReviewForm({ orderId, initial }: { orderId: string; initial: { rating: number; text: string } }) {
  const order = useMyOrder(orderId).data;
  const save = useSaveReview(orderId, order?.storefrontId ?? '');
  const [rating, setRating] = useState(initial.rating);
  const [text, setText] = useState(initial.text);

  async function send() {
    try {
      await save.mutateAsync({ rating, text: text.trim() });
      showToast('Cảm ơn bạn đã đánh giá');
      router.back();
    } catch (e) {
      showError(e);
    }
  }

  return (
    <Screen footer={<Button label="Gửi đánh giá" loading={save.isPending} onPress={() => void send()} />}>
      <Card><AppText variant="headline">{order?.storefrontName ?? ''}</AppText></Card>
      <RatingStars value={rating} onChange={setRating} />
      <TextField label="Nhận xét" multiline value={text} onChangeText={setText} placeholder="Món ăn, thái độ phục vụ, thời gian chờ…" />
    </Screen>
  );
}
