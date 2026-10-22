import { Stack } from 'expo-router';

import { headerOptions } from '@/core/navigation/header-options';

/** Account pages shared by every role (AC02, AC03, AC05), pushed over the role's tabs. */
export default function AccountStack() {
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="password" options={{ title: 'Đổi mật khẩu' }} />
      <Stack.Screen name="sessions" options={{ title: 'Thiết bị đang đăng nhập' }} />
      <Stack.Screen name="login-history" options={{ title: 'Hoạt động đăng nhập' }} />
    </Stack>
  );
}
