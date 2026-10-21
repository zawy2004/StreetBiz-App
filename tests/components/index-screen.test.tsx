import { render, screen } from '@testing-library/react-native';

import IndexScreen from '@/app/index';

describe('IndexScreen', () => {
  it('renders the StreetBiz foundation message', async () => {
    await render(<IndexScreen />);

    expect(screen.getByText('StreetBiz')).toBeTruthy();
    expect(screen.getByText('Source foundation is ready.')).toBeTruthy();
  });
});
