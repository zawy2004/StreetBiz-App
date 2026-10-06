import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { RatingStars } from '@/components/forms/RatingStars';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';

export default function CommentFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const addComment = useMockDb((s) => s.addComment);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();

  function send() {
    if (!text.trim()) return setError('Nhập nhận xét');
    if (!user || !id) return;
    addComment({ vendorId: id, authorId: user.id, authorName: user.fullName, rating, text: text.trim() });
    router.back();
  }

  return (
    <>
      <StackHeader title="Viết đánh giá" />
      <Screen footer={<Button label="Gửi" onPress={send} />}>
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
