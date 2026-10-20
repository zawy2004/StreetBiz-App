import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/common/Icon';
import { Sheet } from '@/components/common/Sheet';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { AiTag, aiPanel } from '@/components/status/AiTag';
import { isLiveApi } from '@/core/config/env';
import { directionsUrl } from '@/features/buyer-discovery/discovery-format';
import { detectPosition, LOCATE_MESSAGES, LocateError } from '@/features/buyer-discovery/geolocation';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, shadow, space, tabular, text } from '@/theme';
import { assistantApi } from '../assistant-api';
import { appRoute, followUps, suggestions, welcome } from '../assistant-context';
import { AnswerText } from '../components/AnswerText';
import type { AssistantAction, AssistantCard, AssistantLocation, AssistantMessage, AssistantRole, AssistantSource, Briefing, ResponseStyle } from '../types';
import { useAssistant } from '../useAssistant';

const VN_CLOCK = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
const clock = (value: string | null | undefined) => (value ? VN_CLOCK.format(new Date(value)) : '');

const STYLES: { key: ResponseStyle; label: string }[] = [
  { key: 'concise', label: 'Ngắn gọn' },
  { key: 'detailed', label: 'Chi tiết' },
  { key: 'steps', label: 'Từng bước' },
];

const SOURCE_KIND: Record<AssistantSource['kind'], { label: string; sf: string; md: string }> = {
  LIVE_DATA: { label: 'Dữ liệu trực tiếp', sf: 'cylinder.split.1x2', md: 'database' },
  PRODUCT_GUIDE: { label: 'Hướng dẫn sản phẩm', sf: 'book', md: 'menu_book' },
  LEGAL_DOCUMENT: { label: 'Văn bản pháp lý', sf: 'scale.3d', md: 'gavel' },
  IMAGE_ANALYSIS: { label: '[AI] Nhận định từ ảnh', sf: 'photo', md: 'image' },
};

/**
 * Trợ lý StreetBiz [AI]: asks in plain Vietnamese, answers from the asker's own live data
 * plus the product guide and legal texts, with every answer labelled [AI] (BR-42).
 * It only reads and explains: its buttons open screens, they never approve, pay or
 * record anything (BR-41). Voice and photo questions stay on the web for now.
 */
export function AssistantScreen() {
  const user = useAuthStore((s) => s.user);
  const role: AssistantRole = (user?.role_code as AssistantRole | undefined) ?? 'GUEST';
  // Opened from a screen that names what it shows (the ward dashboard): the server preloads it.
  const params = useLocalSearchParams<{ pageKey?: string; entityId?: string }>();
  const pageContext = params.pageKey ? { pageKey: params.pageKey, ...(params.entityId ? { entityId: params.entityId } : {}) } : undefined;
  const chat = useAssistant(role, String(user?.id ?? 'guest'), pageContext);
  const headerHeight = useHeaderHeight();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [style, setStyle] = useState<ResponseStyle>('concise');
  const [location, setLocation] = useState<AssistantLocation>();
  const briefing = useQuery({
    queryKey: ['assistant', 'briefing', user?.id ?? 'guest'],
    queryFn: assistantApi.briefing,
    enabled: isLiveApi && (role === 'VENDOR' || role === 'WARD_AUTHORITY'),
    staleTime: 60_000,
  });

  const open = (route: string) => {
    const href = appRoute(route, role);
    if (!href) return;
    router.dismiss();
    router.push(href as Href);
  };
  const ask = (content: string) => void chat.send(content, { responseStyle: style, location });

  const header = (
    <Stack.Screen
      options={{
        title: 'Trợ lý StreetBiz',
        headerLeft: () => (
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Đóng trợ lý" style={{ paddingHorizontal: 4, marginRight: 16, minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.primary }}>Đóng</Text>
          </Pressable>
        ),
        headerRight:
          role !== 'GUEST'
            ? () => (
                <Pressable onPress={() => setHistoryOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Các cuộc trò chuyện" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon sf="clock.arrow.circlepath" md="history" size={21} color={colors.ink} />
                </Pressable>
              )
            : undefined,
      }}
    />
  );

  if (!isLiveApi) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.md }}>
        {header}
        <StateView icon={{ sf: 'sparkles', md: 'auto_awesome' }} tone="neutral" title="Chưa nối máy chủ" body="Trợ lý chỉ chạy khi ứng dụng nối với máy chủ StreetBiz." />
      </View>
    );
  }
  const caps = chat.capabilities;
  if (caps && (!caps.enabled || (role === 'GUEST' && !caps.guestEnabled))) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.md }}>
        {header}
        <StateView
          icon={{ sf: 'sparkles', md: 'auto_awesome' }}
          tone="neutral"
          title={caps.enabled ? 'Đăng nhập để dùng trợ lý' : 'Trợ lý đang tạm tắt'}
          body={caps.enabled ? 'Trợ lý cho khách đang tắt. Đăng nhập để hỏi về hồ sơ, ô thuê và phí của bạn.' : 'Quản trị nền tảng đang tạm tắt trợ lý. Mọi chức năng khác vẫn dùng bình thường.'}
          action={caps.enabled ? { label: 'Đăng nhập', onPress: () => router.push('/auth/sign-in') } : undefined}
        />
      </View>
    );
  }

  const items = [...chat.messages].reverse();
  const lastAssistant = [...chat.messages].reverse().find((m) => m.sender === 'ASSISTANT');
  const maxChars = caps?.maxQuestionCharacters ?? 4000;

  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={{ flex: 1, backgroundColor: colors.bg }}>
      {header}
      <FlatList
        // Inverted only with messages: an inverted list also turns its empty state round.
        inverted={items.length > 0}
        data={items}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ padding: space.md, gap: 14, flexGrow: 1 }}
        renderItem={({ item }) =>
          item.sender === 'USER' ? (
            <UserBubble message={item} />
          ) : (
            <AnswerCard
              message={item}
              role={role}
              status={item.status === 'GENERATING' ? chat.status : ''}
              latest={item.id === lastAssistant?.id}
              busy={chat.busy}
              onOpen={open}
              onAsk={ask}
              onRetry={() => chat.regenerate(item, style)}
              onFeedback={(helpful) => chat.feedback(item, helpful)}
              canRate={role !== 'GUEST'}
            />
          )
        }
        ListFooterComponent={
          chat.hasOlder ? (
            <Pressable onPress={() => void chat.loadOlder()} accessibilityRole="button" hitSlop={6} style={({ pressed }) => ({ alignSelf: 'center', paddingHorizontal: 16, minHeight: 36, borderRadius: radius.full, justifyContent: 'center', backgroundColor: pressed ? colors.brandTint : colors.card, boxShadow: shadow.card })}>
              <Text style={[text.caption, { color: colors.ink }]}>Xem tin cũ hơn</Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          <View style={{ flex: 1 }}>
            <Welcome role={role} briefing={role === 'VENDOR' || role === 'WARD_AUTHORITY' ? briefing.data : undefined} onAsk={ask} onOpen={open} capabilityError={chat.capabilityError} />
          </View>
        }
      />
      <Composer
        role={role}
        busy={chat.busy}
        error={chat.error}
        maxChars={maxChars}
        style={style}
        onStyle={setStyle}
        location={location}
        onLocation={setLocation}
        onSend={ask}
        onStop={() => void chat.stop()}
        onRetryRequest={chat.retryRequest}
      />
      <Sheet visible={historyOpen} onClose={() => setHistoryOpen(false)} title="Các cuộc trò chuyện" subtitle={caps ? `Lưu ${caps.retentionDays} ngày, chỉ bạn xem được.` : undefined}>
        <View style={{ gap: 8 }}>
          <HistoryRow
            icon={{ sf: 'square.and.pencil', md: 'edit_square' }}
            title="Cuộc trò chuyện mới"
            selected={!chat.conversationId}
            onPress={() => {
              setHistoryOpen(false);
              void chat.select();
            }}
          />
          {chat.conversations.map((c) => (
            <HistoryRow
              key={c.id}
              icon={{ sf: 'bubble.left', md: 'chat_bubble_outline' }}
              title={c.title}
              note={clock(c.updatedAt)}
              selected={c.id === chat.conversationId}
              onPress={() => {
                setHistoryOpen(false);
                void chat.select(c.id);
              }}
            />
          ))}
          {chat.hasMoreConversations ? (
            <Pressable onPress={() => void chat.loadConversations(true)} accessibilityRole="button" style={{ alignSelf: 'center', padding: 10 }}>
              <Text style={[text.subhead, { color: colors.primary }]}>Xem thêm</Text>
            </Pressable>
          ) : null}
          {chat.conversationId ? (
            <Pressable
              onPress={() =>
                Alert.alert('Xoá cuộc trò chuyện này?', 'Nội dung sẽ bị xoá khỏi lịch sử của bạn.', [
                  { text: 'Huỷ', style: 'cancel' },
                  {
                    text: 'Xoá',
                    style: 'destructive',
                    onPress: () => {
                      setHistoryOpen(false);
                      void chat.remove();
                    },
                  },
                ])
              }
              accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, marginTop: 6, borderRadius: radius.control, backgroundColor: pressed ? colors.dangerTint : 'transparent' })}
            >
              <Icon sf="trash" md="delete" size={18} color={colors.onDanger} />
              <Text style={[text.subhead, { color: colors.onDanger }]}>Xoá cuộc trò chuyện đang mở</Text>
            </Pressable>
          ) : null}
        </View>
      </Sheet>
    </KeyboardAvoidingView>
  );
}

function HistoryRow({ icon, title, note, selected, onPress }: { icon: { sf: string; md: string }; title: string; note?: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 14, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: selected ? colors.brandTint : pressed ? colors.sunken : colors.card })}
    >
      <Icon sf={icon.sf} md={icon.md} size={18} color={selected ? colors.primary : colors.muted} />
      <Text numberOfLines={1} style={[text.callout, { flex: 1, color: colors.ink, fontFamily: selected ? fonts.semibold : fonts.regular }]}>{title}</Text>
      {note ? <Text style={[text.caption, tabular, { color: colors.muted }]}>{note}</Text> : null}
    </Pressable>
  );
}

/** The empty conversation: who the assistant is for this role, today's briefing, ways to start. */
function Welcome({ role, briefing, onAsk, onOpen, capabilityError }: { role: AssistantRole; briefing?: Briefing; onAsk: (q: string) => void; onOpen: (route: string) => void; capabilityError: string }) {
  const w = welcome(role);
  return (
    <View style={{ gap: 22, paddingTop: 8 }}>
      <View style={{ alignItems: 'center', gap: 10 }}>
        {/* The assistant's mark: a mango sticker, stuck on slightly askew (AI is mango, never orange) */}
        <View style={{ width: 72, height: 72, borderRadius: radius.full, backgroundColor: colors.sticker, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.white, boxShadow: shadow.raised, transform: [{ rotate: '-6deg' }] }}>
          <Icon sf="sparkles" md="auto_awesome" size={32} color={colors.plate} />
        </View>
        <AiTag label="Trợ lý StreetBiz" style={{ alignSelf: 'center', marginTop: 4 }} />
        <Text style={[text.title2, { color: colors.ink, textAlign: 'center' }]}>{w.title}</Text>
        <Text style={[text.callout, { color: colors.muted, textAlign: 'center', maxWidth: 340 }]}>{w.description}</Text>
      </View>

      {briefing && briefing.items.length > 0 ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <Text accessibilityRole="header" style={{ flex: 1, fontFamily: fonts.heavy, fontSize: 17, color: colors.ink }}>
              {`Việc cần để ý (${briefing.items.length})`}
            </Text>
            <Text style={[text.caption, tabular, { color: colors.muted }]}>{`cập nhật ${clock(briefing.observedAt)}`}</Text>
          </View>
          <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>
            {briefing.items.map((item, i) => {
              const href = item.action ? appRoute(item.action.route, role) : undefined;
              const warn = item.tone === 'warning';
              return (
                <Pressable
                  key={i}
                  disabled={!href}
                  onPress={() => item.action && onOpen(item.action.route)}
                  accessibilityRole={href ? 'button' : undefined}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: pressed ? colors.pressed : colors.card, borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator })}
                >
                  <View style={{ width: 40, height: 40, borderRadius: radius.full, backgroundColor: warn ? colors.mangoTint : colors.signTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon sf={warn ? 'exclamationmark.triangle.fill' : 'info.circle.fill'} md={warn ? 'warning' : 'info'} size={19} color={warn ? colors.onMango : colors.sign} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[text.headline, { color: colors.ink }]}>{item.title}</Text>
                    <Text style={[text.footnote, { color: colors.muted }]}>{item.detail}</Text>
                    {href && item.action ? <Text style={[text.subhead, { color: colors.primary, marginTop: 4 }]}>{item.action.label}</Text> : null}
                  </View>
                  {href ? <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 17, color: colors.ink }}>Thử hỏi</Text>
        <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>
          {suggestions(role).map((q, i) => (
            <Pressable key={q} onPress={() => onAsk(q)} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: pressed ? colors.mangoTint : colors.card, borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator })}>
              <View style={{ width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.mangoTint, alignItems: 'center', justifyContent: 'center' }}>
                <Icon sf="text.bubble.fill" md="chat_bubble" size={15} color={colors.onMango} />
              </View>
              <Text style={[text.callout, { flex: 1, color: colors.ink }]}>{q}</Text>
              <Icon sf="arrow.up.circle.fill" md="arrow_circle_up" size={20} color={colors.primary} />
            </Pressable>
          ))}
        </View>
      </View>

      {capabilityError ? <Text style={[text.footnote, { color: colors.onDanger, textAlign: 'center' }]}>{capabilityError}</Text> : null}
      <Text style={[text.caption, { color: colors.muted, textAlign: 'center' }]}>
        [AI] Trợ lý chỉ tra cứu và gợi ý; không tự duyệt, thanh toán hay ghi nhận điều gì. Hãy đối chiếu trên màn hình gốc trước khi làm.
      </Text>
    </View>
  );
}

function UserBubble({ message }: { message: AssistantMessage }) {
  return (
    <View style={{ alignSelf: 'flex-end', maxWidth: '85%', paddingHorizontal: 15, paddingVertical: 10, borderRadius: radius.card, borderBottomRightRadius: radius.plate, borderCurve: 'continuous', backgroundColor: colors.cta }}>
      <Text selectable style={{ fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, color: colors.white }}>{message.content}</Text>
    </View>
  );
}

function AnswerCard({
  message,
  role,
  status,
  latest,
  busy,
  canRate,
  onOpen,
  onAsk,
  onRetry,
  onFeedback,
}: {
  message: AssistantMessage;
  role: AssistantRole;
  status: string;
  latest: boolean;
  busy: boolean;
  canRate: boolean;
  onOpen: (route: string) => void;
  onAsk: (q: string) => void;
  onRetry: () => void;
  onFeedback: (helpful: boolean) => Promise<boolean>;
}) {
  const [rated, setRated] = useState<boolean>();
  const [rating, setRating] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const generating = message.status === 'GENERATING';
  const failed = message.status === 'FAILED' || message.status === 'INTERRUPTED' || message.status === 'CANCELLED';
  // Only actions with a matching app screen inside the asker's own area are offered.
  const actions = message.actions.filter((a) => appRoute(a.route, role));
  const actionFor = (id: string | null) => (id ? actions.find((a) => a.id === id) : undefined);
  const looseActions = actions.filter((a) => !message.cards.some((c) => c.actionId === a.id) && !message.checklist?.some((s) => s.actionId === a.id)).slice(0, 3);
  const live = message.sources.find((s) => s.kind === 'LIVE_DATA');
  const more = latest && !busy ? followUps(message, role) : [];

  const rate = async (helpful: boolean) => {
    if (rating || rated !== undefined) return;
    setRating(true);
    const ok = await onFeedback(helpful);
    setRating(false);
    if (ok) {
      setRated(helpful);
      void Haptics.selectionAsync();
      showToast('Đã ghi nhận góp ý của bạn');
    }
  };

  return (
    <View accessibilityLabel="Câu trả lời AI" style={{ alignSelf: 'stretch', gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 28, height: 28, borderRadius: radius.full, backgroundColor: colors.sticker, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf="sparkles" md="auto_awesome" size={14} color={colors.plate} />
        </View>
        <AiTag label="Trợ lý StreetBiz" />
        {!generating ? <Text style={[text.caption, tabular, { color: colors.muted }]}>{clock(message.completedAt ?? message.createdAt)}</Text> : null}
      </View>
      <View style={[aiPanel, { backgroundColor: colors.card, borderColor: colors.line, borderRadius: radius.photo, gap: 12, boxShadow: shadow.card }]}>
        {generating && !message.content ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityRole="progressbar" accessibilityLabel="Đang soạn câu trả lời">
            <ActivityIndicator color={colors.cta} />
            <Text style={[text.footnote, { color: colors.muted }]}>{status || 'Đang soạn câu trả lời…'}</Text>
          </View>
        ) : null}
        {message.content ? <AnswerText markdown={message.content} /> : null}
        {generating && message.content && status ? <Text style={[text.caption, { color: colors.muted }]}>{status}</Text> : null}

        {failed ? (
          <View style={{ gap: 8 }}>
            <Text style={[text.footnote, { color: colors.onDanger }]}>
              {message.error?.message ?? (message.status === 'CANCELLED' ? 'Đã dừng câu trả lời.' : 'Trợ lý chưa trả lời được câu này.')}
            </Text>
            {message.error?.retryable !== false ? (
              <Pressable onPress={onRetry} disabled={busy} accessibilityRole="button" hitSlop={4} style={({ pressed }) => ({ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: radius.full, backgroundColor: pressed ? '#FFD3BA' : colors.brandTint })}>
                <Icon sf="arrow.clockwise" md="refresh" size={15} color={colors.primary} />
                <Text style={[text.subhead, { fontFamily: fonts.heavy, color: colors.primary }]}>Hỏi lại</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {message.cards.length > 0 ? (
          <View style={{ gap: 8 }}>
            {live?.observedAt ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.leaf }} />
                <Text style={[text.caption, tabular, { color: colors.onLeaf }]}>{`Dữ liệu trực tiếp lúc ${clock(live.observedAt)}`}</Text>
              </View>
            ) : null}
            {message.cards.map((card, i) => (
              <ResultCard key={`${card.title}-${i}`} card={card} action={actionFor(card.actionId)} onOpen={onOpen} />
            ))}
          </View>
        ) : null}

        {message.checklist?.length ? (
          <View style={{ gap: 8 }}>
            <Text style={[text.subhead, { fontFamily: fonts.heavy, color: colors.ink }]}>{`Các bước tiếp theo (${message.checklist.length} bước)`}</Text>
            <Text style={[text.caption, { color: colors.muted }]}>Hướng dẫn đối chiếu; chưa xác nhận các bước đã hoàn tất.</Text>
            {message.checklist.map((step, i) => {
              const action = actionFor(step.actionId);
              return (
                <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ width: 26, height: 26, borderRadius: radius.full, backgroundColor: colors.mangoTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={[{ fontFamily: fonts.heavy, fontSize: 12.5, color: colors.onMango }, tabular]}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text selectable style={[text.callout, { color: colors.ink }]}>{step.text}</Text>
                    {action ? <LinkButton label={action.label} onPress={() => onOpen(action.route)} /> : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {!generating && looseActions.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {looseActions.map((a, i) => (
              <Pressable key={a.id} onPress={() => onOpen(a.route)} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 16, borderRadius: radius.full, backgroundColor: i === 0 ? (pressed ? colors.ctaPressed : colors.cta) : pressed ? '#FFD3BA' : colors.brandTint, boxShadow: i === 0 ? shadow.glow : undefined })}>
                <Text style={{ fontFamily: fonts.heavy, fontSize: 14, color: i === 0 ? colors.white : colors.primary }}>{a.label}</Text>
                <Icon sf="chevron.right" md="chevron_right" size={13} color={i === 0 ? colors.white : colors.primary} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {message.sources.length > 0 ? (
          <View style={{ gap: 6 }}>
            <Pressable onPress={() => setSourcesOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: sourcesOpen }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 }}>
              <Icon sf="doc.text.magnifyingglass" md="find_in_page" size={15} color={colors.muted} />
              <Text style={[text.caption, { flex: 1, color: colors.muted }]}>{`Nguồn đã tra cứu (${message.sources.length})`}</Text>
              <Icon sf={sourcesOpen ? 'chevron.up' : 'chevron.down'} md={sourcesOpen ? 'expand_less' : 'expand_more'} size={15} color={colors.muted} />
            </Pressable>
            {sourcesOpen
              ? message.sources.map((s) => (
                  <View key={s.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                    <Icon sf={SOURCE_KIND[s.kind].sf} md={SOURCE_KIND[s.kind].md} size={14} color={colors.sign} />
                    <Text selectable style={[text.caption, { flex: 1, color: colors.ink }]}>
                      <Text style={{ fontFamily: fonts.semibold, color: colors.sign }}>{`${SOURCE_KIND[s.kind].label}: `}</Text>
                      {s.title}
                      {s.observedAt ? `, lúc ${clock(s.observedAt)}` : ''}
                      {s.documentVersion ? `, ${s.documentVersion}` : ''}
                    </Text>
                  </View>
                ))
              : null}
          </View>
        ) : null}

        {!generating && !failed && canRate && message.isAiGenerated ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 }}>
            <Text style={[text.caption, { flex: 1, color: colors.muted }]}>{rated === undefined ? 'Câu trả lời có ích không?' : 'Cảm ơn góp ý của bạn'}</Text>
            <RateButton icon={{ sf: rated === true ? 'hand.thumbsup.fill' : 'hand.thumbsup', md: 'thumb_up' }} label="Có ích" on={rated === true} disabled={rating || rated !== undefined} onPress={() => void rate(true)} />
            <RateButton icon={{ sf: rated === false ? 'hand.thumbsdown.fill' : 'hand.thumbsdown', md: 'thumb_down' }} label="Chưa đúng" on={rated === false} disabled={rating || rated !== undefined} onPress={() => void rate(false)} />
            {message.channel !== 'VOICE' ? (
              <RateButton icon={{ sf: 'arrow.clockwise', md: 'refresh' }} label="Tạo lại câu trả lời" on={false} disabled={busy} onPress={onRetry} />
            ) : null}
          </View>
        ) : null}
      </View>

      {more.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {more.map((q) => (
            <Pressable key={q} onPress={() => onAsk(q)} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: radius.full, backgroundColor: pressed ? colors.sticker : colors.mangoTint })}>
              <Icon sf="sparkles" md="auto_awesome" size={13} color={colors.onMango} />
              <Text style={[text.subhead, { color: colors.onMango }]}>{q}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function RateButton({ icon, label, on, disabled, onPress }: { icon: { sf: string; md: string }; label: string; on: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on, disabled }} hitSlop={2} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.mangoTint : pressed ? colors.sunken : 'transparent', opacity: disabled && !on ? 0.45 : 1 })}>
      <Icon sf={icon.sf} md={icon.md} size={18} color={on ? colors.onMango : colors.muted} />
    </Pressable>
  );
}

function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36 }}>
      <Text style={[text.subhead, { fontFamily: fonts.heavy, color: colors.primary }]}>{label}</Text>
      <Icon sf="chevron.right" md="chevron_right" size={12} color={colors.primary} />
    </Pressable>
  );
}

/** A lookup result: a stall (with place, open state, directions) or a status summary. */
function ResultCard({ card, action, onOpen }: { card: AssistantCard; action?: AssistantAction; onOpen: (route: string) => void }) {
  const place = card.place;
  return (
    <View style={{ padding: 14, gap: 6, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line }}>
      <Text selectable style={[text.headline, { color: colors.ink }]}>{card.title}</Text>
      {place ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Text style={[text.caption, { color: place.isOpenNow ? colors.onLeaf : colors.onDanger }]}>{place.isOpenNow ? 'Đang mở' : 'Đang đóng'}</Text>
          {place.distanceMeters != null ? (
            <Text style={[text.caption, tabular, { color: colors.muted }]}>{place.distanceMeters < 1000 ? `~${Math.max(50, Math.round(place.distanceMeters / 50) * 50)} m` : `~${(place.distanceMeters / 1000).toFixed(1).replace('.', ',')} km`}</Text>
          ) : null}
          {place.rating != null ? <Text style={[text.caption, tabular, { color: colors.muted }]}>{`★ ${place.rating.toFixed(1).replace('.', ',')} (${place.ratingCount})`}</Text> : null}
        </View>
      ) : null}
      {card.fields.map((f, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
          <Text style={[text.footnote, { color: colors.muted, flexShrink: 0, maxWidth: '45%' }]}>{f.label}</Text>
          <Text selectable style={[text.footnote, tabular, { flex: 1, color: colors.ink, textAlign: 'right', fontFamily: fonts.semibold }]}>{f.value}</Text>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
        {action ? <LinkButton label={action.label} onPress={() => onOpen(action.route)} /> : null}
        {place ? <LinkButton label="Chỉ đường" onPress={() => void Linking.openURL(directionsUrl(place.latitude, place.longitude))} /> : null}
      </View>
    </View>
  );
}

function Composer({
  role,
  busy,
  error,
  maxChars,
  style,
  onStyle,
  location,
  onLocation,
  onSend,
  onStop,
  onRetryRequest,
}: {
  role: AssistantRole;
  busy: boolean;
  error: string;
  maxChars: number;
  style: ResponseStyle;
  onStyle: (s: ResponseStyle) => void;
  location?: AssistantLocation;
  onLocation: (l: AssistantLocation | undefined) => void;
  onSend: (q: string) => void;
  onStop: () => void;
  onRetryRequest: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const [locating, setLocating] = useState(false);
  const body = draft.trim();
  const canSend = Boolean(body) && !busy;
  // "Gần tôi" only matters to people looking for a stall.
  const nearby = role === 'CUSTOMER' || role === 'GUEST';

  const toggleLocation = async () => {
    if (location) {
      onLocation(undefined);
      return;
    }
    setLocating(true);
    try {
      onLocation(await detectPosition());
    } catch (e) {
      showToast(e instanceof LocateError ? LOCATE_MESSAGES[e.reason] : LOCATE_MESSAGES.FAILED, 'error');
    } finally {
      setLocating(false);
    }
  };

  const submit = () => {
    if (!canSend) return;
    onSend(body);
    setDraft('');
  };

  return (
    <View style={{ backgroundColor: colors.card, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, borderCurve: 'continuous', boxShadow: '0 -10px 28px -14px rgba(17, 28, 43, 0.22)', paddingHorizontal: 12, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 10), gap: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6 }}>
        {nearby ? (
          <Pressable onPress={() => void toggleLocation()} accessibilityRole="switch" accessibilityState={{ checked: Boolean(location), busy: locating }} hitSlop={{ top: 6, bottom: 6 }} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 34, paddingHorizontal: 12, borderRadius: radius.full, backgroundColor: location ? colors.leafTint : colors.sunken }}>
            <Icon sf={location ? 'location.fill' : 'location'} md={location ? 'my_location' : 'location_searching'} size={13} color={location ? colors.onLeaf : colors.muted} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: location ? colors.onLeaf : colors.muted }}>{locating ? 'Đang định vị…' : location ? 'Đang dùng vị trí' : 'Gần tôi'}</Text>
          </Pressable>
        ) : null}
        {STYLES.map((s) => {
          const on = s.key === style;
          return (
            <Pressable key={s.key} onPress={() => onStyle(s.key)} accessibilityRole="radio" accessibilityState={{ selected: on }} hitSlop={{ top: 6, bottom: 6 }} style={{ minHeight: 34, paddingHorizontal: 13, borderRadius: radius.full, justifyContent: 'center', backgroundColor: on ? colors.sticker : colors.sunken }}>
              <Text style={{ fontFamily: on ? fonts.heavy : fonts.medium, fontSize: 13, color: on ? colors.plate : colors.muted }}>{s.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Hỏi trợ lý StreetBiz…"
          placeholderTextColor={colors.muted}
          multiline
          maxLength={maxChars}
          accessibilityLabel="Câu hỏi cho trợ lý"
          style={{ flex: 1, minHeight: 44, maxHeight: 132, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 11, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.sunken, fontFamily: fonts.regular, fontSize: 16, lineHeight: 21, color: colors.ink, textAlignVertical: 'center' }}
        />
        {busy ? (
          <Pressable onPress={onStop} accessibilityRole="button" accessibilityLabel="Dừng câu trả lời" style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.sunken : colors.card, borderWidth: 1.5, borderColor: colors.ink })}>
            <Icon sf="stop.fill" md="stop" size={18} color={colors.ink} />
          </Pressable>
        ) : (
          <Pressable
            onPress={submit}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Gửi câu hỏi"
            accessibilityState={{ disabled: !canSend }}
            style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: canSend ? (pressed ? colors.ctaPressed : colors.cta) : colors.line, boxShadow: canSend ? shadow.glow : undefined, transform: [{ scale: pressed ? 0.95 : 1 }] })}
          >
            <Icon sf="arrow.up" md="arrow_upward" size={20} color={canSend ? colors.white : colors.muted} weight="bold" />
          </Pressable>
        )}
      </View>
      {error ? (
        <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
          <Icon sf="exclamationmark.circle.fill" md="error" size={16} color={colors.onDanger} />
          <Text style={[text.footnote, { flex: 1, color: colors.onDanger }]}>{error}</Text>
          {!busy ? (
            <Pressable onPress={onRetryRequest} accessibilityRole="button" hitSlop={8}>
              <Text style={[text.subhead, { color: colors.primary }]}>Thử lại yêu cầu</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
