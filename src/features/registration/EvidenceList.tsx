import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { PhotoSlot } from '@/components/forms/PhotoSlot';
import { spacing } from '@/theme';

import { EVIDENCE_LABELS, type EvidenceKind } from './registration-draft';

type Props = {
  kinds: EvidenceKind[];
  values: Partial<Record<EvidenceKind, string>>;
  onChange: (kind: EvidenceKind, uri: string | undefined) => void;
};

export function EvidenceList({ kinds, values, onChange }: Props) {
  return (
    <View style={styles.list}>
      {kinds.map((kind) => (
        <Card key={kind} style={styles.row}>
          <AppText variant="label" style={styles.label}>{EVIDENCE_LABELS[kind]}</AppText>
          <PhotoSlot uri={values[kind]} onChange={(uri) => onChange(kind, uri)} size={72} />
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { flex: 1 },
});
