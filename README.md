# StreetBiz App

Ứng dụng Expo React Native đa nền tảng của StreetBiz, được khởi tạo theo cùng
baseline với `StreetBiz-FE` và hỗ trợ Android, iOS cùng React Native Web.

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

## Cấu trúc

~~~text
src/
|-- app/          Expo Router entry files
|-- assets/       Fonts, icons và images
|-- components/   UI dùng chung
|-- core/         API, auth, config và hạ tầng dùng chung
|-- features/     Module theo nghiệp vụ
|-- hooks/        Shared hooks
|-- providers/    Application providers
|-- services/     Adapter camera, map, notification, payment, QR...
|-- store/        Client state
|-- theme/        Design tokens
|-- types/        Shared types
+-- utils/        Pure utilities
~~~

Biến `EXPO_PUBLIC_*` được đóng gói vào client. Không lưu JWT, OTP, mật khẩu,
payment secret hoặc provider key trong các biến này.
