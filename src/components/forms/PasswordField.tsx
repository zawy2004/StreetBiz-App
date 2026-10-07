import { useState } from 'react';
import { Pressable } from 'react-native';

import { Icon } from '../common/Icon';

import { TextField } from './TextField';

type Props = {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  placeholder?: string;
};

export function PasswordField({ label = 'Mật khẩu', value, onChangeText, error, placeholder }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      label={label}
      icon="lock-outline"
      value={value}
      onChangeText={onChangeText}
      error={error}
      placeholder={placeholder}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          hitSlop={12}
          onPress={() => setVisible((v) => !v)}
        >
          <Icon name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color="muted" />
        </Pressable>
      }
    />
  );
}
