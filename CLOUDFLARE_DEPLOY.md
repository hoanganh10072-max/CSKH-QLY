# Triển khai Cloudflare

Dự án đã được chuẩn bị để chạy trên Cloudflare Workers:

- Web: `mscilabs-web` cho `trungtamgiasuskv.cloud` và `www.trungtamgiasuskv.cloud`.
- API: `mscilabs-api` cho `api.trungtamgiasuskv.cloud`.

## 1. Điều kiện bắt buộc

Cần có Cloudflare account đã quản lý zone `trungtamgiasuskv.cloud`.

Database production là PostgreSQL bên ngoài Cloudflare, được kết nối bằng các secret `DATABASE_URL` và `DIRECT_URL`.

## 2. Đăng nhập Cloudflare trên máy

```powershell
npx wrangler login
```

## 3. Cấu hình secret cho API

Chạy từng lệnh sau, sau đó dán giá trị thật khi terminal hỏi:

```powershell
npx wrangler secret put DATABASE_URL --config apps/api/wrangler.jsonc
npx wrangler secret put DIRECT_URL --config apps/api/wrangler.jsonc
npx wrangler secret put JWT_SECRET --config apps/api/wrangler.jsonc
```

Nếu bật lưu ảnh minh chứng bằng Supabase Storage thì chạy thêm:

```powershell
npx wrangler secret put SUPABASE_URL --config apps/api/wrangler.jsonc
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config apps/api/wrangler.jsonc
```

Sau đó đổi `SUPABASE_STORAGE_ENABLED` trong `apps/api/wrangler.jsonc` thành `true`.

## 4. Chạy migration database

Với database mới, đặt `DATABASE_URL` và `DIRECT_URL` trong `apps/api/.env`, rồi chạy:

```powershell
npm run prisma:migrate -w @cskh/api
npm run seed:admin -w @cskh/api
```

Tài khoản admin mặc định do seed tạo vẫn theo cấu hình hiện tại của dự án.

## 5. Deploy Cloudflare

Deploy API trước:

```powershell
npm run cloudflare:deploy:api
```

Deploy web sau:

```powershell
npm run cloudflare:deploy:web
```

Hoặc deploy cả hai:

```powershell
npm run cloudflare:deploy
```

## 6. DNS

Các hostname production đã được gắn trực tiếp với Worker bằng Custom Domain:

- `api.trungtamgiasuskv.cloud` -> `mscilabs-api`
- `trungtamgiasuskv.cloud` và `www.trungtamgiasuskv.cloud` -> `mscilabs-web`
