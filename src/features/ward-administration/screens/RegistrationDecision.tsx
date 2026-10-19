import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams, useNavigation, type Href } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { showToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ResultView } from '@/components/native/ResultView';
import { StatusHeader } from '@/components/native/StatusHeader';
import { errorMessage } from '@/core/api';
import { colors, fonts, text } from '@/theme';
import { formatVietnamDateTime } from '@/utils/format';
import { complianceApi } from '../ward-api';
import { enrollmentKey, OPEN_REGISTRATION, type RegistrationDecisionKind } from './RegistrationReview';

const APPROVE_DEFAULT = 'Hồ sơ đủ điều kiện thực địa trật tự đô thị';

const copy: Record<RegistrationDecisionKind, { title: string; field: string; placeholder: string; required: boolean; submit: string; done?: string; doneBody?: string }> = {
  IDENTITY: {
    title: 'Đối chiếu CCCD',
    field: 'Cách bạn đã đối chiếu',
    placeholder: 'VD: Đã xem CCCD gắn chip bản gốc tại trụ sở, đúng người',
    required: true,
    submit: 'Xác nhận đã đối chiếu',
  },
  APPROVE: {
    title: 'Duyệt điểm bán',
    field: 'Căn cứ, ghi chú',
    placeholder: APPROVE_DEFAULT,
    required: false,
    submit: 'Duyệt điểm bán',
    done: 'Đã duyệt hồ sơ',
    doneBody: 'Hộ kinh doanh có thể nộp đơn thuê ô vỉa hè.',
  },
  REJECT: {
    title: 'Từ chối hồ sơ',
    field: 'Lý do từ chối',
    placeholder: 'Người nộp sẽ đọc lý do này',
    required: true,
    submit: 'Từ chối hồ sơ',
    done: 'Đã từ chối hồ sơ',
    doneBody: 'Lý do đã được ghi vào hồ sơ.',
  },
  MORE_INFO: {
    title: 'Yêu cầu bổ sung',
    field: 'Cần bổ sung gì',
    placeholder: 'Ghi rõ giấy tờ cần nộp lại',
    required: true,
    submit: 'Gửi yêu cầu bổ sung',
    done: 'Đã yêu cầu bổ sung',
    doneBody: 'Hồ sơ chờ người nộp gửi lại giấy tờ.',
  },
};

/** Ready-made openings an officer can insert and then edit; never sent on their own. */
const templates: Partial<Record<RegistrationDecisionKind, string[]>> = {
  MORE_INFO: ['Ảnh CCCD bị mờ, đề nghị chụp lại rõ nét.', 'Thiếu ảnh CCCD mặt sau.', 'Thông tin chủ hộ chưa khớp với CCCD.'],
  REJECT: ['Người nộp không đúng chủ CCCD.', 'Vị trí đăng ký nằm trong tuyến cấm kinh doanh.', 'Hồ sơ trùng với hồ sơ đang còn hiệu lực.'],
  IDENTITY: ['Đã xem CCCD gắn chip bản gốc, đúng người.', 'Đã quét chip CCCD tại trụ sở phường.'],
};

const isKind = (k: string | undefined): k is RegistrationDecisionKind => k === 'IDENTITY' || k === 'APPROVE' || k === 'REJECT' || k === 'MORE_INFO';

/**
 * The officer's decision on a registration, as its own modal above the tabs: one field, one
 * button, Cancel at the top. Leaving with words typed asks first; leaving while the request is
 * in flight is blocked. A decision ends on a result screen; the identity check returns to the
 * review, where the gate's step 2 has turned green. Same calls and payloads as the web.
 */
export function RegistrationDecisionScreen() {
  const { id, kind: rawKind } = useLocalSearchParams<{ id: string; kind?: string }>();
  const kind: RegistrationDecisionKind = isKind(rawKind) ? rawKind : 'APPROVE';
  const c = copy[kind];
  const cache = useQueryClient();
  const navigation = useNavigation();
  const detail = useQuery({ queryKey: enrollmentKey(id), queryFn: () => complianceApi.getEnrollment(id!), enabled: Boolean(id) });
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState<'identity' | 'decision' | null>(null);

  usePreventRemove(busy || (finished == null && value.trim() !== ''), ({ data }) => {
    if (busy) return showToast('Đang gửi, chờ một chút.', 'info');
    Alert.alert('Bỏ nội dung đang viết?', 'Những gì bạn vừa nhập sẽ không được lưu.', [
      { text: 'Viết tiếp', style: 'cancel' },
      { text: 'Bỏ', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  // The identity check returns to the review once the guard above has been lifted.
  useEffect(() => {
    if (finished === 'identity') router.back();
  }, [finished]);

  const header = (
    <Stack.Screen
      options={{
        title: c.title,
        headerLeft: () => (
          <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={10} style={{ minHeight: 44, justifyContent: 'center', paddingRight: 12 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 17, color: colors.primary }}>Huỷ</Text>
          </Pressable>
        ),
      }}
    />
  );

  if (detail.isPending) {
    return (
      <Screen>
        {header}
        <ListSkeleton rows={2} height={90} />
      </Screen>
    );
  }
  if (detail.isError) {
    return (
      <Screen>
        {header}
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      </Screen>
    );
  }
  const d = detail.data;

  if (finished === 'decision') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <ResultView
          tone={kind === 'APPROVE' ? 'ok' : kind === 'REJECT' ? 'danger' : 'pending'}
          icon={kind === 'REJECT' ? { sf: 'xmark', md: 'close' } : kind === 'MORE_INFO' ? { sf: 'arrow.uturn.left', md: 'undo' } : undefined}
          title={c.done!}
          body={`${d.displayName || d.ownerName} · Hồ sơ #${d.id}. ${c.doneBody}`}
          primary={{
            label: 'Về hộp duyệt',
            onPress: () => {
              // Close this modal first, then pop the inbox tab's own stack back to its list
              // (dismissTo from the modal itself pushed a second inbox on top of the record).
              router.back();
              setTimeout(() => router.dismissTo('/ward/inbox' as Href), 0);
            },
          }}
          secondary={{ label: 'Xem lại hồ sơ', onPress: () => router.back() }}
        />
      </>
    );
  }

  const open = OPEN_REGISTRATION.includes(d.status);
  const blocked = !open ? 'Hồ sơ đã có quyết định, không thể thay đổi ở đây.' : kind === 'APPROVE' && !d.identityVerified ? 'Cần xác nhận đã đối chiếu CCCD trước khi duyệt.' : null;

  const submit = async () => {
    const note = value.trim();
    if (c.required && !note) {
      setError(kind === 'IDENTITY' ? 'Ghi ngắn gọn cách bạn đã đối chiếu CCCD.' : 'Nhập lý do để người nộp biết cần làm gì.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setBusy(true);
    try {
      if (kind === 'IDENTITY') {
        const updated = await complianceApi.confirmIdentity(id!, note);
        cache.setQueryData(enrollmentKey(id), updated);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast('Đã ghi nhận đối chiếu CCCD. Có thể duyệt hồ sơ.');
        setFinished('identity');
      } else {
        const decision = kind === 'MORE_INFO' ? 'MORE_INFORMATION_REQUIRED' : kind;
        await complianceApi.decideEnrollment(id!, decision, note || APPROVE_DEFAULT, d.status);
        // Show the outcome at once; the inbox and this record refresh behind it.
        void cache.invalidateQueries({ queryKey: ['ward'] });
        setFinished('decision');
      }
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const insert = (t: string) => {
    void Haptics.selectionAsync();
    setError(undefined);
    setValue((v) => (v.trim() ? `${v.trim()} ${t}` : t));
  };

  return (
    <Screen
      gap={20}
      footer={
        <Button
          label={c.submit}
          size={56}
          variant={kind === 'REJECT' ? 'danger' : 'primary'}
          loading={busy}
          disabled={busy || blocked != null}
          onPress={() => void submit()}
        />
      }
    >
      {header}
      <View style={{ gap: 2 }}>
        <Text style={[text.title3, { color: colors.ink, fontFamily: fonts.bold }]}>{d.displayName || d.ownerName}</Text>
        <Text style={[text.footnote, { color: colors.muted }]}>
          Hồ sơ #{d.id} · {d.ownerName}
          {d.idNumber ? ` · CCCD ${d.idNumber}` : ''}
        </Text>
      </View>

      {blocked ? <StatusHeader tone="danger" icon={{ sf: 'lock.fill', md: 'lock' }} title={blocked} /> : null}
      {kind === 'IDENTITY' ? (
        <StatusHeader tone="neutral" icon={{ sf: 'person.text.rectangle', md: 'badge' }} title="Xem CCCD gắn chip bản gốc" detail="Đúng người nộp, ảnh và thông tin khớp hồ sơ. AI không làm thay bước này." />
      ) : null}
      {kind === 'APPROVE' && d.identityVerified ? (
        <StatusHeader
          tone="ok"
          title="Đã đối chiếu CCCD"
          detail={[d.identityVerifiedByName, d.identityVerifiedAt ? formatVietnamDateTime(d.identityVerifiedAt) : null].filter(Boolean).join(' · ') || undefined}
        />
      ) : null}

      <View style={{ gap: 10 }}>
        <TextField
          label={c.field}
          optional={!c.required}
          value={value}
          onChangeText={(v) => {
            setValue(v.slice(0, 500));
            if (error) setError(undefined);
          }}
          multiline
          autoFocus={kind !== 'APPROVE'}
          placeholder={c.placeholder}
          error={error}
          hint={`${value.trim().length}/500 ký tự`}
          editable={!busy && blocked == null}
        />
        {templates[kind] && blocked == null ? (
          <View style={{ gap: 8 }}>
            <Text style={[text.footnote, { color: colors.muted }]}>Chèn nhanh, rồi sửa cho đúng hồ sơ</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {templates[kind]!.map((t) => (
                <Chip key={t} label={t} onPress={() => insert(t)} />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
