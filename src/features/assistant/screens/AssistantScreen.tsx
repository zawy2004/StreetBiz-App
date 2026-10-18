import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, type Href } from 'expo-router';
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
import { colors, fonts, radius, space, tabular, text } from '@/theme';
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
  const chat = useAssistant(role, String(user?.id ?? 'guest'));
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
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Đóng trợ lý" style={{ paddingHorizontal: 4, marginRight: 16, height: 40, justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.primary }}>Đóng</Text>
          </Pressable>
        ),
        headerRight:
          role !== 'GUEST'
            ? () => (
                <Pressable onPress={() => setHistoryOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Các cuộc trò chuyện" style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
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
              onRetry={chat.retry}
              onFeedback={(helpful) => chat.feedback(item, helpful)}
              canRate={role !== 'GUEST'}
            />
          )
        }
        ListFooterComponent={
          chat.hasOlder ? (
            <Pressable onPress={() => void chat.loadOlder()} accessibilityRole="button" style={({ pressed }) => ({ alignSelf: 'center', paddingHorizontal: 14, height: 34, borderRadius: 17, justifyContent: 'center', backgroundColor: pressed ? colors.sunken : colors.card, borderWidth: 1, borderColor: colors.line })}>
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
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, marginTop: 6, borderRadius: radius.control, backgroundColor: pressed ? colors.dangerTint : 'transparent' })}
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
    <View style={{ gap: 18, paddingTop: 8 }}>
      <View style={{ alignItems: 'center', gap: 10 }}>
        <LinearGradient colors={[colors.mango, colors.brand]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf="sparkles" md="auto_awesome" size={30} color={colors.white} />
        </LinearGradient>
        <AiTag label="Trợ lý StreetBiz" style={{ alignSelf: 'center' }} />
        <Text style={[text.title2, { color: colors.ink, textAlign: 'center' }]}>{w.title}</Text>
        <Text style={[text.callout, { color: colors.muted, textAlign: 'center', maxWidth: 340 }]}>{w.description}</Text>
      </View>

      {briefing && briefing.items.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text style={[text.subhead, { color: colors.ink }]}>
            {`Việc cần để ý · ${briefing.items.length}`}
            <Text style={[text.caption, { color: colors.muted }]}>{`  cập nhật ${clock(briefing.observedAt)}`}</Text>
          </Text>
          {briefing.items.map((item, i) => {
            const href = item.action ? appRoute(item.action.route, role) : undefined;
            const warn = item.tone === 'warning';
            return (
              <Pressable
                key={i}
                disabled={!href}
                onPress={() => item.action && onOpen(item.action.route)}
                accessibilityRole={href ? 'button' : undefined}
                style={({ pressed }) => ({ flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? colors.sunken : colors.card, borderLeftWidth: 4, borderLeftColor: warn ? colors.mango : colors.sign })}
              >
                <Icon sf={warn ? 'exclamationmark.triangle.fill' : 'info.circle.fill'} md={warn ? 'warning' : 'info'} size={20} color={warn ? colors.onMango : colors.sign} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[text.headline, { color: colors.ink }]}>{item.title}</Text>
                  <Text style={[text.footnote, { color: colors.muted }]}>{item.detail}</Text>
                  {href && item.action ? <Text style={[text.subhead, { color: colors.primary, marginTop: 4 }]}>{item.action.label} ›</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <Text style={[text.subhead, { color: colors.muted }]}>Thử hỏi</Text>
        {suggestions(role).map((q) => (
          <Pressable key={q} onPress={() => onAsk(q)} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: pressed ? colors.sunken : colors.card, borderWidth: 1, borderColor: colors.line })}>
            <Icon sf="text.bubble" md="chat_bubble_outline" size={17} color={colors.primary} />
            <Text style={[text.callout, { flex: 1, color: colors.ink }]}>{q}</Text>
          </Pressable>
        ))}
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
    <View style={{ alignSelf: 'flex-end', maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderBottomRightRadius: 6, borderCurve: 'continuous', backgroundColor: colors.cta }}>
      <Text selectable style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: colors.white }}>{message.content}</Text>
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
        <AiTag label="Trợ lý StreetBiz" />
        {!generating ? <Text style={[text.caption, tabular, { color: colors.muted }]}>{clock(message.completedAt ?? message.createdAt)}</Text> : null}
      </View>
      <View style={[aiPanel, { backgroundColor: colors.card, borderColor: colors.line, gap: 12 }]}>
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
            {latest && message.status !== 'CANCELLED' && (message.error?.retryable ?? true) ? (
              <Pressable onPress={onRetry} disabled={busy} accessibilityRole="button" style={({ pressed }) => ({ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: pressed ? colors.sunken : colors.card, borderWidth: 1, borderColor: colors.line })}>
                <Icon sf="arrow.clockwise" md="refresh" size={15} color={colors.ink} />
                <Text style={[text.subhead, { color: colors.ink }]}>Thử lại</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {message.cards.length > 0 ? (
          <View style={{ gap: 8 }}>
            {live?.observedAt ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.leaf }} />
                <Text style={[text.caption, { color: colors.onLeaf }]}>{`Dữ liệu trực tiếp · ${clock(live.observedAt)}`}</Text>
              </View>
            ) : null}
            {message.cards.map((card, i) => (
              <ResultCard key={`${card.title}-${i}`} card={card} action={actionFor(card.actionId)} onOpen={onOpen} />
            ))}
          </View>
        ) : null}

        {message.checklist?.length ? (
          <View style={{ gap: 8 }}>
            <Text style={[text.subhead, { color: colors.ink }]}>{`Các bước tiếp theo · ${message.checklist.length} bước`}</Text>
            <Text style={[text.caption, { color: colors.muted }]}>Hướng dẫn đối chiếu; chưa xác nhận các bước đã hoàn tất.</Text>
            {message.checklist.map((step, i) => {
              const action = actionFor(step.actionId);
              return (
                <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={[{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary }, tabular]}>{i + 1}</Text>
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
              <Pressable key={a.id} onPress={() => onOpen(a.route)} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: i === 0 ? (pressed ? colors.ctaPressed : colors.cta) : pressed ? colors.sunken : colors.card, borderWidth: i === 0 ? 0 : 1, borderColor: colors.line })}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: i === 0 ? colors.white : colors.ink }}>{a.label}</Text>
                <Icon sf="arrow.right" md="arrow_forward" size={14} color={i === 0 ? colors.white : colors.ink} />
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
                      {s.observedAt ? ` · ${clock(s.observedAt)}` : ''}
                      {s.documentVersion ? ` · ${s.documentVersion}` : ''}
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
          </View>
        ) : null}
      </View>

      {more.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {more.map((q) => (
            <Pressable key={q} onPress={() => onAsk(q)} accessibilityRole="button" style={({ pressed }) => ({ height: 38, paddingHorizontal: 14, borderRadius: 19, justifyContent: 'center', backgroundColor: pressed ? colors.sunken : colors.card, borderWidth: 1, borderColor: '#FFD3BA' })}>
              <Text style={[text.subhead, { color: colors.primary }]}>{q}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function RateButton({ icon, label, on, disabled, onPress }: { icon: { sf: string; md: string }; label: string; on: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on, disabled }} hitSlop={4} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.brandTint : pressed ? colors.sunken : 'transparent', opacity: disabled && !on ? 0.45 : 1 })}>
      <Icon sf={icon.sf} md={icon.md} size={18} color={on ? colors.primary : colors.muted} />
    </Pressable>
  );
}

function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={6} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 }}>
      <Text style={[text.subhead, { color: colors.primary }]}>{label}</Text>
      <Icon sf="arrow.right" md="arrow_forward" size={13} color={colors.primary} />
    </Pressable>
  );
}

/** A lookup result: a stall (with place, open state, directions) or a status summary. */
function ResultCard({ card, action, onOpen }: { card: AssistantCard; action?: AssistantAction; onOpen: (route: string) => void }) {
  const place = card.place;
  return (
    <View style={{ padding: 12, gap: 6, borderRadius: 14, borderCurve: 'continuous', backgroundColor: colors.sunken }}>
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
    <View style={{ backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 12, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 8), gap: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6 }}>
        {nearby ? (
          <Pressable onPress={() => void toggleLocation()} accessibilityRole="switch" accessibilityState={{ checked: Boolean(location), busy: locating }} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: location ? colors.leafTint : colors.sunken }}>
            <Icon sf={location ? 'location.fill' : 'location'} md={location ? 'my_location' : 'location_searching'} size={13} color={location ? colors.onLeaf : colors.muted} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: location ? colors.onLeaf : colors.muted }}>{locating ? 'Đang định vị…' : location ? 'Đang dùng vị trí' : 'Gần tôi'}</Text>
          </Pressable>
        ) : null}
        {STYLES.map((s) => {
          const on = s.key === style;
          return (
            <Pressable key={s.key} onPress={() => onStyle(s.key)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center', backgroundColor: on ? colors.brandTint : colors.sunken }}>
              <Text style={{ fontFamily: on ? fonts.bold : fonts.medium, fontSize: 13, color: on ? colors.primary : colors.muted }}>{s.label}</Text>
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
          style={{ flex: 1, minHeight: 44, maxHeight: 132, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 11, borderRadius: 22, borderCurve: 'continuous', backgroundColor: colors.sunken, fontFamily: fonts.regular, fontSize: 16, lineHeight: 21, color: colors.ink, textAlignVertical: 'center' }}
        />
        {busy ? (
          <Pressable onPress={onStop} accessibilityRole="button" accessibilityLabel="Dừng câu trả lời" style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.sunken : colors.card, borderWidth: 1.5, borderColor: colors.ink })}>
            <View style={{ width: 13, height: 13, borderRadius: 3, backgroundColor: colors.ink }} />
          </Pressable>
        ) : (
          <Pressable
            onPress={submit}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Gửi câu hỏi"
            accessibilityState={{ disabled: !canSend }}
            style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: canSend ? (pressed ? colors.ctaPressed : colors.cta) : colors.line, transform: [{ scale: pressed ? 0.95 : 1 }] })}
          >
            <Icon sf="arrow.up" md="arrow_upward" size={20} color={canSend ? colors.white : colors.muted} weight="bold" />
          </Pressable>
        )}
      </View>
      {error ? (
        <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
          <Icon sf="exclamationmark.circle.fill" md="error" size={16} color={colors.onDanger} />
          <Text style={[text.footnote, { flex: 1, color: colors.onDanger }]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}
