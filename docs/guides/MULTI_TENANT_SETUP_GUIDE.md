# Hướng Dẫn Multi-Tenant: Phòng Khám Thật & Tạo Phòng Khám Mới

Hệ thống Clinic Platform vận hành đa tenant: mỗi phòng khám là một `organization`, dữ liệu cách ly 100% qua Row Level Security (`current_org_id()`), truy cập qua URL riêng `/$slug/...`.

## 1. Hai tổ chức đang tồn tại thật trên DB (14/08/2026)

| Tên | Slug | Code | Loại | Ghi chú |
|---|---|---|---|---|
| Nha khoa Việt Smile | `viet-smile` | `VIETSMILE` | dental | Tenant thật duy nhất có dữ liệu vận hành (8 nhân viên mẫu, chấm công, lương) |
| Hệ Thống GZV Platform (Central Hub) | `gzv` | `GZV_PLATFORM` | — | Tổ chức rỗng, chỉ dùng làm "nhà" cho 2 tài khoản Super Admin, không có nhân sự/bệnh nhân thật |

Không còn tồn tại "Nha Khoa CT" hay "Bá Lộc" như một số tài liệu cũ mô tả — đó là dữ liệu giả định trong các migration chưa từng được áp dụng, đã bị loại bỏ khi dọn hạ tầng Super Admin (xem `supabase/migrations/20260813160000_super_admin_platform_infra.sql`).

## 2. Tài khoản Super Admin

2 tài khoản `tuloc2706@gmail.com` và `stephensouth1307@gmail.com` có org nhà là `gzv`, role `administrator`, được `is_super_admin()` nhận diện là Super Admin nền tảng. Sau khi đăng nhập, họ landing tại `/gzv/admin/dashboard` — nơi có:
- Danh sách toàn bộ phòng khám (nhóm theo chuyên khoa).
- Thanh chuyển đổi không gian làm việc (workspace switcher) — cả ở header ứng dụng lẫn trong trang admin dashboard.
- Nút **"+ Thêm Phòng Khám Chi Nhánh Mới"**.

## 3. Tạo phòng khám mới (Super Admin)

Tại `/gzv/admin/dashboard`, bấm "+ Thêm Phòng Khám Chi Nhánh Mới":
1. Nhập tên phòng khám — slug URL tự sinh từ tên (có thể sửa tay).
2. Chọn loại hình chuyên khoa (1 trong 10: Nha Khoa, Đa Khoa, Sản-Phụ Khoa, Nhi Khoa, Da Liễu, Mắt, Tai Mũi Họng, Thẩm Mỹ, Vật Lý Trị Liệu, Bệnh Viện).
3. Bấm "Tạo phòng khám" — hệ thống gọi RPC `super_admin_create_clinic()`, tạo đồng thời dòng `organizations` và `clinic_profiles` trong 1 transaction, rồi **tự động chuyển bạn vào không gian làm việc của phòng khám vừa tạo** (`/$slug/admin/dashboard`).

Phòng khám mới tạo chưa có nhân sự/phòng ban/ca làm — cần thêm dữ liệu (hiện tại các trang Nhân sự/Phòng ban/Chức danh/Ca làm chỉ xem danh sách, **chưa có form Thêm trên UI**; seed qua SQL trực tiếp giống cách `20260814100000_seed_viet_smile_demo_data.sql` đã làm cho Việt Smile, hoặc chờ tính năng CRUD được bổ sung).

## 4. Cơ chế kỹ thuật (tóm tắt, xem chi tiết ở [ARCHITECTURE_OVERVIEW.md](../architecture/ARCHITECTURE_OVERVIEW.md))

- `get_organization_by_slug(slug)` — route `$clinicSlug` gọi hàm này trong `beforeLoad` để resolve slug thành org.
- `super_admin_switch_clinic_by_slug(slug)` — mỗi lần Super Admin vào 1 slug bất kỳ (gõ URL, bookmark, hay bấm switcher), hệ thống tự đồng bộ `current_org_id()` theo slug đó.
- Nhân viên phòng khám (không phải Super Admin) vào nhầm slug của phòng khám khác sẽ bị tự động chuyển hướng về đúng slug của họ.

## 5. Migration bị bỏ qua có chủ đích

Các migration `20260813080000/090000/090001/120000` (seed "Nha Khoa CT"/"Bá Lộc", và đặc biệt là script tạo/reset mật khẩu tài khoản Super Admin về `123456`) **không được áp dụng** — chứa dữ liệu giả định không khớp thực tế và một thao tác reset mật khẩu nguy hiểm. Hạ tầng Super Admin thật được tái tạo sạch tại `20260813160000_super_admin_platform_infra.sql`, không đụng đến `auth.users`.
