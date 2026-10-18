import { SlotWorkspaceScreen } from '@/features/sidewalk-slots/screens/SlotWorkspaceScreen';

/** Deep links (notifications, the assistant) land on "Ô của tôi" directly. */
export default function Route() {
  return <SlotWorkspaceScreen initialMode="mine" />;
}
