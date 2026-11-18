import { parsePermitQr } from '@/features/digital-permits/permit-qr-text';

const TOKEN = 'SBP1.eyJjIjoxMn0.c2lnbmF0dXJl';

describe('parsePermitQr (the scanner reads the bare token and the printed board link)', () => {
  it('passes a bare SBP1 token through, trimmed', () => {
    expect(parsePermitQr(`  ${TOKEN}\n`)).toEqual({ token: TOKEN, printedVersion: null, fromLink: false });
  });

  it('takes the token and the board version out of a /q/ link', () => {
    expect(parsePermitQr(`http://192.168.1.10:5173/q/${TOKEN}?v=4`)).toEqual({ token: TOKEN, printedVersion: 4, fromLink: true });
    expect(parsePermitQr(`https://streetbiz.danang.vn/q/${TOKEN}`)).toEqual({ token: TOKEN, printedVersion: null, fromLink: true });
  });

  it('reads any host and a path prefix, the print page, and an escaped token', () => {
    expect(parsePermitQr(`https://demo.example/app/q/${TOKEN}/print`).token).toBe(TOKEN);
    expect(parsePermitQr(`HTTPS://Demo.Example/q/${encodeURIComponent(TOKEN)}?x=1&v=12#top`)).toEqual({ token: TOKEN, printedVersion: 12, fromLink: true });
  });

  it('ignores a version that is not a positive whole number', () => {
    expect(parsePermitQr(`http://h/q/${TOKEN}?v=0`).printedVersion).toBeNull();
    expect(parsePermitQr(`http://h/q/${TOKEN}?v=3a`).printedVersion).toBeNull();
    expect(parsePermitQr(`http://h/q/${TOKEN}?version=3`).printedVersion).toBeNull();
  });

  it('leaves other text for the server to judge (a typed permit code, a link without /q/)', () => {
    expect(parsePermitQr('SB-HC1-2026-0815')).toEqual({ token: 'SB-HC1-2026-0815', printedVersion: null, fromLink: false });
    expect(parsePermitQr('https://example.com/menu?v=2')).toEqual({ token: 'https://example.com/menu?v=2', printedVersion: null, fromLink: false });
    expect(parsePermitQr('http://h/q/')).toEqual({ token: 'http://h/q/', printedVersion: null, fromLink: false });
  });
});
