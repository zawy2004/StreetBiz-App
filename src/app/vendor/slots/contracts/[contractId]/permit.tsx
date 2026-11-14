import { useLocalSearchParams } from 'expo-router';

import { DigitalPermitScreen } from '@/features/digital-permits/screens/DigitalPermitScreen';

/** V19 Giấy phép số for one rental contract. */
export default function PermitRoute() {
  const { contractId } = useLocalSearchParams<{ contractId: string }>();
  return <DigitalPermitScreen contractId={Number(contractId)} />;
}
