# CSKH CRM

Web quản lý dữ liệu khách hàng cho đội CSKH/Sales.

## Hướng backend

Dự án chạy theo hướng Supabase:

- Supabase Postgres lưu dữ liệu khách hàng, nhân viên, lịch làm, doanh thu và lịch sử chăm sóc.
- Supabase Storage lưu ảnh minh chứng lịch sử cuộc gọi.
- Backend Node.js vẫn giữ vai trò xử lý nghiệp vụ: đăng nhập, phân quyền, import Excel, nhận khách, chống nhận trùng và theo dõi kết quả gọi.

Cách này giúp dùng Supabase làm hạ tầng backend nhanh, nhưng không bỏ các luật nghiệp vụ đang chạy ổn trong API hiện tại.

## Chức năng chính

- Đăng nhập JWT, phân quyền `ADMIN` và `STAFF`.
- Quản trị viên: nhập dữ liệu Excel, quản lý nhân viên, xem lịch làm, theo dõi doanh thu, phiên nhập và tình trạng từng số điện thoại.
- Nhân viên: nhận dữ liệu khách hàng, xem khách hàng của tôi, cập nhật kết quả gọi, trạng thái nhắn tin và ảnh minh chứng cuộc gọi.
- Một khách hàng chỉ có một nhân viên phụ trách tại một thời điểm.
- Khách đã được nhận sẽ biến mất khỏi danh sách dữ liệu chờ nhận của nhân viên khác.

## Tài khoản test

- Quản trị viên: `admin` / `1`
- Nhân viên: `NV` / `1`

## Chạy local bằng PostgreSQL local

1. Tạo file môi trường:

```powershell
Copy-Item .env.example .env
```

2. Cài dependencies:

```bash
npm install
```

3. Chạy PostgreSQL local bằng Docker:

```bash
docker compose up -d postgres
```

4. Tạo Prisma client, chạy migration và seed tài khoản test:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

5. Chạy app:

```bash
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:4000
- Health check: http://localhost:4000/health

## Chuyển sang Supabase

Trong Supabase, tạo project mới rồi lấy connection string PostgreSQL. Có thể xem mẫu tại `apps/api/.env.supabase.example`.

Điền vào `apps/api/.env`:

```env
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@[REGION].pooler.supabase.com:5432/postgres?schema=public"
DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@[REGION].pooler.supabase.com:5432/postgres?schema=public"
```

Sau đó chạy:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

## Lưu ảnh cuộc gọi lên Supabase Storage

Tạo bucket Storage tên `cskh-call-images`. Với bản dùng nhanh, đặt bucket ở chế độ public để ảnh có thể hiển thị trực tiếp trong web.

Điền thêm vào `apps/api/.env`:

```env
SUPABASE_STORAGE_ENABLED=true
SUPABASE_URL="https://[PROJECT_REF].supabase.co"
SUPABASE_SERVICE_ROLE_KEY="[SERVICE_ROLE_KEY]"
SUPABASE_CALL_IMAGES_BUCKET="cskh-call-images"
```

Lưu ý: `SUPABASE_SERVICE_ROLE_KEY` chỉ được đặt trong backend, không đưa vào frontend.

## Import Excel

File mẫu nằm tại `sample-data/customer-import-template.xlsx`.

Hệ thống chỉ lấy các cột:

- `Tên công ty`
- `Tên người đứng đầu công ty`
- `Địa điểm`
- `Số điện thoại`
- `Thành phố`

Các cột khác trong file Excel sẽ bị bỏ qua.

## API chính

- `POST /auth/login`
- `GET /dashboard`
- `GET /customers`
- `GET /customers/:id`
- `POST /customers/import`
- `PUT /customers/:id`
- `POST /customers/:id/claim`
- `POST /customers/:id/release`
- `POST /customers/:id/interactions`
- `GET /customers/imports`
- `GET /users`
- `POST /users`
- `PATCH /users/:id`
- `DELETE /users/:id`
- `GET /users/schedules`
