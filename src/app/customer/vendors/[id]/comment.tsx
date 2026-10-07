import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { RatingStars } from '@/components/forms/RatingStars';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { errorMessage } from '@/core/api/problem';
import { useCommentVendor } from '@/features/discovery/use-discovery';

/** BUY-04: one review per buyer per vendor; sending again replaces it. */
export default function CommentFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const comment = useCommentVendor(id ?? '');
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();

  async function send() {
    if (!text.trim()) return setError('Nhập nhận xét');
    try {
      await comment.mutateAsync({ rating, text: text.trim() });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <>
      <StackHeader title="Viết đánh giá" />
      <Screen footer={<Button label="Gửi" loading={comment.isPending} onPress={() => void send()} />}>
        <AppText variant="label" align="center">Bạn thấy quán thế nào?</AppText>
        <RatingStars value={rating} onChange={setRating} />
        <TextField
          label="Nhận xét"
          multiline
          value={text}
          onChangeText={(v) => {
            setText(v);
            setError(undefined);
          }}
          error={error}
        />
      </Screen>
    </>
  );
}
