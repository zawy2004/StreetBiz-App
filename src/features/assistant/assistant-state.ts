import type { AssistantEvent, AssistantMessage } from './types';

/** Same merge as the web's `assistant-state.ts`: server identity wins, terminal beats GENERATING. */
export function mergeMessages(current: AssistantMessage[], incoming: AssistantMessage[]): AssistantMessage[] {
  const map = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) {
    // Replace optimistic placeholders by the server-assigned identity.
    for (const [key, old] of map)
      if (key !== m.id && old.clientRequestId === m.clientRequestId && old.sender === m.sender) map.delete(key);
    const old = map.get(m.id);
    // Cancellation can commit while deltas newer than the last DB snapshot are in flight:
    // a terminal snapshot wins over GENERATING regardless of that transient delta version.
    if (old && old.status !== 'GENERATING' && m.status === 'GENERATING') continue;
    if (old?.status === 'GENERATING' && m.status !== 'GENERATING') {
      map.set(m.id, m);
      continue;
    }
    if (!old || old.version <= m.version) map.set(m.id, m);
  }
  return [...map.values()].sort((a, b) => a.ordinal - b.ordinal || a.createdAt.localeCompare(b.createdAt));
}

export function applyAssistantEvent(messages: AssistantMessage[], event: AssistantEvent): AssistantMessage[] {
  if (event.type === 'started') return mergeMessages(messages, [event.payload.userMessage, event.payload.assistantMessage]);
  if (event.type === 'completed' || event.type === 'cancelled' || event.type === 'failed') return mergeMessages(messages, [event.payload]);
  if (event.type === 'delta')
    return messages.map((m) =>
      m.id === event.messageId && m.status === 'GENERATING' && m.version < event.version
        ? { ...m, content: m.content + event.payload.delta, version: event.version }
        : m,
    );
  return messages;
}

export function optimistic(content: string, requestId: string, ordinal: number): AssistantMessage {
  return {
    id: `local-${requestId}`,
    conversationId: '',
    clientRequestId: requestId,
    sender: 'USER',
    status: 'COMPLETED',
    content,
    isAiGenerated: false,
    sources: [],
    cards: [],
    actions: [],
    createdAt: new Date().toISOString(),
    completedAt: null,
    ordinal,
    version: 0,
    error: null,
  };
}
