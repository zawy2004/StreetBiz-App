export type AssistantRole = 'GUEST' | 'CUSTOMER' | 'VENDOR' | 'WARD_AUTHORITY' | 'PLATFORM_ADMIN';
export type AssistantStatus = 'GENERATING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'INTERRUPTED';
export type ResponseStyle = 'concise' | 'detailed' | 'steps';
export type AssistantAction = { id: string; label: string; kind: 'NAVIGATE'; route: string };
export type AssistantSource = {
  id: string;
  title: string;
  kind: 'LIVE_DATA' | 'PRODUCT_GUIDE' | 'LEGAL_DOCUMENT' | 'IMAGE_ANALYSIS';
  observedAt: string | null;
  documentVersion: string | null;
  actionId: string | null;
};
export type AssistantPlace = {
  latitude: number;
  longitude: number;
  distanceMeters: number | null;
  isOpenNow: boolean;
  rating: number | null;
  ratingCount: number;
  priceVnd: number | null;
};
export type AssistantCard = {
  kind: string;
  title: string;
  imageUrl?: string | null;
  fields: { label: string; value: string }[];
  actionId: string | null;
  place?: AssistantPlace | null;
};
export type AssistantLocation = { latitude: number; longitude: number };
export type BriefingItem = {
  tone: 'warning' | 'info';
  title: string;
  detail: string;
  action: AssistantAction | null;
};
export type Briefing = { observedAt: string; items: BriefingItem[] };
export type VoiceSessionStart = {
  sessionId: string;
  ticket: string;
  conversationId: string;
  expiresAt: string;
  maxSeconds: number;
  inputSampleRate: number;
  outputSampleRate: number;
  streamPath: string;
};
export type AssistantMessage = {
  id: string;
  conversationId: string;
  clientRequestId: string;
  sender: 'USER' | 'ASSISTANT';
  status: AssistantStatus;
  content: string;
  isAiGenerated: boolean;
  sources: AssistantSource[];
  cards: AssistantCard[];
  actions: AssistantAction[];
  createdAt: string;
  completedAt: string | null;
  ordinal: number;
  version: number;
  error: { code: string; message: string; retryable: boolean } | null;
  hasAttachments?: boolean;
  checklist?: { text: string; actionId: string | null }[] | null;
  responseStyle?: ResponseStyle | null;
  channel?: 'VOICE' | null;
};
export type AssistantConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  activeMessageId: string | null;
};
export type AssistantPageContext = { pageKey: string; entityId?: string };
export type SendRequest = {
  clientRequestId: string;
  content: string;
  pageContext?: AssistantPageContext;
  retryOfMessageId?: string;
  attachmentIds?: string[];
  responseStyle?: ResponseStyle;
  location?: AssistantLocation;
};
export type SendResult = { userMessage: AssistantMessage; assistantMessage: AssistantMessage };
export type AssistantEvent = {
  eventId: string;
  conversationId: string;
  messageId: string;
  clientRequestId: string;
  attempt: number;
  sequence: number;
  version: number;
  occurredAt: string;
} & (
  | { type: 'started'; payload: SendResult }
  | { type: 'delta'; payload: { delta: string } }
  | { type: 'status'; payload: { code: string; label: string } }
  | { type: 'completed' | 'failed' | 'cancelled'; payload: AssistantMessage }
);
export type Page<T> = { items: T[]; nextCursor: string | null };
export type Capabilities = {
  enabled: boolean;
  guestEnabled: boolean;
  attachmentsEnabled: boolean;
  role: AssistantRole;
  maxQuestionCharacters: number;
  retentionDays: number;
  actions: AssistantAction[];
  voiceEnabled?: boolean;
  voiceMaxSeconds?: number;
};
