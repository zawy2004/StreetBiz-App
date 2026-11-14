import { apiDelete, apiGet, apiPost } from '@/core/api/client';
import { uuid } from '@/core/utils/uuid';
import type {
  AssistantConversation,
  AssistantLocation,
  AssistantMessage,
  Briefing,
  Capabilities,
  Page,
  SendRequest,
  SendResult,
  ResponseStyle,
  VoiceSessionStart,
} from './types';

type Envelope<T> = { data: T; error: null; meta: { traceId: string } };
const root = '/chatbot';
const noCache = { headers: { 'Cache-Control': 'no-store' } };
export const assistantApi = {
  upload: async (pngBase64: string, signal?: AbortSignal) =>
    (
      await apiPost<Envelope<{ id: string; expiresAt: string }>>(
        `${root}/attachments`,
        {
          pngBase64,
          consent: true,
        },
        { signal },
      )
    ).data,
  removeAttachment: async (id: string) => apiDelete(`${root}/attachments/${id}`),
  capabilities: async () =>
    (await apiGet<Envelope<Capabilities>>(`${root}/capabilities`, noCache)).data,
  conversations: async (before?: string) =>
    (
      await apiGet<Envelope<Page<AssistantConversation>>>(`${root}/conversations`, {
        ...noCache,
        params: { before },
      })
    ).data,
  create: async (clientRequestId: string) =>
    (await apiPost<Envelope<AssistantConversation>>(`${root}/conversations`, { clientRequestId }))
      .data,
  history: async (id: string, before?: string) =>
    (
      await apiGet<Envelope<Page<AssistantMessage>>>(`${root}/conversations/${id}/messages`, {
        ...noCache,
        params: { before },
      })
    ).data,
  message: async (id: string, messageId: string) =>
    (
      await apiGet<Envelope<AssistantMessage>>(
        `${root}/conversations/${id}/messages/${messageId}`,
        noCache,
      )
    ).data,
  send: async (id: string, request: SendRequest, signal: AbortSignal) =>
    (
      await apiPost<Envelope<SendResult>>(`${root}/conversations/${id}/messages`, request, {
        timeout: 90_000,
        signal,
      })
    ).data,
  guest: async (content: string, signal: AbortSignal, responseStyle?: ResponseStyle) =>
    (
      await apiPost<Envelope<AssistantMessage>>(
        `${root}/guest/messages`,
        { content, responseStyle },
        { signal },
      )
    ).data,
  cancel: async (id: string, messageId: string) =>
    (
      await apiPost<Envelope<AssistantMessage>>(
        `${root}/conversations/${id}/messages/${messageId}/cancel`,
      )
    ).data,
  delete: async (id: string) => apiDelete(`${root}/conversations/${id}`),
  feedback: async (id: string, messageId: string, helpful: boolean) =>
    apiPost(`${root}/conversations/${id}/messages/${messageId}/feedback`, { helpful }),
  briefing: async () => (await apiGet<Envelope<Briefing>>(`${root}/briefing`, noCache)).data,
  startVoice: async (location?: AssistantLocation, simple = false) =>
    (
      await apiPost<Envelope<VoiceSessionStart>>(`${root}/voice/sessions`, {
        clientRequestId: uuid(),
        location,
        simple,
      })
    ).data,
};
