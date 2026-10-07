import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '@/components/common/Button';
import { StatusChip } from '@/components/status/StatusChip';

describe('Button', () => {
  it('calls onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Gửi" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Gửi' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ignores presses while loading or disabled', async () => {
    const onPress = jest.fn();
    await render(
      <>
        <Button label="Đang gửi" loading onPress={onPress} />
        <Button label="Khoá" disabled onPress={onPress} />
      </>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Đang gửi' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Khoá' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('StatusChip', () => {
  it('shows the Vietnamese label for a backend status code', async () => {
    await render(<StatusChip code="PENDING_SANCTION" />);
    expect(screen.getByText('Chờ xử phạt')).toBeTruthy();
  });

  it('falls back to the raw code for an unknown status', async () => {
    await render(<StatusChip code="SOMETHING_NEW" />);
    expect(screen.getByText('SOMETHING_NEW')).toBeTruthy();
  });
});
