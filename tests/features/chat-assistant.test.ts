import { appRoute } from '@/features/assistant/assistant-context';
import { applyAssistantEvent, mergeMessages, optimistic } from '@/features/assistant/assistant-state';
import type { AssistantEvent, AssistantMessage } from '@/features/assistant/types';
import { conversationTimestamp, layoutThread } from '@/features/chat/chat-format';
import type { ChatMessage } from '@/features/chat/types/chat.types';

const msg = (id: number, sentAt: string, fromMe: boolean, senderUserId = fromMe ? 1 : 2): ChatMessage => ({
  messageId: id,
  conversationId: 1,
  senderUserId,
  senderName: fromMe ? 'Tôi' : 'Quán',
  fromMe,
  body: `m${id}`,
  sentAt,
  readAt: null,
});

describe('chat thread layout (Asia/Ho_Chi_Minh)', () => {
  // 18/10/2026 15:00 at UTC+7.
  const now = Date.parse('2026-10-18T08:00:00Z');

  it('groups one sender within five minutes and breaks on the Vietnamese day', () => {
    const items = layoutThread(
      [
        msg(1, '2026-10-17T16:59:00Z', true), // 23:59 on the 17th
        msg(2, '2026-10-17T17:01:00Z', true), // 00:01 on the 18th: a new day despite 2 minutes
        msg(3, '2026-10-17T17:03:00Z', true),
        msg(4, '2026-10-17T17:04:00Z', false),
      ],
      now,
    );
    expect(items.map((i) => i.dayBreak)).toEqual(['Hôm qua', 'Hôm nay', undefined, undefined]);
    expect(items[2]!.joinsPrevious).toBe(true);
    expect(items[1]!.joinsNext).toBe(true);
    expect(items[3]!.joinsPrevious).toBe(false);
  });

  it('labels the inbox with the clock today, "Hôm qua", else the date', () => {
    expect(conversationTimestamp('2026-10-18T07:05:00Z', now)).toBe('14:05');
    expect(conversationTimestamp('2026-10-17T07:05:00Z', now)).toBe('Hôm qua');
    expect(conversationTimestamp('2026-09-27T07:05:00Z', now)).toBe('27/09');
    expect(conversationTimestamp(null, now)).toBe('');
  });
});

describe('assistant actions stay inside the asker scope (BR-41, ward/admin separation)', () => {
  it('maps web routes to the app screen doing the same job', () => {
    expect(appRoute('/vendor/registrations', 'VENDOR')).toBe('/vendor/home/registrations');
    expect(appRoute('/vendor/store/food-safety', 'VENDOR')).toBe('/vendor/home/store/food-safety');
    expect(appRoute('/vendor/slots/contracts/14', 'VENDOR')).toBe('/vendor/slots/contracts/14');
    expect(appRoute('/ward/reports', 'WARD_AUTHORITY')).toBe('/ward/more/reports');
    expect(appRoute('/ward/settings/penalties', 'WARD_AUTHORITY')).toBe('/ward/more/penalties');
    expect(appRoute('/account', 'CUSTOMER')).toBe('/customer/account');
  });

  it('never leads outside the role or to a screen the app does not have', () => {
    expect(appRoute('/platform/accounts', 'WARD_AUTHORITY')).toBeUndefined();
    expect(appRoute('/ward/dashboard', 'PLATFORM_ADMIN')).toBeUndefined();
    expect(appRoute('/vendor/finance', 'CUSTOMER')).toBeUndefined();
    expect(appRoute('/vendor/nowhere', 'VENDOR')).toBeUndefined();
    expect(appRoute('/vendor/../ward/dashboard', 'VENDOR')).toBeUndefined();
    expect(appRoute('//evil.example', 'VENDOR')).toBeUndefined();
    expect(appRoute('/customer/explore', 'GUEST')).toBe('/customer/explore');
    expect(appRoute('/account', 'GUEST')).toBeUndefined();
  });
});

describe('assistant stream merge', () => {
  const base = (over: Partial<AssistantMessage>): AssistantMessage => ({
    ...optimistic('', 'r1', 2),
    id: 'a1',
    sender: 'ASSISTANT',
    status: 'GENERATING',
    isAiGenerated: true,
    version: 1,
    ...over,
  });
  const event = (over: Partial<AssistantEvent> & Pick<AssistantEvent, 'type' | 'payload'>): AssistantEvent =>
    ({ eventId: 'e', conversationId: 'c', messageId: 'a1', clientRequestId: 'r1', attempt: 1, sequence: 1, version: 2, occurredAt: '', ...over }) as AssistantEvent;

  it('replaces the optimistic question by the server copy', () => {
    const local = optimistic('Hỏi', 'r1', 1);
    const server = { ...local, id: 'u1', version: 1 };
    expect(mergeMessages([local], [server]).map((m) => m.id)).toEqual(['u1']);
  });

  it('appends newer deltas only, and a terminal snapshot wins over GENERATING', () => {
    const start = [base({ content: 'Bạn ' })];
    const grown = applyAssistantEvent(start, event({ type: 'delta', payload: { delta: 'cần' }, version: 2 }));
    expect(grown[0]!.content).toBe('Bạn cần');
    expect(applyAssistantEvent(grown, event({ type: 'delta', payload: { delta: 'X' }, version: 2 }))[0]!.content).toBe('Bạn cần');
    const done = mergeMessages(grown, [base({ status: 'CANCELLED', content: 'Bạn', version: 1 })]);
    expect(done[0]!.status).toBe('CANCELLED');
    expect(mergeMessages(done, [base({ status: 'GENERATING', version: 9 })])[0]!.status).toBe('CANCELLED');
  });
});
