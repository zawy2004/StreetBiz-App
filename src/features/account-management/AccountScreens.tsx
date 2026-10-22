import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { ListGroup, ListRow } from '@/components/common/ListGroup';
import { Banner } from '@/components/feedback/Banner';
import { Skeleton } from '@/components/feedback/Skeleton';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { PasswordField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StatusHeader } from '@/components/native/StatusHeader';
import { ApiError, authApi, errorMessage, type ApiSession, type SecurityEvent } from '@/core/api';
import { isPasswordValid, passwordError } from '@/core/auth/password-policy';
import { ROLE_LABELS, type RoleCode } from '@/core/types/role';
import { formatPhone } from '@/core/utils/phone';
import { describeDevice } from '@/core/utils/user-agent';
import { PasswordChecklist } from '@/features/authentication/components/auth-parts';
import { LEGAL_ROUTES } from '@/features/legal/legal-content';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { BigNumber, Pass } from '@/ui';
import { groupByDay, relativeTime, shortDate } from './account-format';

/** What each account may do here, so a ward officer and a platform admin never mistake their scope. */
const ROLE_SCOPE: Record<RoleCode, string> = {
  CUSTOMER: 'Tìm quán, đặt món và nhắn tin với người bán.',
  VENDOR: 'Hồ sơ, ô thuê, phí và đơn hàng của hộ kinh doanh.',
  WARD_AUTHORITY: 'Bạn quản lý vỉa hè của phường. Mọi quyết định duyệt, xử phạt do bạn thực hiện.',
  PLATFORM_ADMIN: 'Vận hành nền tảng. Không có quyền nghiệp vụ của Phường.',
};

/** Each role wears its own paint on the member pass: street orange, the ward's civic blue, the admin's ink. */
const ROLE_PAINT: Record<RoleCode, { band: string; wash: string; ink: string }> = {
  CUSTOMER: { band: colors.brand, wash: colors.brandTint, ink: colors.primary },
  VENDOR: { band: colors.brand, wash: colors.brandTint, ink: colors.primary },
  WARD_AUTHORITY: { band: colors.sign, wash: colors.signTint, ink: colors.sign },
  PLATFORM_ADMIN: { band: colors.plate, wash: colors.sunken, ink: colors.ink },
};

const go = (href: string) => router.push(href as Href);

/**
 * The member pass at the top of every account tab (v5 `Pass`): the role's band, the person and
 * their role above the tear line; the phone in sign lettering and what the role may do below it.
 */
function IdentityCard() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  const suspended = user.account_status === 'SUSPENDED';
  const paint = ROLE_PAINT[user.role_code];
  return (
    <Pass
      accent={paint.band}
      notch={colors.bg}
      head={
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ padding: 3, borderRadius: radius.full, backgroundColor: paint.wash }}>
              <Avatar name={user.fullName} size={62} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[text.title2, { color: colors.ink }]} numberOfLines={2}>
                {user.fullName}
              </Text>
              <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: paint.wash }}>
                <Icon
                  sf={user.role_code === 'WARD_AUTHORITY' ? 'building.columns.fill' : user.role_code === 'PLATFORM_ADMIN' ? 'gearshape.fill' : user.role_code === 'VENDOR' ? 'storefront.fill' : 'bag.fill'}
                  md={user.role_code === 'WARD_AUTHORITY' ? 'account_balance' : user.role_code === 'PLATFORM_ADMIN' ? 'settings' : user.role_code === 'VENDOR' ? 'storefront' : 'shopping_bag'}
                  size={13}
                  color={paint.ink}
                />
                <Text style={{ fontFamily: fonts.heavy, fontSize: 12.5, color: paint.ink }}>{ROLE_LABELS[user.role_code]}</Text>
              </View>
            </View>
          </View>
          {suspended ? (
            <Banner tone="danger">Tài khoản đang bị tạm khoá. Vui lòng liên hệ quản trị viên.</Banner>
          ) : null}
        </View>
      }
      stub={
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.muted }}>Số điện thoại</Text>
            <Text maxFontSizeMultiplier={1.4} style={[sign.price, { fontSize: 20, lineHeight: 25, color: colors.ink, letterSpacing: 0.6 }, tabular]}>
              {formatPhone(user.phone)}
            </Text>
          </View>
          <Text style={[text.subhead, { fontFamily: fonts.regular, color: '#2B3640' }]}>{ROLE_SCOPE[user.role_code]}</Text>
        </View>
      }
    />
  );
}

/**
 * AC01 Tài khoản, shared by every role's account tab (screens/v5/shared-admin.md): the member
 * pass, the role's own shortcuts (`children`), security, legal pages and sign-out (asked first).
 */
export function AccountScreen({ children }: { children?: ReactNode }) {
  const signOut = useAuthStore((s) => s.signOut);
  const queryClient = useQueryClient();

  const confirmSignOut = () =>
    Alert.alert('Đăng xuất khỏi StreetBiz?', 'Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng.', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          queryClient.clear();
          router.replace('/auth/sign-in');
        },
      },
    ]);

  return (
    <Screen gap={22}>
      <IdentityCard />
      {children}
      <ListGroup title="Bảo mật">
        <ListRow
          title="Đổi mật khẩu"
          subtitle="Dùng mật khẩu riêng cho StreetBiz"
          icon={{ sf: 'lock.fill', md: 'lock' }}
          onPress={() => go('/account/password')}
        />
        <ListRow
          title="Thiết bị đang đăng nhập"
          subtitle="Xem và đăng xuất thiết bị lạ"
          icon={{ sf: 'iphone', md: 'devices' }}
          onPress={() => go('/account/sessions')}
        />
        <ListRow
          title="Hoạt động đăng nhập"
          subtitle="Lịch sử đăng nhập và bảo mật"
          icon={{ sf: 'clock.arrow.circlepath', md: 'history' }}
          onPress={() => go('/account/login-history')}
        />
      </ListGroup>
      <ListGroup title="Pháp lý">
        <ListRow title="Điều khoản sử dụng" icon={{ sf: 'doc.text', md: 'description' }} tint={colors.sign} tileColor={colors.signTint} onPress={() => go(LEGAL_ROUTES.terms)} />
        <ListRow title="Chính sách bảo mật" icon={{ sf: 'hand.raised.fill', md: 'privacy_tip' }} tint={colors.sign} tileColor={colors.signTint} onPress={() => go(LEGAL_ROUTES.privacy)} />
        <ListRow title="Quy định thuê ô" icon={{ sf: 'square.grid.3x3', md: 'grid_view' }} tint={colors.sign} tileColor={colors.signTint} onPress={() => go(LEGAL_ROUTES.slotRules)} />
        <ListRow title="Căn cứ pháp lý" icon={{ sf: 'building.columns.fill', md: 'account_balance' }} tint={colors.sign} tileColor={colors.signTint} onPress={() => go(LEGAL_ROUTES.basis)} />
      </ListGroup>
      <ListGroup>
        <ListRow
          title="Đăng xuất"
          icon={{ sf: 'rectangle.portrait.and.arrow.right', md: 'logout' }}
          destructive
          chevron={false}
          onPress={confirmSignOut}
        />
      </ListGroup>
      <Text style={[text.caption, tabular, { color: colors.muted, textAlign: 'center' }]}>
        StreetBiz {Constants.expoConfig?.version ?? ''}
      </Text>
    </Screen>
  );
}

/** One line on what a security screen is for: an orange disc with its symbol, one sentence. */
function SecurityLead({ icon, line }: { icon: { sf: string; md: string }; line: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ width: 52, height: 52, borderRadius: radius.full, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', boxShadow: shadow.glow }}>
        <Icon sf={icon.sf} md={icon.md} size={24} color={colors.white} />
      </View>
      <Text style={[text.callout, { flex: 1, color: '#2B3640' }]}>{line}</Text>
    </View>
  );
}

/** AC02 Đổi mật khẩu (AUTH-07). Signs nothing out; the other devices are listed on AC03. */
export function ChangePasswordScreen() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [error, setError] = useState<string>();
  const change = useMutation({
    mutationFn: () => authApi.changePassword(current, next),
    onSuccess: () => {
      showToast('Đã đổi mật khẩu.');
      router.back();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.isValidation) {
        setErrors({
          current: err.fieldError('CurrentPassword'),
          next: err.fieldError('NewPassword'),
        });
        if (!err.fieldError('CurrentPassword') && !err.fieldError('NewPassword')) setError(err.message);
      } else setError(errorMessage(err));
    },
  });

  const submit = () => {
    const e = {
      current: current ? undefined : 'Vui lòng nhập mật khẩu hiện tại.',
      next: isPasswordValid(next) ? undefined : passwordError(next),
      confirm: next === confirm ? undefined : 'Mật khẩu nhập lại không khớp.',
    };
    setErrors(e);
    setError(undefined);
    if (e.current || e.next || e.confirm || change.isPending) return;
    change.mutate();
  };

  return (
    <Screen gap={18} footer={<Button label="Lưu mật khẩu mới" size={56} loading={change.isPending} onPress={submit} />}>
      <SecurityLead icon={{ sf: 'lock.fill', md: 'lock' }} line="Dùng mật khẩu riêng cho StreetBiz, không dùng lại ở nơi khác." />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <PasswordField
        label="Mật khẩu hiện tại"
        value={current}
        onChangeText={(v) => {
          setCurrent(v);
          setErrors((x) => ({ ...x, current: undefined }));
        }}
        error={errors.current}
      />
      <View style={{ gap: 10 }}>
        <PasswordField
          isNew
          label="Mật khẩu mới"
          value={next}
          onChangeText={(v) => {
            setNext(v);
            setErrors((x) => ({ ...x, next: undefined }));
          }}
          error={errors.next}
        />
        <PasswordChecklist value={next} />
      </View>
      <PasswordField
        isNew
        label="Nhập lại mật khẩu mới"
        value={confirm}
        onChangeText={(v) => {
          setConfirm(v);
          setErrors((x) => ({ ...x, confirm: undefined }));
        }}
        error={errors.confirm}
        onSubmitEditing={submit}
      />
      <ListGroup footer="Đổi mật khẩu không đăng xuất các thiết bị khác. Nếu nghi có người dùng tài khoản của bạn, hãy đăng xuất thiết bị lạ.">
        <ListRow
          title="Xem thiết bị đang đăng nhập"
          icon={{ sf: 'iphone', md: 'devices' }}
          onPress={() => go('/account/sessions')}
        />
      </ListGroup>
    </Screen>
  );
}

/** A small orange-paper capsule that signs one device out; spins while it works. */
function RevokeButton({ busy, onPress }: { busy: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Đăng xuất thiết bị này"
      accessibilityState={{ busy, disabled: busy }}
      hitSlop={4}
      style={({ pressed }) => ({
        minHeight: 40,
        minWidth: 96,
        paddingHorizontal: 14,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? '#FFD3BA' : colors.brandTint,
      })}
    >
      {busy ? <ActivityIndicator color={colors.primary} /> : <Text style={{ fontFamily: fonts.heavy, fontSize: 13.5, color: colors.primary }}>Đăng xuất</Text>}
    </Pressable>
  );
}

function SessionRow({ session, onRevoke, busy }: { session: ApiSession; onRevoke: () => void; busy: boolean }) {
  const device = describeDevice(session.deviceInfo);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingVertical: 12, paddingHorizontal: 14 }}>
      <View style={{ width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.sunken, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf="iphone" md="smartphone" size={20} color={colors.muted} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[text.headline, { color: colors.ink }]}>{device}</Text>
        <Text style={[text.footnote, { color: colors.muted }]}>
          {`Hoạt động ${relativeTime(session.lastActiveAt ?? session.createdAt) || shortDate(session.createdAt)}`}
          {session.ipAddress ? `, IP ${session.ipAddress}` : ''}
        </Text>
      </View>
      <RevokeButton busy={busy} onPress={onRevoke} />
    </View>
  );
}

/**
 * AC03 Thiết bị đang đăng nhập (AUTH-08, AUTH-09): how many devices in a big figure, this
 * device sealed green, the others each with its own sign-out; signing out all the others is the
 * screen's one action, at the bottom.
 */
export function SessionsScreen() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['sessions'], queryFn: () => authApi.listSessions() });
  const [revoking, setRevoking] = useState<number>();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['sessions'] });
  const revoke = useMutation({
    mutationFn: (id: number) => authApi.revokeSession(id),
    onMutate: (id) => setRevoking(id),
    onSettled: () => setRevoking(undefined),
    onSuccess: async () => {
      showToast('Đã đăng xuất thiết bị.');
      await refresh();
    },
    onError: (err) => showToast(errorMessage(err), 'error'),
  });
  const revokeOthers = useMutation({
    mutationFn: () => authApi.revokeOtherSessions(),
    onSuccess: async () => {
      showToast('Đã đăng xuất các thiết bị khác.');
      await refresh();
    },
    onError: (err) => showToast(errorMessage(err), 'error'),
  });
  const sessions = query.data ?? [];
  const current = sessions.filter((s) => s.isCurrent);
  const others = sessions.filter((s) => !s.isCurrent);

  const footer =
    query.isSuccess && others.length > 0 ? (
      <Button
        label={`Đăng xuất ${others.length} thiết bị khác`}
        size={56}
        icon={{ sf: 'rectangle.portrait.and.arrow.right', md: 'logout' }}
        loading={revokeOthers.isPending}
        onPress={() =>
          Alert.alert(
            'Đăng xuất mọi thiết bị khác?',
            'Chỉ thiết bị này còn đăng nhập. Các thiết bị kia phải đăng nhập lại.',
            [
              { text: 'Huỷ', style: 'cancel' },
              { text: 'Đăng xuất tất cả', style: 'destructive', onPress: () => revokeOthers.mutate() },
            ],
          )
        }
      />
    ) : undefined;

  return (
    <Screen gap={20} onRefresh={() => void query.refetch()} refreshing={query.isRefetching} footer={footer}>
      {query.isPending ? (
        <>
          <Skeleton width={180} height={70} radius={radius.control} />
          <Skeleton height={88} radius={radius.card} />
          <Skeleton height={150} radius={radius.card} />
        </>
      ) : query.isError ? (
        <StateView
          tone="danger"
          icon={{ sf: 'wifi.exclamationmark', md: 'wifi_off' }}
          title="Không tải được danh sách thiết bị"
          body={errorMessage(query.error)}
          action={{ label: 'Thử lại', onPress: () => void query.refetch() }}
        />
      ) : (
        <>
          <BigNumber value={String(sessions.length)} label="thiết bị đang đăng nhập tài khoản của bạn" tone="brand" />

          {current.map((s) => (
            <View
              key={s.sessionId}
              accessible
              accessibilityLabel={`Thiết bị này: ${describeDevice(s.deviceInfo)}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.leafTint }}
            >
              <View style={{ width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.leaf, borderWidth: 3, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
                <Icon sf="iphone" md="smartphone" size={21} color={colors.white} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: fonts.heavy, fontSize: 13, color: colors.onLeaf }}>Thiết bị này</Text>
                <Text style={{ fontFamily: fonts.heavy, fontSize: 17, lineHeight: 23, color: colors.onLeaf }}>{describeDevice(s.deviceInfo)}</Text>
                {s.ipAddress ? <Text style={[text.footnote, tabular, { color: colors.onLeaf }]}>{`IP ${s.ipAddress}`}</Text> : null}
              </View>
            </View>
          ))}

          {others.length > 0 ? (
            <View style={{ gap: 10 }}>
              <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 19, color: colors.ink }}>Thiết bị khác</Text>
              <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>
                {others.map((s, i) => (
                  <View key={s.sessionId} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator }}>
                    <SessionRow
                      session={s}
                      busy={revoking === s.sessionId}
                      onRevoke={() =>
                        Alert.alert('Đăng xuất thiết bị này?', describeDevice(s.deviceInfo), [
                          { text: 'Huỷ', style: 'cancel' },
                          { text: 'Đăng xuất', style: 'destructive', onPress: () => revoke.mutate(s.sessionId) },
                        ])
                      }
                    />
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 }}>
              <Icon sf="checkmark.shield.fill" md="verified_user" size={18} color={colors.leaf} />
              <Text style={[text.callout, { flex: 1, color: colors.muted }]}>Chỉ thiết bị này đang đăng nhập.</Text>
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const ACTIONS: Record<string, { label: string; icon: { sf: string; md: string }; danger?: boolean }> = {
  LOGIN_SUCCESS: { label: 'Đăng nhập thành công', icon: { sf: 'arrow.right.circle.fill', md: 'login' } },
  LOGIN_FAILED: { label: 'Đăng nhập thất bại', icon: { sf: 'exclamationmark.circle.fill', md: 'error' }, danger: true },
  ACCOUNT_LOCKED: { label: 'Tài khoản bị tạm khoá', icon: { sf: 'lock.fill', md: 'lock' }, danger: true },
  PASSWORD_CHANGED: { label: 'Đổi mật khẩu', icon: { sf: 'lock.fill', md: 'lock' } },
  PASSWORD_RESET: { label: 'Đặt lại mật khẩu', icon: { sf: 'lock.rotation', md: 'lock_reset' } },
  SESSION_REVOKED: { label: 'Đăng xuất một thiết bị', icon: { sf: 'rectangle.portrait.and.arrow.right', md: 'logout' } },
  OTHER_SESSIONS_REVOKED: { label: 'Đăng xuất các thiết bị khác', icon: { sf: 'rectangle.portrait.and.arrow.right', md: 'logout' } },
  SECURITY_ALERT: { label: 'Cảnh báo bảo mật', icon: { sf: 'exclamationmark.shield.fill', md: 'gpp_maybe' }, danger: true },
};

/**
 * AC05 Hoạt động đăng nhập: read-only, newest first, grouped by day (Asia/Ho_Chi_Minh). One
 * sentence on top says whether anything in the loaded history needs a look; then a timeline.
 */
export function LoginHistoryScreen() {
  const query = useQuery({ queryKey: ['login-history'], queryFn: () => authApi.listLoginHistory(50) });
  const groups = groupByDay(query.data ?? [], (e: SecurityEvent) => e.createdAt);
  const events = query.data ?? [];
  const flagged = events.filter((e) => ACTIONS[e.action]?.danger).length;
  return (
    <Screen gap={20} onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
      {query.isPending ? (
        <>
          <Skeleton height={80} radius={radius.card} />
          {[0, 1].map((i) => (
            <Skeleton key={i} height={170} radius={radius.card} />
          ))}
        </>
      ) : query.isError ? (
        <StateView
          tone="danger"
          icon={{ sf: 'wifi.exclamationmark', md: 'wifi_off' }}
          title="Không tải được lịch sử"
          body={errorMessage(query.error)}
          action={{ label: 'Thử lại', onPress: () => void query.refetch() }}
        />
      ) : groups.length === 0 ? (
        <StateView icon={{ sf: 'clock', md: 'history' }} title="Chưa có hoạt động" body="Các lần đăng nhập và đổi mật khẩu sẽ hiện ở đây." />
      ) : (
        <>
          {flagged > 0 ? (
            <StatusHeader
              tone="pending"
              icon={{ sf: 'exclamationmark.shield.fill', md: 'gpp_maybe' }}
              title={`${flagged} sự kiện cần để ý`}
              detail="Đăng nhập thất bại, tạm khoá hoặc cảnh báo bảo mật. Nếu không phải bạn, hãy đổi mật khẩu."
              action={{ label: 'Đổi mật khẩu', onPress: () => go('/account/password') }}
            />
          ) : (
            <StatusHeader tone="ok" icon={{ sf: 'checkmark.shield.fill', md: 'verified_user' }} title="Không có gì bất thường" detail={`${events.length} hoạt động gần nhất của tài khoản.`} />
          )}
          {groups.map((g) => (
            <View key={g.key} style={{ gap: 10 }}>
              <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 17, color: colors.ink, marginLeft: 4 }}>{g.label}</Text>
              <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card, paddingVertical: 6 }}>
                {g.items.map((e, i) => {
                  const a = ACTIONS[e.action] ?? { label: e.action, icon: { sf: 'clock', md: 'history' } };
                  const last = i === g.items.length - 1;
                  const sub = [e.details ? describeDevice(e.details) : null, relativeTime(e.createdAt)].filter(Boolean).join(', ');
                  return (
                    <View key={e.id} accessible accessibilityLabel={`${a.label}. ${sub}`} style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 14 }}>
                      {/* The timeline: a disc per event, joined by a thin line */}
                      <View style={{ width: 36, alignItems: 'center' }}>
                        <View style={{ width: 2, height: 10, backgroundColor: i === 0 ? 'transparent' : colors.line }} />
                        <View style={{ width: 36, height: 36, borderRadius: radius.full, backgroundColor: a.danger ? colors.dangerTint : colors.sunken, alignItems: 'center', justifyContent: 'center' }}>
                          <Icon sf={a.icon.sf} md={a.icon.md} size={17} color={a.danger ? colors.danger : colors.muted} />
                        </View>
                        <View style={{ width: 2, flex: 1, minHeight: 10, backgroundColor: last ? 'transparent' : colors.line }} />
                      </View>
                      <View style={{ flex: 1, gap: 2, paddingTop: 12, paddingBottom: 14 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 21, color: a.danger ? colors.onDanger : colors.ink }}>{a.label}</Text>
                        {sub ? <Text style={[text.footnote, { color: colors.muted }]}>{sub}</Text> : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}
