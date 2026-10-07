/**
 * @jest-environment node
 *
 * Talks to a running StreetBiz-BE with the app's own API clients and mappers.
 * Skipped unless STREETBIZ_LIVE=1, e.g.:
 *
 *   $env:STREETBIZ_LIVE=1; $env:EXPO_PUBLIC_API_BASE_URL='http://localhost:5023/api'
 *   npx jest tests/live --runInBand --no-cache
 *
 * Uses the accounts from StreetBiz-BE/db/StreetBiz_Demo_Seed.sql. Read-only
 * apart from creating sessions (and a refresh-token rotation).
 */
import { AxiosError, type AxiosAdapter } from 'axios';

import { authApi } from '@/core/api/auth-api';
import { http } from '@/core/api/client';
import { cartApi, customerOrdersApi, vendorOrdersApi } from '@/core/api/commerce-api';
import { communityApi } from '@/core/api/community-api';
import { chatApi, notificationsApi } from '@/core/api/messaging-api';
import { ApiError } from '@/core/api/problem';
import { getTokens, setTokens } from '@/core/api/token-storage';
import { financeApi, registrationApi, sellerApi, slotsApi } from '@/core/api/vendor-api';
import { wardApi } from '@/core/api/ward-api';
import { fromApiOrder } from '@/features/orders/use-orders';
import { toSessionUser, useAuthStore } from '@/store/auth-store';

// The project has no @types/node; these are the only bits of node:http used here.
type NodeResponse = { statusCode?: number; statusMessage?: string; headers: Record<string, string>; setEncoding(e: string): void; on(ev: string, cb: (chunk: string) => void): void };
type NodeRequest = { on(ev: 'error', cb: (e: Error) => void): void; write(body: string): void; end(): void };
declare const require: (id: string) => unknown;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest runs this file as CommonJS in Node
const nodeHttp = require('node:http') as { request(url: URL, opts: { method: string; headers: Record<string, string> }, cb: (res: NodeResponse) => void): NodeRequest };

const live = process.env.STREETBIZ_LIVE === '1';
const PASSWORD = 'Password123!';

/**
 * jest-expo replaces the global fetch/XMLHttpRequest with React Native stubs in
 * every environment, so requests here go through Node's own http module.
 */
const nodeAdapter: AxiosAdapter = (config) =>
  new Promise((resolve, reject) => {
    const url = new URL(`${config.baseURL ?? ''}${config.url ?? ''}`);
    const headers = Object.fromEntries(Object.entries(config.headers?.toJSON?.() ?? {}).map(([k, v]) => [k, String(v)]));
    const body = typeof config.data === 'string' ? config.data : config.data ? JSON.stringify(config.data) : undefined;
    const req = nodeHttp.request(url, { method: (config.method ?? 'get').toUpperCase(), headers }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => (text += chunk));
      res.on('end', () => {
        const response = { data: text, status: res.statusCode ?? 0, statusText: res.statusMessage ?? '', headers: res.headers, config, request: req };
        const ok = response.status >= 200 && response.status < 300;
        if (ok) resolve(response);
        else reject(new AxiosError(`HTTP ${response.status}`, undefined, config, req, { ...response, data: text ? JSON.parse(text) : '' }));
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
http.defaults.adapter = nodeAdapter;

async function signIn(phone: string) {
  const result = await authApi.login(phone, PASSWORD);
  return useAuthStore.getState().acceptSession(result);
}

(live ? describe : describe.skip)('StreetBiz-BE (live)', () => {
  jest.setTimeout(30_000);

  it('rejects a wrong password with the backend message', async () => {
    await expect(authApi.login('0905000201', 'wrong-Password1!')).rejects.toBeInstanceOf(ApiError);
  });

  describe('buyer', () => {
    beforeAll(async () => {
      const user = await signIn('0905000201');
      expect(user.role_code).toBe('CUSTOMER');
    });

    it('lists licensed vendors and opens a profile', async () => {
      const vendors = await communityApi.activeVendors();
      expect(vendors.length).toBeGreaterThan(0);
      const profile = await communityApi.profile(vendors[0]!.vendorId);
      expect(profile.slotCode).toBeTruthy();
      expect(Array.isArray(profile.comments)).toBe(true);
    });

    it('maps orders, their detail and the pickup code', async () => {
      const page = await customerOrdersApi.list();
      const orders = page.items.map(fromApiOrder);
      expect(orders.every((o) => o.id && o.code && o.status && typeof o.total === 'number')).toBe(true);
      if (!orders.length) return;
      const one = fromApiOrder(await customerOrdersApi.get(orders[0]!.id));
      expect(one.items.length).toBeGreaterThan(0);
      const collectable = orders.find((o) => ['PLACED', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP'].includes(o.status));
      if (collectable) {
        const code = await customerOrdersApi.pickupCode(collectable.id);
        expect(code.token).toBeTruthy();
        expect(code.shortCode).toBeTruthy();
      }
    });

    it('reads cart, payment options, chat and notifications', async () => {
      const cart = await cartApi.get();
      expect(cart === null || Array.isArray(cart.items)).toBe(true);
      const options = await customerOrdersApi.paymentOptions();
      expect(['LIVE', 'SANDBOX', 'UNAVAILABLE']).toContain(options.mode);
      const conversations = await chatApi.conversations();
      if (conversations.length) {
        const thread = await chatApi.thread(conversations[0]!.conversationId, 5);
        expect(thread.conversation.conversationId).toBe(conversations[0]!.conversationId);
      }
      const notifications = await notificationsApi.list(5);
      expect(Array.isArray(notifications.items)).toBe(true);
    });

    it('refreshes an expired access token transparently', async () => {
      const tokens = getTokens()!;
      setTokens({ ...tokens, accessToken: 'expired.or.revoked' });
      await expect(authApi.listSessions()).resolves.toBeInstanceOf(Array);
      expect(getTokens()!.accessToken).not.toBe('expired.or.revoked');
      expect(getTokens()!.refreshToken).not.toBe(tokens.refreshToken);
    });
  });

  describe('seller', () => {
    beforeAll(async () => {
      const user = await signIn('0905000101');
      expect(user.role_code).toBe('VENDOR');
    });

    it('reads registrations, contracts, the permit QR and applications', async () => {
      const regs = await registrationApi.list();
      expect(regs.length).toBeGreaterThan(0);
      const detail = await registrationApi.get(regs[0]!.registrationId);
      expect(detail.registration.registrationId).toBe(regs[0]!.registrationId);

      // An active contract may still be waiting for its permit (404), as the app's home screen expects.
      const contracts = (await slotsApi.contracts()).filter((c) => c.contractStatus === 'ACTIVE');
      let permits = 0;
      for (const c of contracts) {
        try {
          const permit = await slotsApi.permit(c.contractId);
          expect(permit.qrPayload).toBeTruthy();
          expect(permit.effectiveStatus).toBeTruthy();
          permits += 1;
        } catch (e) {
          expect(e).toBeInstanceOf(ApiError);
          expect((e as ApiError).status).toBe(404);
        }
      }
      expect(permits).toBeGreaterThan(0);
      expect(Array.isArray(await slotsApi.applications())).toBe(true);
      expect(Array.isArray(await slotsApi.transfers('incoming'))).toBe(true);
    });

    it('reads every finance list', async () => {
      const summary = await financeApi.summary();
      expect(typeof summary.totalDue).toBe('number');
      const [fees, penalties, invoices, payments, violations] = await Promise.all([
        financeApi.fees(),
        financeApi.penalties(),
        financeApi.invoices(),
        financeApi.payments(),
        financeApi.violations(),
      ]);
      expect(fees.every((f) => f.feeItemId && f.periodLabel)).toBe(true);
      expect(penalties.every((p) => p.penaltyId && p.violationLabel)).toBe(true);
      if (invoices.length) expect((await financeApi.invoice(invoices[0]!.invoiceId)).invoiceNumber).toBe(invoices[0]!.invoiceNumber);
      expect(Array.isArray(payments)).toBe(true);
      expect(Array.isArray(violations)).toBe(true);
    });

    it('reads storefronts and the order board', async () => {
      const stores = await sellerApi.stores();
      expect(Array.isArray(stores)).toBe(true);
      const page = await vendorOrdersApi.list();
      expect(page.items.map(fromApiOrder).every((o) => o.storefrontName)).toBe(true);
    });
  });

  describe('ward officer', () => {
    beforeAll(async () => {
      const user = await signIn('0983000001');
      expect(toSessionUser({ userId: 1, phoneNumber: user.phone, fullName: user.fullName, roleCode: user.role_code, wardUnitId: user.wardUnitId ?? null, accountStatus: 'ACTIVE' }).role_code).toBe(
        'WARD_AUTHORITY',
      );
    });

    it('inspects a permit code', async () => {
      const result = await wardApi.inspect('NOT-A-REAL-PERMIT');
      expect(result.found).toBe(false);
    });
  });
});
