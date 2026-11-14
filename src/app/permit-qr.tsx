import { useLocalSearchParams } from 'expo-router';

import { PermitQrScreen } from '@/features/digital-permits/screens/PermitQrScreen';

export default function PermitQrRoute() {
  const { contractId } = useLocalSearchParams<{ contractId?: string }>();
  return <PermitQrScreen contractId={Number(contractId)} />;
}
