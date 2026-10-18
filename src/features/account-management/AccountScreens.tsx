import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Text, View } from 'react-native';

import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { ListGroup, ListRow } from '@/components/common/ListGroup';
import { KerbStrip } from '@/components/common/KerbStrip';
import { Banner } from '@/components/feedback/Banner';
import { Skeleton } from '@/components/feedback/Skeleton';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { PasswordField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ApiError, authApi, errorMessage, type ApiSession, type SecurityEvent } from '@/core/api';
import { isPasswordValid, passwordError } from '@/core/auth/password-policy';
import { ROLE_LABELS, type RoleCode } from '@/core/types/role';
import { formatPhone } from '@/core/utils/phone';
import { describeDevice } from '@/core/utils/user-agent';
import { PasswordChecklist } from '@/features/authentication/components/auth-parts';
import { LEGAL_ROUTES } from '@/features/legal/legal-content';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, text } from '@/theme';
import { groupByDay, relativeTime, shortDate } from './account-format';

/** What each account may do here, so a ward officer and a platform admin never mistake their scope. */
const ROLE_SCOPE: Record<RoleCode, string> = {
  CUSTOMER: 'Tìm quán, đặt món và nhắn tin với người bán.',
  VENDOR: 'Hồ sơ, ô thuê, phí và đơn hàng của hộ kinh doanh.',
  WARD_AUTHORITY: 'Bạn quản lý vỉa hè của phường. Mọi quyết định duyệt, xử phạt do bạn thực hiện.',
  PLATFORM_ADMIN: 'Vận hành nền tảng. Không có quyền nghiệp vụ của Phường.',
};

const go = (href: string) => router.push(href as Href);

/** The identity card at the top of every account tab: who, which role, which phone. */
function IdentityCard() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  const suspended = user.account_status === 'SUSPENDED';
  return (
    <View
      style={{
        borderRadius: radius.pass,
        borderCurve: 'continuous',
        backgroundColor: colors.card,
        overflow: 'hidden',
        boxShadow: '0 10px 26px -18px rgba(17, 28, 43, 0.4)',
      }}
    >
      <KerbStrip height={5} segment={20} />
      <View style={{ padding: 18, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar name={user.fullName} size={58} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[text.title2, { color: colors.ink }]} numberOfLines={2}>
              {user.fullName}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderRadius: 999,
                  backgroundColor: user.role_code === 'WARD_AUTHORITY' ? colors.signTint : colors.brandTint,
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.bold,
                    fontSize: 12.5,
                    color: user.role_code === 'WARD_AUTHORITY' ? colors.sign : colors.primary,
                  }}
                >
                  {ROLE_LABELS[user.role_code]}
                </Text>
              </View>
              <Text style={[text.subhead, { color: colors.muted }]}>{formatPhone(user.phone)}</Text>
            </View>
          </View>
        </View>
        {suspended ? (
          <Banner tone="danger">Tài khoản đang bị tạm khoá. Vui lòng liên hệ quản trị viên.</Banner>
        ) : null}
        <Text style={[text.subhead, { fontFamily: fonts.regular, color: '#2B3640' }]}>
          {ROLE_SCOPE[user.role_code]}
        </Text>
      </View>
    </View>
  );
}

/**
 * AC01 Tài khoản, shared by every role's account tab: identity, security, legal pages and
 * sign-out (asked first). `children` holds the role's own shortcuts.
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
    <Screen>
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
        <ListRow title="Điều khoản sử dụng" icon={{ sf: 'doc.text', md: 'description' }} onPress={() => go(LEGAL_ROUTES.terms)} />
        <ListRow title="Chính sách bảo mật" icon={{ sf: 'hand.raised.fill', md: 'privacy_tip' }} onPress={() => go(LEGAL_ROUTES.privacy)} />
        <ListRow title="Quy định thuê ô" icon={{ sf: 'square.grid.3x3', md: 'grid_view' }} onPress={() => go(LEGAL_ROUTES.slotRules)} />
        <ListRow title="Căn cứ pháp lý" icon={{ sf: 'building.columns.fill', md: 'account_balance' }} onPress={() => go(LEGAL_ROUTES.basis)} />
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
      <Text style={[text.caption, { color: colors.muted, textAlign: 'center' }]}>
        StreetBiz {Constants.expoConfig?.version ?? ''}
      </Text>
    </Screen>
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
    <Screen footer={<Button label="Lưu mật khẩu mới" size={56} loading={change.isPending} onPress={submit} />}>
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
      <Banner tone="neutral" action={{ label: 'Xem thiết bị đang đăng nhập', onPress: () => go('/account/sessions') }}>
        Đổi mật khẩu không đăng xuất các thiết bị khác. Nếu nghi có người dùng tài khoản của bạn, hãy đăng xuất thiết bị lạ.
      </Banner>
    </Screen>
  );
}

function SessionCard({ session, onRevoke, busy }: { session: ApiSession; onRevoke: () => void; busy: boolean }) {
  const device = describeDevice(session.deviceInfo);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        backgroundColor: colors.card,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        borderWidth: session.isCurrent ? 1.5 : 0,
        borderColor: colors.leaf,
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 13,
          backgroundColor: session.isCurrent ? colors.leafTint : colors.sunken,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon sf="iphone" md="smartphone" size={20} color={session.isCurrent ? colors.leaf : colors.muted} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[text.headline, { color: colors.ink }]}>{device}</Text>
        <Text style={[text.footnote, { color: colors.muted }]}>
          {session.isCurrent
            ? 'Thiết bị này'
            : `Hoạt động ${relativeTime(session.lastActiveAt ?? session.createdAt) || shortDate(session.createdAt)}`}
          {session.ipAddress ? `, IP ${session.ipAddress}` : ''}
        </Text>
      </View>
      {session.isCurrent ? null : (
        <Button label="Đăng xuất" variant="secondary" loading={busy} onPress={onRevoke} style={{ height: 40, paddingHorizontal: 14 }} />
      )}
    </View>
  );
}

/** AC03 Thiết bị đang đăng nhập (AUTH-08, AUTH-09). */
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
  const others = sessions.filter((s) => !s.isCurrent);

  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
      {query.isPending ? (
        [0, 1, 2].map((i) => <Skeleton key={i} height={72} radius={radius.card} />)
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
          <Text style={[text.callout, { color: colors.muted }]}>
            {sessions.length} thiết bị đang đăng nhập tài khoản của bạn.
          </Text>
          {[...sessions]
            .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent))
            .map((s) => (
              <SessionCard
                key={s.sessionId}
                session={s}
                busy={revoking === s.sessionId}
                onRevoke={() =>
                  Alert.alert('Đăng xuất thiết bị này?', describeDevice(s.deviceInfo), [
                    { text: 'Huỷ', style: 'cancel' },
                    { text: 'Đăng xuất', style: 'destructive', onPress: () => revoke.mutate(s.sessionId) },
                  ])
                }
              />
            ))}
          {others.length > 0 ? (
            <Button
              label={`Đăng xuất ${others.length} thiết bị khác`}
              variant="secondary"
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
          ) : null}
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

/** AC05 Hoạt động đăng nhập: read-only, newest first, grouped by day (Asia/Ho_Chi_Minh). */
export function LoginHistoryScreen() {
  const query = useQuery({ queryKey: ['login-history'], queryFn: () => authApi.listLoginHistory(50) });
  const groups = groupByDay(query.data ?? [], (e: SecurityEvent) => e.createdAt);
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
      {query.isPending ? (
        [0, 1, 2, 3].map((i) => <Skeleton key={i} height={60} radius={radius.card} />)
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
        groups.map((g) => (
          <ListGroup key={g.key} title={g.label}>
            {g.items.map((e) => {
              const a = ACTIONS[e.action] ?? { label: e.action, icon: { sf: 'clock', md: 'history' } };
              return (
                <ListRow
                  key={e.id}
                  title={a.label}
                  subtitle={[e.details ? describeDevice(e.details) : null, relativeTime(e.createdAt)].filter(Boolean).join(', ')}
                  icon={a.icon}
                  tint={a.danger ? colors.danger : colors.muted}
                  tileColor={a.danger ? colors.dangerTint : colors.sunken}
                />
              );
            })}
          </ListGroup>
        ))
      )}
    </Screen>
  );
}
