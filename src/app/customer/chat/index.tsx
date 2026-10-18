import { ComingSoon } from '@/components/layout/ComingSoon';

export default function Route() {
  return (
    <ComingSoon
      title="Tin nhắn"
      icon={{ sf: 'bubble.left.and.bubble.right', md: 'chat' }}
      body="Trò chuyện với quầy."
      group="G7"
    />
  );
}
