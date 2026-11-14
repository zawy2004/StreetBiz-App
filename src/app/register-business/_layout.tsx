import { Stack } from 'expo-router';

import { headerOptions } from '@/core/navigation/header-options';

export const unstable_settings = { initialRouteName: 'index' };

/**
 * Đăng ký hộ kinh doanh (REG-01/04): a five-step task presented as a modal above the vendor's
 * tabs, with its own stack so each step pushes and the system back returns one step.
 */
export default function RegisterBusinessStack() {
  return <Stack screenOptions={{ ...headerOptions, title: 'Đăng ký kinh doanh' }} />;
}
