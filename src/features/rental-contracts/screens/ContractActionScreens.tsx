import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { showToast } from '@/components/feedback/Toast';
import { PhoneField, TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { sideApi, SideApiError, type RentalContract } from '@/core/api/side-api';
import { formatPhone, phoneError, toLocalPhone } from '@/core/utils/phone';
import { contractProgress, extendedEndDate, TRANSFER_STEP_LABELS } from '@/features/sidewalk-slots/my-slots-view';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { formatVietnamDate } from '@/utils/format';
import { ContractStrip, TransferSteps } from '../components/ContractParts';
import { useContract } from './ContractScreens';

const QUICK_TERMS = [30, 90, 180, 365];
const REASON_HINTS = ['Chuyển địa điểm kinh doanh', 'Ngừng kinh doanh', 'Ô không còn phù hợp'];
const RETURN_CONSEQUENCES = [
  { icon: { sf: 'qrcode', md: 'qr_code_2' }, text: 'Giấy phép số của ô này sẽ hết hiệu lực.' },
  { icon: { sf: 'storefront', md: 'storefront' }, text: 'Ô được mở lại cho các hộ kinh doanh khác.' },
  { icon: { sf: 'banknote', md: 'payments' }, text: 'Hãy thanh toán mọi khoản phí còn nợ trước khi trả ô.' },
];

/** Heavy section title in the v5 rhythm. */
function Heading({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 19, lineHeight: 25, color: colors.ink }}>
      {children}
    </Text>
  );
}

/** A quiet line of how it works, with its glyph: the rule a form runs under, said once. */
function Note({ icon, children }: { icon: { sf: string; md: string }; children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Icon sf={icon.sf} md={icon.md} size={16} color={colors.muted} style={{ marginTop: 1 }} />
      <Text style={[text.footnote, { flex: 1, color: colors.muted }]}>{children}</Text>
    </View>
  );
}

/** Loads the contract for a form, with the shared loading and error states. */
function ContractForm({ title, children }: { title: string; children: (contract: RentalContract) => ReactNode }) {
  const { contractId } = useLocalSearchParams<{ contractId: string }>();
  const contract = useContract(Number(contractId));
  if (contract.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <ListSkeleton rows={1} height={100} />
        <ListSkeleton rows={2} height={72} />
      </Screen>
    );
  }
  if (contract.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <ErrorState error={contract.error} onRetry={() => void contract.refetch()} />
      </Screen>
    );
  }
  return (
    <>
      <Stack.Screen options={{ title }} />
      {children(contract.data)}
    </>
  );
}

/** V20 Gia hạn hợp đồng (SIDE-06): how many more days, the end date it would give, sent to the ward. */
export function RenewalRequestScreen() {
  return <ContractForm title="Gia hạn hợp đồng">{(c) => <RenewalForm contract={c} />}</ContractForm>;
}

function RenewalForm({ contract }: { contract: RentalContract }) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const [termDays, setTermDays] = useState('90');
  const [error, setError] = useState<string>();
  const days = Number(termDays);
  const validDays = /^\d+$/.test(termDays.trim()) && days > 0;
  const progress = contractProgress(contract.startDate, contract.endDate, new Date());
  const submit = useMutation({
    mutationFn: () => sideApi.requestRenewal(contract.contractId, days),
    onSuccess: (result) => {
      showToast(result.message);
      void queryClient.invalidateQueries({ queryKey: ['side', userId, 'contract', contract.contractId] });
      router.back();
    },
    onError: (err) => setError(err instanceof SideApiError ? err.message : 'Không gửi được yêu cầu gia hạn.'),
  });

  return (
    <Screen gap={22} footer={<Button label="Gửi yêu cầu gia hạn" size={56} icon={{ sf: 'paperplane.fill', md: 'send' }} loading={submit.isPending} disabled={!validDays} onPress={() => submit.mutate()} />}>
      <View style={{ gap: 10 }}>
        <ContractStrip contract={contract} />
        {contract.contractStatus === 'ACTIVE' ? (
          <Text style={[text.footnote, tabular, { color: progress.expiringSoon ? colors.onMango : colors.muted, fontFamily: progress.expiringSoon ? fonts.semibold : fonts.regular }]}>
            Hợp đồng còn {progress.daysLeft} ngày. Gửi sớm để Phường kịp xét.
          </Text>
        ) : null}
      </View>
      <View style={{ gap: 12 }}>
        <Heading>Gia hạn thêm</Heading>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 8 }}>
          {QUICK_TERMS.map((d) => {
            const on = days === d;
            return (
              <Pressable
                key={d}
                onPress={() => {
                  setTermDays(String(d));
                  setError(undefined);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${d} ngày`}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 76,
                  paddingVertical: 8,
                  borderRadius: radius.control,
                  borderCurve: 'continuous',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: on ? colors.cta : pressed ? colors.brandTint : colors.card,
                  boxShadow: on ? shadow.glow : shadow.card,
                })}
              >
                <Text maxFontSizeMultiplier={1.3} style={[sign.title, { fontSize: 28, lineHeight: 34, color: on ? colors.white : colors.ink }, tabular]}>{d}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: on ? colors.white : colors.muted }}>{d === 365 ? '1 năm' : `${Math.round(d / 30)} tháng`}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextField
          label="Hoặc nhập số ngày"
          value={termDays}
          onChangeText={(v) => {
            setTermDays(v.replace(/[^0-9]/g, ''));
            setError(undefined);
          }}
          keyboardType="number-pad"
          error={termDays && !validDays ? 'Nhập số ngày lớn hơn 0.' : undefined}
        />
      </View>
      {validDays && contract.endDate ? (
        // The two end dates side by side: what it is now, what it would be once approved
        <View
          accessible
          accessibilityLabel={`Nếu được duyệt đủ ${days} ngày, hợp đồng kéo dài đến ${extendedEndDate(contract.endDate, days).toLocaleDateString('vi-VN')}`}
          style={{ padding: 18, gap: 12, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.leafTint }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[text.caption, { color: colors.onLeaf }]}>Hết hạn hiện tại</Text>
              <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.price, { fontSize: 22, lineHeight: 28, color: colors.onLeaf }, tabular]}>
                {formatVietnamDate(contract.endDate)}
              </Text>
            </View>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
              <Icon sf="arrow.right" md="arrow_forward" size={16} color={colors.leaf} weight="bold" />
            </View>
            <View style={{ flex: 1, gap: 2, alignItems: 'flex-end' }}>
              <Text style={[text.caption, { color: colors.onLeaf }]}>Nếu được duyệt</Text>
              <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.title, { fontSize: 28, lineHeight: 34, color: colors.leaf }, tabular]}>
                {extendedEndDate(contract.endDate, days).toLocaleDateString('vi-VN')}
              </Text>
            </View>
          </View>
          <Text style={[text.footnote, { color: colors.onLeaf }]}>
            Nếu được duyệt đủ <Text style={[{ fontFamily: fonts.heavy }, tabular]}>{days} ngày</Text>, hợp đồng kéo dài đến ngày trên.
          </Text>
        </View>
      ) : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Note icon={{ sf: 'building.columns', md: 'account_balance' }}>Phường xét duyệt và quyết định ngày hết hạn mới. Hợp đồng giữ nguyên cho đến khi được duyệt.</Note>
    </Screen>
  );
}

/** V21 Trả ô (SIDE-07): what returning means, a gentler way out (transfer), the optional reason, a confirm. */
export function ReturnSlotScreen() {
  return <ContractForm title="Trả ô vỉa hè">{(c) => <ReturnForm contract={c} />}</ContractForm>;
}

function ReturnForm({ contract }: { contract: RentalContract }) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const live = contract.contractStatus === 'ACTIVE' || contract.contractStatus === 'SUSPENDED';
  const daysLeft = live ? contractProgress(contract.startDate, contract.endDate, new Date()).daysLeft : null;
  const cancel = useMutation({
    mutationFn: () => sideApi.cancelContract(contract.contractId, reason.trim() || null),
    onSuccess: (result) => {
      showToast(result.message);
      void queryClient.invalidateQueries({ queryKey: ['side', userId, 'contracts'] });
      void queryClient.invalidateQueries({ queryKey: ['side', userId, 'contract', contract.contractId] });
      void queryClient.invalidateQueries({ queryKey: ['side', userId, 'slots'] });
      router.dismissTo('/vendor/slots/contracts' as Href);
    },
    onError: (err) => setError(err instanceof SideApiError ? err.message : 'Không trả được ô.'),
  });
  const confirm = () =>
    Alert.alert('Xác nhận trả ô?', `Hợp đồng ô ${contract.slotCode} kết thúc ngay và giấy phép số hết hiệu lực. Không thể hoàn tác.`, [
      { text: 'Giữ ô', style: 'cancel' },
      { text: 'Trả ô', style: 'destructive', onPress: () => cancel.mutate() },
    ]);

  return (
    <Screen
      gap={22}
      footer={<Button label={cancel.isPending ? 'Đang trả ô…' : 'Trả ô này'} variant="danger" size={56} icon={{ sf: 'xmark.circle.fill', md: 'cancel' }} loading={cancel.isPending} disabled={!live} onPress={confirm} />}
    >
      <View style={{ gap: 10 }}>
        <ContractStrip contract={contract} />
        {daysLeft != null ? (
          <Text style={[text.callout, { color: colors.ink }]}>
            Bạn sẽ trả lại <Text style={[{ fontFamily: fonts.heavy }, tabular]}>{daysLeft} ngày</Text> còn lại của hợp đồng.
          </Text>
        ) : null}
      </View>
      <View style={{ padding: 18, gap: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.dangerTint }}>
        <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.onDanger }}>Trước khi trả ô, bạn cần biết</Text>
        {RETURN_CONSEQUENCES.map((c) => (
          <View key={c.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
              <Icon sf={c.icon.sf} md={c.icon.md} size={17} color={colors.danger} />
            </View>
            <Text style={[text.footnote, { flex: 1, color: colors.onDanger, fontFamily: fonts.medium }]}>{c.text}</Text>
          </View>
        ))}
      </View>
      {contract.contractStatus === 'ACTIVE' ? (
        <Pressable
          onPress={() => router.replace(`/vendor/slots/contracts/${contract.contractId}/transfer` as Href)}
          accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card, transform: [{ scale: pressed ? 0.985 : 1 }] })}
        >
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon sf="arrow.left.arrow.right" md="swap_horiz" size={21} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.heavy, fontSize: 15.5, color: colors.ink }}>Chuyển nhượng thay vì trả?</Text>
            <Text style={[text.footnote, { color: colors.muted }]}>Hộ khác tiếp tục phần còn lại của hợp đồng.</Text>
          </View>
          <Icon sf="chevron.right" md="chevron_right" size={14} color={colors.primary} />
        </Pressable>
      ) : null}
      <View style={{ gap: 10 }}>
        <TextField label="Lý do trả ô" optional value={reason} onChangeText={setReason} multiline placeholder="VD: Chuyển địa điểm kinh doanh" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {REASON_HINTS.map((h) => (
            <Chip key={h} label={h} selected={reason === h} onPress={() => setReason(h)} />
          ))}
        </View>
      </View>
      {error ? <Banner tone="danger">{error}</Banner> : null}
    </Screen>
  );
}

/** V22 Chuyển nhượng ô (SIDE-12): the receiver's phone; they agree, then the ward approves. */
export function TransferInitiateScreen() {
  return <ContractForm title="Chuyển nhượng ô">{(c) => <TransferForm contract={c} />}</ContractForm>;
}

function TransferForm({ contract }: { contract: RentalContract }) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const [phone, setPhone] = useState('');
  const [phoneErr, setPhoneErr] = useState<string>();
  const [error, setError] = useState<string>();
  const live = contract.contractStatus === 'ACTIVE';
  const daysLeft = live ? contractProgress(contract.startDate, contract.endDate, new Date()).daysLeft : null;
  const submit = useMutation({
    mutationFn: () => sideApi.requestTransfer({ contractId: contract.contractId, toVendorPhone: toLocalPhone(phone) }),
    onSuccess: (result) => {
      showToast(result.message);
      void queryClient.invalidateQueries({ queryKey: ['side', userId, 'transfers'] });
      router.back();
    },
    onError: (err) => setError(err instanceof SideApiError ? err.message : 'Không gửi được yêu cầu chuyển nhượng.'),
  });
  const send = () => {
    const e = phoneError(phone);
    setPhoneErr(e);
    if (!e) submit.mutate();
  };

  return (
    <Screen gap={22} footer={<Button label="Gửi yêu cầu" size={56} icon={{ sf: 'paperplane.fill', md: 'send' }} loading={submit.isPending} disabled={!live} onPress={send} />}>
      {/* From the slot to the receiver: the hand-over drawn top to bottom */}
      <View>
        <View style={{ gap: 10 }}>
          <Heading>Ô chuyển nhượng</Heading>
          <ContractStrip contract={contract} />
        </View>
        <View style={{ alignItems: 'center', marginVertical: -6, zIndex: 1 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.cta, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.bg, boxShadow: shadow.glow }}>
            <Icon sf="arrow.down" md="arrow_downward" size={18} color={colors.white} weight="bold" />
          </View>
        </View>
        <View style={{ padding: 18, gap: 12, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Bên nhận: hộ kinh doanh nhận ô</Text>
          <PhoneField
            label="Số điện thoại người nhận"
            value={phone}
            onChangeText={(v) => {
              setPhone(v);
              setPhoneErr(undefined);
              setError(undefined);
            }}
            error={phoneErr}
          />
          <Text style={[text.caption, { color: colors.muted }]}>Người nhận cần có tài khoản Hộ kinh doanh và hồ sơ đăng ký đã được duyệt.</Text>
          {!phoneError(phone) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 12, minHeight: 36, borderRadius: radius.full, backgroundColor: colors.brandTint }}>
              <Icon sf="paperplane.fill" md="send" size={13} color={colors.primary} />
              <Text style={[text.footnote, { color: colors.primary, fontFamily: fonts.bold }, tabular]}>Gửi tới {formatPhone(phone)}</Text>
            </View>
          ) : null}
        </View>
      </View>
      {daysLeft != null ? (
        <Text style={[text.callout, { color: colors.ink }]}>
          Bên nhận tiếp tục phần còn lại của hợp đồng: <Text style={[{ fontFamily: fonts.heavy }, tabular]}>{daysLeft} ngày</Text>.
        </Text>
      ) : null}
      <View style={{ gap: 12 }}>
        <Heading>Các bước</Heading>
        <View style={{ padding: 18, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
          <TransferSteps steps={['current', 'todo', 'todo']} labels={TRANSFER_STEP_LABELS} />
        </View>
      </View>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Note icon={{ sf: 'lock.fill', md: 'lock' }}>Người nhận phải đồng ý, sau đó Phường duyệt thì chuyển nhượng mới có hiệu lực. Trong lúc chờ, ô vẫn thuộc về bạn.</Note>
    </Screen>
  );
}
