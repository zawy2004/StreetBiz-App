import { staticPhotoUrl } from '@/core/api/asset-url';
import { env } from '@/core/config/env';
import {
  categoryPhoto,
  menuItemPhotos,
  storefrontPhotos,
} from '@/features/buyer-discovery/food-photos';

const host = env.apiBaseUrl.replace(/\/$/, '').replace(/\/api$/, '');

describe('illustrative photos come from the API, not the app bundle', () => {
  it('builds /static URLs on the API host', () => {
    expect(staticPhotoUrl('food/pho.jpg')).toBe(`${host}/static/food/pho.jpg`);
    expect(staticPhotoUrl('hero/hanoi-street-960.webp')).toBe(
      `${host}/static/hero/hanoi-street-960.webp`,
    );
  });

  it('uses a stock photo matched to the dish after the stall or dish photo', () => {
    const [own, stock] = storefrontPhotos({
      storefrontId: 1,
      storefrontName: 'Phở Bà Lan',
      imageUrl: '/api/uploads/menu-images/5/a.jpg',
    });
    expect(own).toEqual({
      source: { uri: `${host}/api/uploads/menu-images/5/a.jpg` },
      illustrative: false,
    });
    expect(stock).toEqual({ source: { uri: `${host}/static/food/pho.jpg` }, illustrative: true });

    expect(
      menuItemPhotos({ menuItemId: 2, itemName: 'Bánh mì thịt nướng', categoryName: 'Bánh mì' }),
    ).toEqual([
      { source: { uri: `${host}/static/food/banh-mi-thit-nuong.jpg` }, illustrative: true },
    ]);
    expect(categoryPhoto('Cà phê')).toEqual({ uri: `${host}/static/food/ca-phe.jpg` });
  });
});
