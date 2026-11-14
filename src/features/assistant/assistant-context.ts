import type { AssistantMessage, AssistantRole } from './types';

/** Copy and prompts from the web's `assistant-context.ts` / `assistant-ux.ts`. */
export function welcome(role: AssistantRole) {
  const content: Record<AssistantRole, { title: string; description: string }> = {
    GUEST: {
      title: 'Khám phá StreetBiz cùng bạn',
      description: 'Tìm hiểu đăng ký kinh doanh, ô vỉa hè và cách kiểm tra giấy phép. Bắt đầu bằng một câu hỏi.',
    },
    CUSTOMER: {
      title: 'Bạn muốn khám phá điều gì?',
      description: 'Tìm người bán, hiểu thông tin công khai và biết cách kiểm tra giấy phép trước khi lựa chọn.',
    },
    VENDOR: {
      title: 'Việc kinh doanh, rõ ràng hơn',
      description: 'Cùng xem hồ sơ, hợp đồng và các khoản phí của bạn để tìm bước tiếp theo.',
    },
    WARD_AUTHORITY: {
      title: 'Thông tin rõ, đối chiếu dễ',
      description: 'Tra cứu trong phạm vi phường, tóm tắt hồ sơ và chuẩn bị những điểm cần đối chiếu.',
    },
    PLATFORM_ADMIN: {
      title: 'Nắm bắt việc cần xem xét',
      description: 'Hỗ trợ tra cứu danh mục, nội dung kiểm duyệt và hướng dẫn vận hành nền tảng.',
    },
  };
  return content[role];
}

export function suggestions(role: AssistantRole): string[] {
  switch (role) {
    case 'VENDOR':
      return ['Hồ sơ kinh doanh của tôi đang ở bước nào?', 'Tôi cần đóng khoản phí nào?', 'Hợp đồng của tôi khi nào hết hạn?'];
    case 'WARD_AUTHORITY':
      return ['Tóm tắt tình hình phường', 'Hồ sơ nào đang chờ xử lý?', 'Giải thích báo cáo thu của phường'];
    case 'PLATFORM_ADMIN':
      return ['Nội dung nào đang chờ kiểm duyệt?', 'Các danh mục hiện có', 'Quyền của quản trị nền tảng gồm những gì?'];
    case 'CUSTOMER':
      return ['Làm sao kiểm tra giấy phép người bán?', 'Quán bánh mì nào đang mở gần tôi?', 'Tôi muốn gửi phản ánh cộng đồng'];
    default:
      return ['StreetBiz giúp tôi làm gì?', 'Tôi muốn đăng ký bán hàng', 'Làm sao kiểm tra giấy phép?'];
  }
}

export function followUps(message: AssistantMessage, role: AssistantRole): string[] {
  if (message.status !== 'COMPLETED' || message.sender !== 'ASSISTANT') return [];
  const tools = new Set(message.sources.map((s) => s.id.split(':')[1]).filter(Boolean));
  const out: string[] = [];
  if (role === 'CUSTOMER' && tools.has('public.food')) out.push('Quầy nào đang mở cửa?', 'Làm sao kiểm tra giấy phép của quầy?');
  if (tools.has('vendor.finance') || tools.has('vendor.fees') || tools.has('vendor.penalties'))
    out.push('Khoản nào sắp đến hạn?', 'Xem lịch sử thanh toán của tôi');
  if (tools.has('vendor.contracts') || tools.has('vendor.contract')) out.push('Giấy phép của tôi còn hiệu lực không?', 'Làm sao gia hạn hợp đồng?');
  if (tools.has('vendor.registrations') || tools.has('vendor.registration'))
    out.push('Hồ sơ của tôi cần bổ sung gì?', 'Đăng ký xong thì thuê ô thế nào?');
  if (tools.has('ward.dashboard')) out.push('Hồ sơ nào đang chờ xử lý?', 'Giải thích báo cáo thu của phường');
  if (tools.has('ward.slot_permit')) out.push('Quy trình xử lý khi giấy phép tạm đình chỉ?');
  return out.slice(0, 3);
}

/**
 * The server names web routes; the app's tree differs in a few places. Each action is
 * mapped to the app screen that does the same job, and an action with no app screen is
 * not offered (never a dead button). Role scope is checked first, like the web's
 * `safeRoute`: an action can only lead inside the asker's own area.
 */
const REWRITES: [RegExp, string][] = [
  [/^\/vendor\/registrations(\/\d+)?$/, '/vendor/home/registrations$1'],
  [/^\/vendor\/store\/food-safety$/, '/vendor/home/store/food-safety'],
  [/^\/vendor\/store(\/menu|\/edit)?$/, '/vendor/home/store$1'],
  [/^\/vendor\/chat$/, '/vendor/home/chat'],
  [/^\/(?:vendor|customer)\/chat\/(\d+)$/, '/chat/$1'],
  [/^\/ward\/reports$/, '/ward/more/reports'],
  [/^\/ward\/debtors$/, '/ward/more/debtors'],
  [/^\/ward\/finance(\/\d+)?$/, '/ward/more/finance$1'],
  [/^\/ward\/settings\/penalties$/, '/ward/more/penalties'],
  [/^\/ward\/settings\/(pricing|zones)$/, '/ward/more/pricing'],
];

const APP_ROUTES: RegExp[] = [
  /^\/auth\/(register|sign-in)$/,
  /^\/customer\/(explore|scan|orders|chat|account)$/,
  /^\/customer\/explore\/(stores|vendors|items)\/\d+$/,
  /^\/customer\/orders\/\d+$/,
  /^\/vendor\/(home|slots|orders|finance|account)$/,
  /^\/vendor\/home\/(registrations|store|chat)$/,
  /^\/vendor\/home\/registrations\/\d+$/,
  /^\/chat\/\d+$/,
  /^\/vendor\/home\/store\/(menu|edit|food-safety)$/,
  /^\/vendor\/slots\/(mine|contracts|rental-applications|transfers)$/,
  /^\/vendor\/slots\/(contracts|rental-applications)\/\d+$/,
  /^\/vendor\/slots\/\d+$/,
  /^\/vendor\/slots\/contracts\/\d+\/permit$/,
  /^\/vendor\/finance\/(invoices|payments|violations)$/,
  /^\/vendor\/finance\/invoices\/\d+$/,
  /^\/vendor\/orders\/\d+$/,
  /^\/ward\/(dashboard|inbox|patrol|slots|more)$/,
  /^\/ward\/inbox\/(cases|food-safety)$/,
  /^\/ward\/inbox\/(registrations|rental-applications|renewals|food-safety)\/\d+$/,
  /^\/ward\/patrol\/violations(\/\d+)?$/,
  /^\/ward\/more\/(reports|debtors|finance|pricing|penalties)$/,
  /^\/ward\/more\/finance\/\d+$/,
  /^\/ward\/slots\/\d+$/,
  /^\/platform\/(dashboard|accounts|categories|moderation)$/,
  /^\/platform\/moderation\/(content|complaints)\/\d+$/,
];

const ROLE_AREA: Record<Exclude<AssistantRole, 'GUEST'>, string> = {
  CUSTOMER: '/customer/',
  VENDOR: '/vendor/',
  WARD_AUTHORITY: '/ward/',
  PLATFORM_ADMIN: '/platform/',
};

const ACCOUNT_HOME: Record<Exclude<AssistantRole, 'GUEST'>, string> = {
  CUSTOMER: '/customer/account',
  VENDOR: '/vendor/account',
  WARD_AUTHORITY: '/ward/more/account',
  PLATFORM_ADMIN: '/platform/me',
};

export function appRoute(route: string, role: AssistantRole): string | undefined {
  if (!route.startsWith('/') || route.startsWith('//') || /[\\?#%\s]/.test(route) || route.split('/').some((s) => s === '.' || s === '..'))
    return undefined;
  if (route === '/account') return role === 'GUEST' ? undefined : ACCOUNT_HOME[role];
  if (role === 'GUEST') return /^\/(auth\/(register|sign-in)|customer\/(explore|scan))$/.test(route) ? route : undefined;
  if (!route.startsWith(ROLE_AREA[role])) return undefined;
  let mapped = route;
  for (const [pattern, target] of REWRITES) {
    if (pattern.test(route)) {
      mapped = route.replace(pattern, target);
      break;
    }
  }
  return APP_ROUTES.some((p) => p.test(mapped)) ? mapped : undefined;
}
