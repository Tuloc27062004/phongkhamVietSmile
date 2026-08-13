import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle,
  Edit2,
  Filter,
  Plus,
  Power,
  Search,
  Server,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/system/devices")({
  head: () => ({
    meta: [
      { title: "Máy chấm công — Việt Smile Clinic Suite" },
      {
        name: "description",
        content: "Quản lý các máy chấm công kết nối với hệ thống.",
      },
      {
        property: "og:title",
        content: "Máy chấm công — Việt Smile Clinic Suite",
      },
    ],
  }),
  component: SystemDevicesPage,
});

type Device = {
  id: string;
  device_name: string;
  serial_number: string;
  device_type: string;
  status: "online" | "offline" | "error";
  last_sync: string | null;
  ip_address: string | null;
  location: string | null;
  users_synced: number;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  online: {
    label: "Online",
    color: "bg-green-100 text-green-800",
    icon: <Wifi className="size-4" />,
  },
  offline: {
    label: "Ngoại tuyến",
    color: "bg-gray-100 text-gray-800",
    icon: <WifiOff className="size-4" />,
  },
  error: {
    label: "Lỗi",
    color: "bg-red-100 text-red-800",
    icon: <AlertTriangle className="size-4" />,
  },
};

function SystemDevicesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const devices = useQuery({
    queryKey: ["devices", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("devices")
        .select(
          "id, device_name, serial_number, device_type, status, last_sync, ip_address, location, users_synced",
        )
        .order("device_name");

      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as Device[]) || [];
    },
  });

  const stats = useQuery({
    queryKey: ["devices-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("devices").select("status", { count: "exact" });

      if (error) throw error;

      const records = (data as Array<{ status: string }>) || [];
      return {
        total: records.length,
        online: records.filter((r) => r.status === "online").length,
        offline: records.filter((r) => r.status === "offline").length,
        error: records.filter((r) => r.status === "error").length,
      };
    },
  });

  const filtered = (devices.data ?? []).filter((record) => {
    const term = search.trim().toLowerCase();
    return (
      !term ||
      record.device_name.toLowerCase().includes(term) ||
      record.serial_number.toLowerCase().includes(term)
    );
  });

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isOnline = (lastSync: string | null) => {
    if (!lastSync) return false;
    const diff = Date.now() - new Date(lastSync).getTime();
    return diff < 5 * 60 * 1000; // 5 minutes
  };

  return (
    <div>
      <PageHeader
        title="Máy chấm công"
        description="Quản lý các máy chấm công, giám sát trạng thái kết nối và đồng bộ dữ liệu."
        actions={
          <Button>
            <Plus className="mr-2 size-4" />
            Thêm thiết bị
          </Button>
        }
      />

      {/* Stats */}
      {stats.isLoading ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="surface-card h-20 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : stats.data ? (
        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<Server className="size-5" />} label="Tổng thiết bị" value={stats.data.total} />
          <StatCard
            icon={<Wifi className="size-5 text-green-600" />}
            label="Online"
            value={stats.data.online}
            color="green"
          />
          <StatCard
            icon={<WifiOff className="size-5 text-gray-600" />}
            label="Ngoại tuyến"
            value={stats.data.offline}
            color="gray"
          />
          <StatCard
            icon={<AlertTriangle className="size-5 text-red-600" />}
            label="Lỗi"
            value={stats.data.error}
            color="red"
          />
        </section>
      ) : null}

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium">Tìm kiếm</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên hoặc serial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium">Lọc trạng thái</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <Filter className="mr-2 size-4" />
              <SelectValue placeholder="Tất cả trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tất cả trạng thái</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Ngoại tuyến</SelectItem>
              <SelectItem value="error">Lỗi</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Devices Grid */}
      {devices.isLoading ? (
        <LoadingState rows={4} />
      ) : devices.isError ? (
        <ErrorState description={(devices.error as Error).message} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Không có thiết bị"
          description="Chưa có máy chấm công được kết nối. Thêm thiết bị để bắt đầu."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((device) => (
            <Card key={device.id} className="surface-card border-l-4 border-l-blue-500 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-lg bg-blue-50">
                      <Server className="size-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold">{device.device_name}</p>
                      <p className="text-sm text-muted-foreground">Serial: {device.serial_number}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Loại</p>
                    <p className="mt-1 text-sm font-medium">{device.device_type}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">IP</p>
                    <p className="mt-1 font-mono text-sm">{device.ip_address || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Vị trí</p>
                    <p className="mt-1 text-sm">{device.location || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Đồng bộ lần cuối</p>
                    <p className="mt-1 text-xs">{formatDate(device.last_sync)}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Badge className={STATUS_CONFIG[device.status]?.color}>
                      {STATUS_CONFIG[device.status]?.icon}
                      <span className="ml-1">{STATUS_CONFIG[device.status]?.label}</span>
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {device.users_synced} người
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline">
                    <Edit2 className="size-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600">
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color = "blue",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color?: "blue" | "green" | "gray" | "red";
}) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    gray: "bg-gray-50 text-gray-600",
    red: "bg-red-50 text-red-600",
  };

  return (
    <Card className="surface-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
        </div>
        <div className={`flex size-10 items-center justify-center rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}
