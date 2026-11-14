<div align="center">

# StreetBiz App

**Ứng dụng di động của StreetBiz, nền tảng quản lý hàng rong vỉa hè và chợ trực tuyến cho các phường của Đà Nẵng.**

![Expo SDK 57](https://img.shields.io/badge/Expo_SDK-57-000020?logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-0.86-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Android](https://img.shields.io/badge/Android-3DDC84?logo=android&logoColor=white)
![iOS](https://img.shields.io/badge/iOS-000000?logo=apple&logoColor=white)
![Web](https://img.shields.io/badge/React_Native_Web-4285F4?logo=googlechrome&logoColor=white)

[Bản web](https://www.streetbiz.id.vn) · [Repo backend](https://github.com/zawy2004/StreetBiz-BE) · [Repo web](https://github.com/zawy2004/StreetBiz-FE)

</div>

---

## Mục lục

- [Giới thiệu](#giới-thiệu)
- [Tính năng theo vai trò](#tính-năng-theo-vai-trò)
- [Công nghệ](#công-nghệ)
- [Bắt đầu](#bắt-đầu)
- [Biến môi trường](#biến-môi-trường)
- [Các lệnh](#các-lệnh)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)

## Giới thiệu

StreetBiz App viết bằng Expo React Native, chạy trên **Android, iOS và web** từ cùng một mã
nguồn. App dùng chung API với bản web ([StreetBiz-BE](https://github.com/zawy2004/StreetBiz-BE)),
nên tài khoản, đơn hàng và giấy phép đồng bộ giữa hai bên. App tận dụng các khả năng của điện
thoại:

- camera để quét QR và chụp minh chứng;
- định vị GPS;
- thông báo đẩy, rung phản hồi và đọc giọng nói;
- lưu phiên đăng nhập trong bộ nhớ bảo mật của máy.

## Tính năng theo vai trò

| Vai trò | Màn hình chính |
| --- | --- |
| **Khách hàng** | Khám phá quanh đây, quét QR kiểm tra giấy phép, đặt món, theo dõi đơn, nhắn tin với người bán, trợ lý AI |
| **Hộ kinh doanh** | Trang chủ, vị trí vỉa hè và hợp đồng thuê, đơn hàng, tài chính (phí, hoá đơn, thuế), đăng ký kinh doanh có minh chứng, mã QR giấy phép |
| **Cán bộ phường** | Bảng điều khiển, hộp duyệt hồ sơ, quản lý vị trí, tuần tra và ghi nhận vi phạm |
| **Quản trị nền tảng** | Bảng điều khiển, tài khoản, danh mục món ăn, kiểm duyệt nội dung |

Mọi vai trò đều có:

- đăng nhập bằng mật khẩu hoặc mã OTP qua SMS, xác minh số điện thoại, đặt lại mật khẩu;
- thông báo;
- quản lý tài khoản và phiên đăng nhập.

## Công nghệ

| Hạng mục | Lựa chọn |
| --- | --- |
| Nền tảng | Expo SDK 57, React Native 0.86, React 19, React Native Web |
| Điều hướng | Expo Router (định tuyến theo file, mỗi vai trò một nhóm tab) |
| Dữ liệu | TanStack Query 5, Axios, SignalR (thời gian thực) |
| Trạng thái | Zustand, AsyncStorage, Expo SecureStore |
| Biểu mẫu | React Hook Form và Zod |
| Giao diện | Reanimated, Gesture Handler, FlashList, Expo Image, phông Be Vietnam Pro |
| Thiết bị | Expo Camera, Location, Notifications, Audio, Speech, Haptics, Image Picker |
| Chất lượng | Jest Expo, React Native Testing Library, ESLint, Prettier, TypeScript strict |

## Bắt đầu

### Yêu cầu

- Node.js 20 trở lên và npm
- Ứng dụng **Expo Go** trên điện thoại, hoặc Android Studio / Xcode để chạy máy ảo
- StreetBiz-BE chạy ở máy local (xem README của backend)

### Cài đặt

~~~powershell
npm install
Copy-Item .env.example .env
~~~

### Chạy cùng backend local

1. Chạy API bằng profile `http` (cổng 5023):

   ~~~powershell
   cd ..\StreetBiz-BE
   dotnet run --project src/StreetBiz.API --launch-profile http
   ~~~

2. Chạy app:

   ~~~powershell
   npm start
   ~~~

3. Quét mã QR bằng Expo Go, hoặc bấm `a` để mở Android, `i` để mở iOS, `w` để mở web.

Khi để trống `EXPO_PUBLIC_API_BASE_URL`, app tự gọi API ở cổng 5023 trên chính máy đang chạy
Metro. Điện thoại và máy tính phải dùng cùng mạng Wi-Fi. Với máy ảo Android, chạy thêm
`adb reverse tcp:5023 tcp:5023`.

### Tài khoản demo

Các tài khoản này có sẵn trong dữ liệu demo của backend. Tất cả dùng mật khẩu `Password123!`.

| Vai trò | Số điện thoại |
| --- | --- |
| Quản trị nền tảng | `0900000001` |
| Cán bộ phường | `0983000001` |
| Hộ kinh doanh | `0905000101` |
| Khách hàng | `0905000201` |

## Biến môi trường

Sao chép `.env.example` thành `.env`. Không commit file `.env`.

| Biến | Ý nghĩa |
| --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | Địa chỉ API. Để trống khi phát triển thì app tự dùng máy chạy Metro, cổng 5023 |
| `EXPO_PUBLIC_APP_ENV` | `development` hiện các công cụ dành cho dev |
| `EXPO_PUBLIC_ENABLE_AI_COMPLIANCE` | Bật các gợi ý AI |
| `EXPO_PUBLIC_ENABLE_PHASE_2` | Bật các màn hình chợ trực tuyến |
| `EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS` | Bật thông báo đẩy |
| `EXPO_PUBLIC_ENABLE_PAYMENT_SANDBOX` | Dùng môi trường thanh toán thử |
| `EXPO_PUBLIC_CITY_FEEDBACK_PHONE`, `EXPO_PUBLIC_CITY_FEEDBACK_URL` | Kênh góp ý 1022 của Đà Nẵng, hiện trên bảng giá |

> [!CAUTION]
> Mọi biến `EXPO_PUBLIC_*` đều bị đóng gói vào app. Không đặt JWT, OTP, mật khẩu, khoá thanh
> toán hay khoá nhà cung cấp vào các biến này.

## Các lệnh

| Lệnh | Mục đích |
| --- | --- |
| `npm start` | Chạy Metro bundler |
| `npm run android` / `npm run ios` / `npm run web` | Mở trên Android, iOS hoặc trình duyệt |
| `npm run lint` | ESLint |
| `npm run typecheck` | Kiểm tra kiểu TypeScript |
| `npm test -- --runInBand` | Chạy bộ test Jest |
| `npm run test:watch` | Jest ở chế độ watch |
| `npm run doctor` | Kiểm tra cấu hình và phiên bản thư viện Expo |
| `npm run export:web` | Build bản web tĩnh vào `dist/` |

Trước khi mở pull request, hãy chạy:

~~~powershell
npm run lint; npm run typecheck; npm test -- --runInBand
~~~

## Build bản cài đặt (EAS)

Build chạy trên máy chủ của Expo (EAS Build), không cần Android Studio hay Xcode. `eas.json` có 3 profile, đều gọi API
production (`https://api.103-78-1-179.sslip.io/api`):

| Profile | Dùng cho | Kết quả |
|---|---|---|
| `development` | Thử trên máy thật, bật công cụ dev | APK cài trực tiếp |
| `preview` | Gửi cho người thử (phường, hộ kinh doanh) | APK cài trực tiếp (Android), bản nội bộ (iOS) |
| `production` | Đưa lên CH Play / App Store | AAB (Android), IPA (iOS); số build tự tăng |

Lần đầu (một lần cho cả dự án):

~~~powershell
npm install -g eas-cli
eas login            # tài khoản Expo của nhóm
eas init             # gắn app với project trên expo.dev, ghi extra.eas.projectId vào app.json
~~~

Mỗi lần build:

~~~powershell
eas build --profile preview --platform android     # APK để gửi người thử
eas build --profile production --platform all      # bản lên store
eas submit --profile production --platform android # đẩy bản mới nhất lên CH Play
~~~

- iOS cần tài khoản Apple Developer (99 USD/năm), CH Play cần tài khoản Google Play Console (25 USD một lần).
- Quyền camera, ảnh, vị trí (chỉ khi đang mở app) và micro đã khai báo trong `app.json`, kèm câu giải thích tiếng Việt
  hiện cho người dùng. App không xin vị trí chạy nền.
- Icon và màn hình khởi động nằm ở `src/assets/app/`.
- **Thông báo đẩy** bật sẵn trong 3 profile (`EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS=true`). Sau khi đăng nhập, app xin
  quyền, lấy Expo push token và gửi lên `POST /api/devices`. Server đẩy mọi thông báo mới tới máy đó; bấm vào thông
  báo sẽ mở đúng màn hình. Cần làm một lần:
  - Android: tạo project Firebase, tải *service account key* (FCM V1) và đưa lên bằng `eas credentials` →
    Android → Push Notifications.
  - iOS: `eas build` tự tạo khoá APNs khi đăng nhập tài khoản Apple Developer.
  - Expo Go trên Android không nhận được push từ xa; hãy thử bằng bản build `preview`.

## Cấu trúc thư mục

~~~text
src/
├── app/            Expo Router: mỗi file là một màn hình
│   ├── auth/       Đăng nhập, đăng ký, xác minh số điện thoại, mật khẩu
│   ├── customer/   Tab khách hàng: khám phá, quét QR, đơn hàng, tin nhắn, tài khoản
│   ├── vendor/     Tab hộ kinh doanh: trang chủ, vị trí, đơn hàng, tài chính, tài khoản
│   ├── ward/       Tab cán bộ phường: bảng điều khiển, hộp duyệt, vị trí, tuần tra
│   └── platform/   Tab quản trị: bảng điều khiển, tài khoản, danh mục, kiểm duyệt
├── features/       Mỗi nghiệp vụ một thư mục (API, hook, component)
├── components/     Component dùng chung
├── ui/             Khối giao diện nền (bảng hiệu, tab bar, thanh trạng thái)
├── core/           API client, xác thực, cấu hình, hạ tầng dùng chung
├── services/       Adapter: camera, bản đồ, thông báo, thanh toán, QR, realtime, upload
├── store/          Zustand store
├── providers/      Provider của ứng dụng
├── hooks/          Hook dùng chung
├── theme/          Design token: màu, chữ, khoảng cách
├── dev/            Công cụ chỉ dùng khi phát triển
├── assets/         Phông chữ, icon, hình ảnh
├── types/          Kiểu dùng chung
└── utils/          Hàm tiện ích thuần

tests/              Test cho components, features, navigation, utils
~~~

---

<div align="center">
<sub>StreetBiz là đồ án tốt nghiệp. Backend và bản web nằm ở các repo riêng.</sub>
</div>
