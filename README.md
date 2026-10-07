# StreetBiz App

Ứng dụng Expo React Native đa nền tảng của StreetBiz, được khởi tạo theo cùng
baseline với `StreetBiz-FE` và hỗ trợ Android, iOS cùng React Native Web.

App gọi thẳng StreetBiz-BE (cùng hợp đồng API với StreetBiz-FE). Đặt
`EXPO_PUBLIC_USE_MOCK_API=true` để chạy hoàn toàn bằng dữ liệu demo trong
`src/mocks`, không cần backend.

## Công nghệ

- Expo SDK 57 và Expo Router
- React Native 0.86, React 19, TypeScript strict
- React Query, Zustand, React Hook Form và Zod
- Axios, SignalR và Day.js
- Jest Expo, React Native Testing Library, ESLint và Prettier

## Cài đặt và chạy

~~~powershell
npm install
Copy-Item .env.example .env
npm start
~~~

Các lệnh khác:

~~~powershell
npm run android
npm run ios
npm run web
npm run lint
npm run typecheck
npm test -- --runInBand
npm run export:web
~~~

## Kết nối backend

1. Chạy StreetBiz-BE (cổng 5023). Để điện thoại thật / máy ảo Android gọi được,
   API phải nghe trên mọi địa chỉ; để bản web (`npm run web`, cổng 8081) gọi
   được, thêm origin đó vào CORS:

   ~~~powershell
   cd ..\StreetBiz-BE
   $env:Cors__AllowedOrigins__3 = 'http://localhost:8081'
   dotnet run --project src/StreetBiz.API --launch-profile http --urls http://0.0.0.0:5023
   ~~~

2. `.env` của App: `EXPO_PUBLIC_API_BASE_URL=http://localhost:5023/api`,
   `EXPO_PUBLIC_USE_MOCK_API=false`. Trên điện thoại, `localhost` tự đổi thành
   địa chỉ LAN của máy chạy Expo (`src/core/config/env.ts`); máy và điện thoại
   phải cùng mạng và tường lửa Windows mở cổng 5023.
3. Tài khoản demo của backend (`StreetBiz-BE/db/StreetBiz_Demo_Seed.sql`, mật
   khẩu `Password123!`): người mua `0905000201`, hộ kinh doanh `0905000101`,
   cán bộ phường `0983000001`. Màn đăng nhập có nút đăng nhập nhanh ở môi
   trường development.
4. OTP khi đăng ký / quên mật khẩu ở môi trường Development được in ra cửa sổ
   chạy API (dòng `[DEV-SMS]`). Mật khẩu mới theo BR-59: ≥ 8 ký tự, có chữ hoa,
   chữ thường, số và ký tự đặc biệt.
5. Thanh toán: `EXPO_PUBLIC_ENABLE_PAYMENT_SANDBOX=true` hiện nút "Thanh toán
   thử" gọi endpoint sandbox của backend (chỉ có ở Development). Không bật thì
   App mở trang thanh toán của cổng (MoMo test) và tự kiểm tra lại kết quả khi
   người dùng quay về App.

Cấu trúc lớp dữ liệu:

~~~text
src/core/api/        client axios (token, tự làm mới token, lỗi ProblemDetails),
                     *-api.ts: một file theo nhóm controller của backend
src/core/api/dual.ts useDualQuery / useDualMutation: cùng một hook trả dữ liệu
                     từ backend hoặc từ src/mocks tuỳ EXPO_PUBLIC_USE_MOCK_API
src/features/*/use-*.ts  hook theo nghiệp vụ, trả về kiểu dữ liệu màn hình dùng
~~~

Kiểm tra với backend đang chạy (chỉ đọc, ngoài việc tạo phiên đăng nhập):

~~~powershell
$env:STREETBIZ_LIVE='1'; $env:EXPO_PUBLIC_API_BASE_URL='http://localhost:5023/api'
npx jest tests/live --runInBand --no-cache
~~~

Lưu ý: database phải theo đúng `StreetBiz-BE/db/StreetBiz_SQL_Server.sql` hiện
tại. Database cũ thiếu cột/bảng (ví dụ `requires_food_safety`,
`FoodSafetyApplications`) sẽ làm thực đơn, giỏ hàng, bản đồ ô thuê và ATTP trả
lỗi 500; dựng lại bằng `StreetBiz-BE/scripts/setup-local-db.ps1 -Recreate`
(xoá toàn bộ dữ liệu cũ).

## Luồng giao diện

Theo cùng mô hình với `StreetBiz-FE` (`router.tsx`, `layouts/RoleShell.tsx`):

| Trạng thái | Vào đâu | Thấy gì |
|---|---|---|
| Chưa đăng nhập (khách) | `/welcome` | Trang giới thiệu → xem quán ở `/customer/explore` với 3 tab: Khám phá · Quét QR · Khách. Xem quán, thực đơn, thêm giỏ được; đặt món, nhắn tin, đánh giá sẽ chuyển sang đăng nhập rồi quay lại đúng trang (`?next=`). |
| Người mua (`CUSTOMER`) | `/customer/explore` | Thêm tab Đơn hàng và Tin nhắn, giỏ hàng và thông báo trên header. |
| Hộ kinh doanh (`VENDOR`) | `/vendor/home` | 6 tab: Trang chủ · Ô thuê · Tài chính · Đơn hàng · Tin nhắn · Tài khoản. |

Các layout `customer/`, `vendor/`, `ward/` tự chuyển hướng khi sai vai trò
(`src/core/auth/guards.tsx`, `src/core/auth/role-routes.ts`). Đổi màn hình
nào cần đăng nhập thì sửa `MEMBERS_ONLY` trong `src/app/customer/_layout.tsx`.

Tài khoản demo khi `EXPO_PUBLIC_USE_MOCK_API=true` (mật khẩu `123456`): người
mua `0905000001`, hộ kinh doanh `0905000002`.

## Giao diện sáng / tối

Màu nằm trong `src/theme/colors.ts` (`lightColors`, `darkColors`); không viết mã
màu trực tiếp trong màn hình, dùng `useTheme()`. Người dùng chọn Theo máy /
Sáng / Tối ở tab Tài khoản (khách cũng có), lựa chọn được lưu trong
`src/store/theme-prefs.ts`.

## Cấu trúc

~~~text
src/
|-- app/          Expo Router entry files
|-- assets/       Fonts, icons và images
|-- components/   UI dùng chung
|-- core/         API, auth, config và hạ tầng dùng chung
|-- features/     Module theo nghiệp vụ
|-- hooks/        Shared hooks
|-- layouts/      Header theo vai trò (giống StreetBiz-FE/src/layouts)
|-- providers/    Application providers
|-- services/     Adapter camera, map, notification, payment, QR...
|-- store/        Client state
|-- theme/        Design tokens
|-- types/        Shared types
+-- utils/        Pure utilities
~~~

Biến `EXPO_PUBLIC_*` được đóng gói vào client. Không lưu JWT, OTP, mật khẩu,
payment secret hoặc provider key trong các biến này.
