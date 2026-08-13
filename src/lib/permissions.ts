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
      { title: "Dashboard Quản Trị Trung Tâm", to: "/admin/dashboard", icon: LayoutDashboard, roles: ADMIN },
      { title: "Bàn làm việc Bác sĩ", to: "/doctor/dashboard", icon: LayoutDashboard, roles: DOCTOR },
    ],
  },
  {
    label: "Khám bệnh & Lịch hẹn",
    items: [
      { title: "Lịch khám bệnh", to: "/appointments/calendar", icon: CalendarDays, roles: CLINIC_FLOOR },
      { title: "Danh sách hồ sơ hẹn", to: "/appointments", icon: ListChecks, roles: CLINIC_FLOOR },
      { title: "Đặt lịch khám mới", to: "/appointments/booking", icon: HeartPulse, roles: FRONT_DESK },
      { title: "Quản lý Bệnh nhân", to: "/patients", icon: UsersRound, roles: CLINIC_FLOOR },
      { title: "Phòng khám & Khung giờ", to: "/rooms", icon: DoorOpen, roles: FRONT_DESK },
    ],
  },
  {
    label: "Quản lý Nhân sự & Ca làm",
    items: [
      { title: "Danh sách Y Bác sĩ & Nhân sự", to: "/employees", icon: Users, roles: STAFF },
      { title: "Phòng ban & Khoa", to: "/departments", icon: Building2, roles: STAFF },
      { title: "Chức danh & Học vị", to: "/positions", icon: BadgeCheck, roles: STAFF },
      { title: "Ca làm việc", to: "/shifts", icon: Clock, roles: STAFF },
      { title: "Phân công công việc", to: "/hr/assignments", icon: TrendingUp, roles: STAFF },
      { title: "Quản lý Lương & Payroll", to: "/hr/payroll", icon: DollarSign, roles: STAFF },
    ],
  },
  {
    label: "Quản lý Chấm công & Vân tay",
    items: [
      { title: "Chấm công thực tế", to: "/attendance/checkin", icon: Fingerprint, roles: ALL },
      { title: "Chấm công thủ công", to: "/attendance/manual", icon: ClipboardList, roles: STAFF },
      { title: "Bảng công tổng hợp tháng", to: "/attendance/monthly", icon: FileSpreadsheet, roles: STAFF },
      { title: "Nhật ký máy vân tay", to: "/attendance/logs", icon: Fingerprint, roles: STAFF },
      { title: "Điều chỉnh công & Tăng ca", to: "/attendance/adjustments", icon: Timer, roles: STAFF },
    ],
  },
  {
    label: "Báo cáo & Xuất dữ liệu",
    items: [
      { title: "Báo cáo chấm công", to: "/reports/attendance", icon: Gauge, roles: STAFF },
      { title: "Báo cáo khám bệnh", to: "/reports/appointments", icon: Activity, roles: FRONT_DESK },
      { title: "Xuất dữ liệu Excel", to: "/reports/export", icon: FileSpreadsheet, roles: STAFF },
    ],
  },
  {
    label: "Quản trị Hệ thống GZV",
    items: [
      { title: "Thiết bị nhận dạng & Máy vân tay", to: "/biometric/devices", icon: Fingerprint, roles: STAFF },
      { title: "Kết nối Agent Windows", to: "/system/agent", icon: Radar, roles: ADMIN },
      { title: "Hồ sơ phòng khám", to: "/system/clinic-profile", icon: Building2, roles: STAFF },
      { title: "Tài khoản & Cấp quyền", to: "/system/users", icon: UserCog, roles: ADMIN },
      { title: "Cài đặt & Audit Logs", to: "/system/settings", icon: Settings, roles: ADMIN },
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
