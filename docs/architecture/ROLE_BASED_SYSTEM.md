# Vai trò & Phân quyền

## Danh sách vai trò (`app_role`, định nghĩa tại `src/lib/permissions.ts`)

| Role | Ý nghĩa |
|---|---|
| `administrator` | Quản trị viên phòng khám. Nếu org nhà là `GZV_PLATFORM` → tự động là **Super Admin nền tảng** (xem `is_super_admin()`), quản lý/chuyển đổi được mọi phòng khám. |
| `manager` | Quản lý — nhân sự, lương, báo cáo. |
| `receptionist` | Lễ tân — đặt lịch, quản lý bệnh nhân. |
| `employee` | Nhân viên — chấm công, xem hồ sơ cá nhân. |
| `doctor` | Bác sĩ — dashboard/lịch khám/lương riêng, cũng thấy được lịch khám chung. |
| `patient` | Bệnh nhân — chỉ thấy hồ sơ/lịch hẹn của mình. |

Super Admin **không phải** một role riêng trong `app_role` — là `administrator` thuộc tổ chức có `code = 'GZV_PLATFORM'` (kiểm tra qua RPC `is_super_admin()`). Vì vậy về mặt kỹ thuật, 2 tài khoản Super Admin có role `administrator` như bất kỳ quản trị viên phòng khám nào khác; điều khác biệt là org nhà của họ và quyền gọi các RPC `super_admin_*`.

## Nhóm điều hướng & quyền xem (`NAV_GROUPS` trong `src/lib/permissions.ts`)

| Nhóm | Route tiêu biểu | Role được xem |
|---|---|---|
| Tổng quan | `/dashboard`, `/admin/dashboard`, `/doctor/dashboard` | tương ứng ALL / ADMIN / DOCTOR |
| Khám bệnh & Lịch hẹn | `/appointments/*`, `/patients`, `/rooms` | administrator, manager, receptionist, doctor |
| Nhân sự & Ca làm | `/employees`, `/departments`, `/positions`, `/shifts`, `/hr/*` | administrator, manager |
| Chấm công & Vân tay | `/attendance/*` | ALL xem chấm công thực tế; sửa/duyệt cần administrator/manager |
| Báo cáo | `/reports/*` | administrator, manager (một phần cho receptionist) |
| Quản trị Hệ thống GZV | `/biometric/devices`, `/system/*` | administrator/manager tuỳ trang, một số chỉ ADMIN |

Toàn bộ route ở trên đều thực chạy dưới prefix `/$clinicSlug/...` (ví dụ `/viet-smile/employees`) — bảng trên giữ dạng rút gọn vì `NAV_GROUPS` được thiết kế slug-agnostic, dùng chung cho mọi phòng khám (xem [ARCHITECTURE_OVERVIEW.md §3](./ARCHITECTURE_OVERVIEW.md#3-routing)).

## Kiểm tra quyền ở đâu

1. **Route-level**: `src/routes/_authenticated/$clinicSlug/route.tsx` — so khớp `routeRoles(pathname)` với role của user, chặn bằng `<PermissionDenied />` nếu không đủ quyền.
2. **RLS (database)**: mọi bảng nghiệp vụ lọc theo `organization_id = current_org_id()`; các thao tác ghi (write) còn yêu cầu thêm `is_staff_manager()`.
3. **RPC Super Admin**: mọi RPC `super_admin_*` tự kiểm tra `is_super_admin()` ngay trong hàm (SECURITY DEFINER), không dựa vào client.
