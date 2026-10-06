import { Stack, useLocalSearchParams } from 'expo-router';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Screen } from '@/components/layout/Screen';
import { SuccessView } from '@/components/layout/SuccessView';
import { goRoot } from '@/core/navigation/go';

export default function RegistrationDoneScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <Screen
        footer={
          <>
            <Button
              label="Theo dõi hồ sơ"
              onPress={() => {
                goRoot(`/vendor/registrations/${id}`);
              }}
            />
            <Button
              label="Về trang chủ"
              variant="ghost"
              onPress={() => {
                goRoot('/vendor/home');
              }}
            />
          </>
        }
      >
        <SuccessView title="Đã nộp hồ sơ" subtitle="Phường sẽ phản hồi trong 3 ngày làm việc">
          <AppText variant="code" color="muted">Mã {id}</AppText>
        </SuccessView>
      </Screen>
    </>
  );
}
