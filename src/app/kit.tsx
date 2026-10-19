import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { ListGroup, ListRow } from '@/components/common/ListGroup';
import { StateView } from '@/components/feedback/StateView';
import { ActionMenu, MoreButton } from '@/components/native/ActionMenu';
import { useRowActions } from '@/components/native/RowActions';
import { EmptyArt } from '@/components/native/EmptyArt';
import { ResultView } from '@/components/native/ResultView';
import { SegmentedControl } from '@/components/native/SegmentedControl';
import { StatusHeader } from '@/components/native/StatusHeader';
import { StepFooter, StepProgress } from '@/components/native/StepFlow';
import { SwipeRow } from '@/components/native/SwipeRow';
import { Toggle } from '@/components/native/Toggle';
import { colors, text } from '@/theme';

/**
 * Development-only gallery of the native kit (master prompt v4, B0), opened by deep link to
 * check each piece on a device. Renders nothing in a release build.
 */
export default function KitScreen() {
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [on, setOn] = useState(true);
  const [step, setStep] = useState(2);
  const rows = useRowActions();
  const [result, setResult] = useState(false);
  if (!__DEV__) return null;
  if (result) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <ResultView title="Đã nộp hồ sơ" body="Phường sẽ xét trong 3 ngày làm việc. Bạn sẽ nhận thông báo khi có kết quả." primary={{ label: 'Xem hồ sơ', onPress: () => setResult(false) }} secondary={{ label: 'Về trang chủ', onPress: () => setResult(false) }} />
      </>
    );
  }
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: 60 }}>
      <Stack.Screen options={{ headerShown: true, title: 'Bộ công cụ native', headerRight: () => <MoreButton title="Bộ công cụ" items={[{ id: 'a', title: 'Làm mới', icon: { sf: 'arrow.clockwise', md: 'refresh' }, onPress: () => Alert.alert('Làm mới') }, { id: 'b', title: 'Xoá', icon: { sf: 'trash', md: 'delete' }, destructive: true, onPress: () => Alert.alert('Xoá') }]} /> }} />
      <Section title="SegmentedControl">
        <SegmentedControl value={seg} onChange={setSeg} options={[{ key: 'a', label: 'Chờ duyệt', count: 3 }, { key: 'b', label: 'Đã duyệt' }, { key: 'c', label: 'Tất cả' }]} />
      </Section>
      <Section title="StatusHeader">
        <StatusHeader tone="pending" title="Chờ phường xét duyệt" detail="Nộp lúc 09:12 · 18/10/2026" action={{ label: 'Xem hồ sơ', onPress: () => undefined }} />
        <StatusHeader tone="ok" title="Đã duyệt" detail="Bởi Nguyễn Thị Hồng Vân" />
        <StatusHeader tone="danger" title="Thiếu giấy tờ" detail="Ảnh CCCD mặt sau bị mờ" />
      </Section>
      <Section title="ListGroup + Toggle + SwipeRow + menu nhấn giữ">
        <ListGroup title="Thông báo">
          <ListRow title="Báo đơn mới" subtitle="Rung và hiện thông báo" icon={{ sf: 'bell.fill', md: 'notifications' }} accessory={<Toggle value={on} onChange={setOn} />} chevron={false} />
          <SwipeRow actions={[{ id: 'r', label: 'Nhả', icon: { sf: 'arrow.uturn.left', md: 'undo' }, tone: 'neutral', onPress: () => Alert.alert('Nhả') }, { id: 'd', label: 'Xoá', icon: { sf: 'trash', md: 'delete' }, tone: 'danger', onPress: () => Alert.alert('Xoá') }]}>
            <ListRow title="Ô NVL-17 (vuốt trái)" subtitle="Đường Nguyễn Văn Linh" icon={{ sf: 'square.grid.3x3.fill', md: 'grid_view' }} onPress={() => undefined} />
          </SwipeRow>
          <ListRow title="Ô NVL-08 (nhấn giữ)" subtitle="Đường Nguyễn Văn Linh" icon={{ sf: 'square.grid.3x3.fill', md: 'grid_view' }} onPress={() => undefined} onLongPress={() => rows.open('Ô NVL-08', [{ id: 'o', title: 'Mở chi tiết', icon: { sf: 'arrow.up.right', md: 'open_in_new' }, onPress: () => Alert.alert('Mở') }, { id: 'x', title: 'Tạm ngưng ô', icon: { sf: 'pause.circle', md: 'pause_circle' }, destructive: true, onPress: () => Alert.alert('Tạm ngưng') }])} />
        </ListGroup>
      </Section>
      <Section title="ActionMenu (nút gọn)">
        <ActionMenu title="Sắp xếp" items={[{ id: 'n', title: 'Mới nhất', checked: true, onPress: () => undefined }, { id: 'o', title: 'Cũ nhất', checked: false, onPress: () => undefined }]}>
          <View style={{ alignSelf: 'flex-start', paddingHorizontal: 14, height: 36, borderRadius: 18, justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line }}>
            <Text style={[text.subhead, { color: colors.ink }]}>Sắp xếp: Mới nhất ▾</Text>
          </View>
        </ActionMenu>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[text.subhead, { color: colors.ink }]}>MoreButton:</Text>
          <MoreButton title="Thử" items={[{ id: 'a', title: 'Làm mới', icon: { sf: 'arrow.clockwise', md: 'refresh' }, onPress: () => Alert.alert('Làm mới') }]} />
        </View>
      </Section>
      <Section title="StepFlow">
        <StepProgress step={step} total={4} title="Thông tin chủ hộ" hint="Đúng như trên CCCD." />
        <StepFooter back={step > 1 ? { onPress: () => setStep(step - 1) } : undefined} next={{ label: step < 4 ? 'Tiếp tục' : 'Nộp hồ sơ', onPress: () => setStep(Math.min(4, step + 1)) }} />
      </Section>
      <Section title="ResultView">
        <Text onPress={() => setResult(true)} style={[text.headline, { color: colors.primary }]}>Mở màn kết quả</Text>
      </Section>
      <Section title="EmptyArt trong StateView">
        <StateView icon={{ sf: 'tray', md: 'inbox' }} art={<EmptyArt icon={{ sf: 'tray', md: 'inbox' }} label="TRỐNG" />} title="Không còn hồ sơ chờ" body="Hồ sơ mới sẽ hiện ở đây." />
      </Section>
      {rows.sheet}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={[text.caption, { color: colors.muted }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}
