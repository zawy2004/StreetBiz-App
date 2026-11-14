import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Banner } from '@/components/feedback/Banner';

/**
 * A bare string inside a View crashes React Native ("Text strings must be rendered within a
 * <Text>"). Banners are often written as words mixed with values, so the Banner itself must put
 * such children inside one Text.
 */
describe('Banner children', () => {
  it('renders words mixed with values as one line of text', async () => {
    const count = 2;
    await render(
      <Banner tone="warning">
        Giỏ đang có {count} món của {'Bún chả Hải Châu'}.
      </Banner>,
    );
    expect(screen.getByText('Giỏ đang có 2 món của Bún chả Hải Châu.')).toBeTruthy();
  });

  it('lays out element children as they are', async () => {
    await render(
      <Banner tone="neutral">
        <Text>Dòng một</Text>
        <Text>Dòng hai</Text>
      </Banner>,
    );
    expect(screen.getByText('Dòng một')).toBeTruthy();
    expect(screen.getByText('Dòng hai')).toBeTruthy();
  });
});
