import type {
  LucideIcon,
} from "lucide-react";
import {
  Activity,
  BadgeCheck,
  Building2,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  DoorOpen,
  Clock,
  DollarSign,
  FileSpreadsheet,
  Fingerprint,
  Gauge,
  HeartPulse,
  History,
  LayoutDashboard,
  ListChecks,
  Radar,
  Settings,
  ShieldCheck,
  Stethoscope,
  Timer,
  TrendingUp,
  UserCog,
  Users,
  UsersRound,
} from "lucide-react";

export const APP_ROLES = ["administrator", "manager", "receptionist", "employee", "doctor", "patient"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  administrator: "Quản trị viên",
  manager: "Quản lý phòng khám",
  receptionist: "Lễ tân",
  employee: "Nhân viên",
  doctor: "Bác sĩ",
  patient: "Bệnh nhân",
};

export type NavItem = {
  title: string;
  to: string;
  icon: LucideIcon;
  roles: AppRole[];
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

const ALL: AppRole[] = ["administrator", "manager", "receptionist", "employee", "doctor", "patient"];
const STAFF: AppRole[] = ["administrator", "manager"];
const FRONT_DESK: AppRole[] = ["administrator", "manager", "receptionist"];
const CLINIC_FLOOR: AppRole[] = ["administrator", "manager", "receptionist", "doctor"];
const ADMIN: AppRole[] = ["administrator"];
const DOCTOR: AppRole[] = ["administrator", "doctor"];
const PATIENT: AppRole[] = ["administrator", "patient"];
const USERS: AppRole[] = ["patient", "employee", "doctor"];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Tổng quan",
    items: [
      { title: "Bảng điều khiển", to: "/dashboard", icon: LayoutDashboard, roles: ALL },
      { title: "Dashboard Bác sĩ", to: "/doctor/dashboard", icon: LayoutDashboard, roles: DOCTOR },
      { title: "Dashboard Quản Trị", to: "/admin/dashboard", icon: LayoutDashboard, roles: ADMIN },
      { title: "Hồ sơ bệnh nhân", to: "/patient/profile", icon: LayoutDashboard, roles: PATIENT },
    ],
  },
  {
    label: "Lịch hẹn",
    items: [
      { title: "Lịch khám", to: "/appointments/calendar", icon: CalendarDays, roles: CLINIC_FLOOR },
      { title: "Danh sách hẹn", to: "/appointments", icon: ListChecks, roles: CLINIC_FLOOR },
      { title: "Đặt hẹn khám", to: "/appointments/booking", icon: HeartPulse, roles: FRONT_DESK },
      { title: "Phòng & khung giờ", to: "/rooms", icon: DoorOpen, roles: FRONT_DESK },
      { title: "Bệnh nhân", to: "/patients", icon: UsersRound, roles: CLINIC_FLOOR },
    ],
  },
  {
    label: "Nhân sự",
    items: [
      { title: "Nhân viên", to: "/employees", icon: Users, roles: STAFF },
      { title: "Hồ sơ nhân viên", to: "/staff/profiles", icon: UserCog, roles: STAFF },
      { title: "Phòng ban", to: "/departments", icon: Building2, roles: STAFF },
      { title: "Chức danh", to: "/positions", icon: BadgeCheck, roles: STAFF },
      { title: "Ca làm việc", to: "/shifts", icon: Clock, roles: STAFF },
    ],
  },
  {
    label: "Lương & Nhân Sự",
    items: [
      { title: "Gán Công Việc", to: "/hr/assignments", icon: TrendingUp, roles: STAFF },
      { title: "Quản Lý Lương", to: "/hr/salary", icon: DollarSign, roles: STAFF },
      { title: "Tính Lương", to: "/hr/payroll", icon: Gauge, roles: STAFF },
    ],
  },
  {
    label: "Chấm công",
    items: [
      { title: "Chấm công thực tế", to: "/attendance/checkin", icon: Fingerprint, roles: ALL },
      { title: "Chấm công thủ công", to: "/attendance/manual", icon: ClipboardList, roles: STAFF },
      { title: "Chấm công theo ngày", to: "/attendance/daily", icon: CalendarRange, roles: STAFF },
      { title: "Bảng công tháng", to: "/attendance/monthly", icon: FileSpreadsheet, roles: STAFF },
      { title: "Dữ liệu máy chấm công", to: "/attendance/logs", icon: Fingerprint, roles: STAFF },
      { title: "Điều chỉnh công", to: "/attendance/adjustments", icon: ClipboardList, roles: STAFF },
      { title: "Tăng ca", to: "/attendance/overtime", icon: Timer, roles: STAFF },
    ],
  },
  {
    label: "Báo cáo",
    items: [
      { title: "Báo cáo chấm công", to: "/reports/attendance", icon: Gauge, roles: STAFF },
      { title: "Báo cáo lịch hẹn", to: "/reports/appointments", icon: Activity, roles: FRONT_DESK },
      { title: "Xuất báo cáo", to: "/reports/export", icon: FileSpreadsheet, roles: STAFF },
    ],
  },
  {
    label: "Hồ sơ của tôi",
    items: [
      { title: "Thông tin cá nhân", to: "/doctor/profile", icon: UserCog, roles: DOCTOR },
      { title: "Lịch khám", to: "/doctor/schedule", icon: CalendarDays, roles: DOCTOR },
      { title: "Lương", to: "/hr/salary", icon: DollarSign, roles: DOCTOR },
      { title: "Chấm công", to: "/attendance/daily", icon: Fingerprint, roles: DOCTOR },
    ],
  },
  {
    label: "Báo cáo & Hỗ trợ",
    items: [
      { title: "Báo cáo sự cố", to: "/issues/report", icon: Activity, roles: USERS },
      { title: "Lịch sử báo cáo", to: "/issues/my-reports", icon: History, roles: USERS },
      { title: "Quản lý báo cáo", to: "/admin/issues", icon: ListChecks, roles: ADMIN },
    ],
  },
  {
    label: "Hệ thống",
    items: [
      { title: "Thiết bị nhận dạng", to: "/biometric/devices", icon: Fingerprint, roles: STAFF },
      { title: "Máy chấm công", to: "/system/devices", icon: Stethoscope, roles: ADMIN },
      { title: "Trạng thái đồng bộ", to: "/system/sync", icon: Radar, roles: ADMIN },
      { title: "Kết nối Agent chấm công", to: "/system/agent", icon: Radar, roles: ADMIN },
      { title: "Hồ sơ phòng khám", to: "/system/clinic-profile", icon: Building2, roles: STAFF },
      { title: "Tài khoản người dùng", to: "/system/users", icon: UserCog, roles: ADMIN },
      { title: "Cài đặt hệ thống", to: "/system/settings", icon: Settings, roles: ADMIN },
      { title: "Nhật ký hoạt động", to: "/system/audit-logs", icon: History, roles: STAFF },
    ],
  },
];

export const ROLE_ICON = ShieldCheck;

export function hasAnyRole(roles: AppRole[], allowed: AppRole[]) {
  return roles.some((role) => allowed.includes(role));
}

/** Highest-privilege role first, used for display. */
export function primaryRole(roles: AppRole[]): AppRole {
  return APP_ROLES.find((role) => roles.includes(role)) ?? "employee";
}

export function visibleNavGroups(roles: AppRole[]): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => hasAnyRole(roles, item.roles)),
  })).filter((group) => group.items.length > 0);
}

export function routeRoles(pathname: string): AppRole[] | null {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.to || pathname.startsWith(`${item.to}/`)) return item.roles;
    }
  }
  return null;
}
