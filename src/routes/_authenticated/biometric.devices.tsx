import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Fingerprint,
  Camera,
  Wifi,
  WifiOff,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Clock,
  Users,
  Activity,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader, EmptyState, ErrorState, LoadingState } from "@/components/page-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/biometric/devices")({
  head: () => ({
    meta: [
      { title: "Thiết bị nhận dạng - Việt Smile Clinic Suite" },
      {
        name: "description",
        content: "Quản lý thiết bị vân tay và nhận diện khuôn mặt.",
      },
    ],
  }),
  component: BiometricDevicesPage,
});

type BiometricDevice = {
  id: string;
  device_name: string;
  device_type: "fingerprint" | "face" | "temperature";
  serial_number: string;
  location: string;
  ip_address: string | null;
  is_active: boolean;
  last_sync_time: string | null;
  sync_count: number;
  employee_count: number;
  created_at: string;
};

type NewDevice = {
  device_name: string;
  device_type: "fingerprint" | "face" | "temperature";
  serial_number: string;
  location: string;
  ip_address?: string;
};

function BiometricDevicesPage() {
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState<NewDevice>({
    device_name: "",
    device_type: "fingerprint",
    serial_number: "",
    location: "",
    ip_address: "",
  });
  const [successMessage, setSuccessMessage] = useState("");
  const queryClient = useQueryClient();

  // Fetch biometric devices
  const { data: devices, isLoading, isError, error } = useQuery({
    queryKey: ["biometric-devices"],
    queryFn: async () => {
      const { data } = await supabase
        .from("devices")
        .select("*")
        .order("created_at", { ascending: false });

      return (data as unknown as BiometricDevice[]) || [];
    },
    refetchInterval: 30000, // Real-time refresh every 30 seconds
  });

  // Fetch device statistics
  const { data: stats } = useQuery({
    queryKey: ["device-stats"],
    queryFn: async () => {
      if (!devices) return null;

      const activeCount = devices.filter((d) => d.is_active).length;
      const totalSyncs = devices.reduce((sum, d) => sum + (d.sync_count || 0), 0);
      const totalEmployees = devices.reduce(
        (sum, d) => sum + (d.employee_count || 0),
        0
      );

      return {
        total: devices.length,
        active: activeCount,
        inactive: devices.length - activeCount,
        totalSyncs,
        totalEmployees,
      };
    },
    enabled: !!devices,
  });

  const createDeviceMutation = useMutation({
    mutationFn: async (data: NewDevice) => {
      if (!formData.device_name) throw new Error("Vui lòng nhập tên thiết bị");
      if (!formData.serial_number)
        throw new Error("Vui lòng nhập số seri thiết bị");

      const { error } = await supabase.from("devices").insert([
        {
          device_name: formData.device_name,
          device_type: formData.device_type,
          serial_number: formData.serial_number,
          location: formData.location,
          ip_address: formData.ip_address ?? null,
          is_active: true,
        },
      ]);

      if (error) throw error;
    },
    onSuccess: () => {
      setSuccessMessage("Đã thêm thiết bị thành công");
      queryClient.invalidateQueries({ queryKey: ["biometric-devices"] });
      setOpenDialog(false);
      setFormData({
        device_name: "",
        device_type: "fingerprint",
        serial_number: "",
        location: "",
        ip_address: "",
      });
      setTimeout(() => setSuccessMessage(""), 3000);
    },
    onError: (err) => {
      console.error("[v0] Error:", err);
    },
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const { error } = await supabase.from("devices").delete().eq("id", deviceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["biometric-devices"] });
      setSuccessMessage("Đã xóa thiết bị");
      setTimeout(() => setSuccessMessage(""), 3000);
    },
  });

  const toggleDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const device = devices?.find((d) => d.id === deviceId);
      const { error } = await supabase
        .from("devices")
        .update({ is_active: !device?.is_active })
        .eq("id", deviceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["biometric-devices"] });
    },
  });

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case "fingerprint":
        return <Fingerprint className="size-5" />;
      case "face":
        return <Camera className="size-5" />;
      default:
        return <Activity className="size-5" />;
    }
  };

  const getDeviceLabel = (type: string) => {
    switch (type) {
      case "fingerprint":
        return "Vân tay";
      case "face":
        return "Khuôn mặt";
      case "temperature":
        return "Đo nhiệt độ";
      default:
        return type;
    }
  };

  return (
    <div>
      <PageHeader
        title="Thiết bị nhận dạng sinh trắc"
        description="Quản lý các thiết bị vân tay, khuôn mặt và cảm biến khác."
      />

      {successMessage && (
        <Card className="surface-card mb-6 border-l-4 border-l-green-500 bg-green-50 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 text-green-600" />
            <p className="text-green-800">{successMessage}</p>
          </div>
        </Card>
      )}

      {/* Statistics Cards */}
      {stats && (
        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard icon={<Activity className="size-5" />} label="Tổng thiết bị" value={stats.total} />
          <StatCard
            icon={<Wifi className="size-5 text-green-600" />}
            label="Đang hoạt động"
            value={stats.active}
          />
          <StatCard
            icon={<WifiOff className="size-5 text-red-600" />}
            label="Tạm dừng"
            value={stats.inactive}
          />
          <StatCard
            icon={<Clock className="size-5 text-blue-600" />}
            label="Lần đồng bộ"
            value={stats.totalSyncs}
          />
          <StatCard
            icon={<Users className="size-5 text-purple-600" />}
            label="Nhân viên"
            value={stats.totalEmployees}
          />
        </section>
      )}

      {/* Toolbar */}
      <div className="mb-6 flex justify-between">
        <h3 className="text-lg font-semibold">Danh sách thiết bị</h3>

        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              Thêm thiết bị
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Thêm thiết bị nhận dạng</DialogTitle>
              <DialogDescription>
                Đăng ký thiết bị vân tay, khuôn mặt hoặc cảm biến mới.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Tên thiết bị *</label>
                <Input
                  placeholder="Ví dụ: Máy vân tay tầng 1"
                  value={formData.device_name}
                  onChange={(e) =>
                    setFormData({ ...formData, device_name: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Loại thiết bị *</label>
                <select
                  value={formData.device_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      device_type: e.target.value as any,
                    })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="fingerprint">Vân tay</option>
                  <option value="face">Khuôn mặt</option>
                  <option value="temperature">Đo nhiệt độ</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Số seri *</label>
                <Input
                  placeholder="Nhập số seri thiết bị"
                  value={formData.serial_number}
                  onChange={(e) =>
                    setFormData({ ...formData, serial_number: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Vị trí</label>
                <Input
                  placeholder="Ví dụ: Phòng lễ tân, Phòng khám 1"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Địa chỉ IP</label>
                <Input
                  placeholder="192.168.1.100 (tùy chọn)"
                  value={formData.ip_address}
                  onChange={(e) =>
                    setFormData({ ...formData, ip_address: e.target.value })
                  }
                />
              </div>

              <Button
                onClick={() => createDeviceMutation.mutate(formData)}
                disabled={createDeviceMutation.isPending}
                className="w-full"
              >
                {createDeviceMutation.isPending ? "Đang lưu..." : "Lưu"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Devices Grid */}
      {isLoading ? (
        <LoadingState rows={4} />
      ) : isError ? (
        <ErrorState description={(error as Error).message} />
      ) : !devices || devices.length === 0 ? (
        <EmptyState
          title="Chưa có thiết bị"
          description="Hãy thêm thiết bị nhận dạng sinh trắc đầu tiên."
        />
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden sm:block">
            <div className="surface-card overflow-x-auto rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên thiết bị</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Số seri</TableHead>
                    <TableHead>Vị trí</TableHead>
                    <TableHead>Địa chỉ IP</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Lần đồng bộ</TableHead>
                    <TableHead>Cập nhật lần cuối</TableHead>
                    <TableHead>Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {getDeviceIcon(device.device_type)}
                          {device.device_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getDeviceLabel(device.device_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {device.serial_number}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="size-3.5" />
                          {device.location}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {device.ip_address || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            device.is_active
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }
                        >
                          {device.is_active ? "Hoạt động" : "Tạm dừng"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="size-3.5" />
                          {device.sync_count || 0}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {device.last_sync_time
                          ? new Date(device.last_sync_time).toLocaleString("vi-VN")
                          : "Chưa đồng bộ"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleDeviceMutation.mutate(device.id)}
                            disabled={toggleDeviceMutation.isPending}
                            title={
                              device.is_active
                                ? "Tạm dừng thiết bị"
                                : "Kích hoạt thiết bị"
                            }
                          >
                            {device.is_active ? (
                              <Wifi className="size-4" />
                            ) : (
                              <WifiOff className="size-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              deleteDeviceMutation.mutate(device.id)
                            }
                            disabled={deleteDeviceMutation.isPending}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="space-y-4 sm:hidden">
            {devices.map((device) => (
              <Card key={device.id} className="surface-card p-4">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getDeviceIcon(device.device_type)}
                    <div>
                      <h4 className="font-semibold">{device.device_name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {device.serial_number}
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={
                      device.is_active
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }
                  >
                    {device.is_active ? "Hoạt động" : "Tạm dừng"}
                  </Badge>
                </div>

                <div className="mb-3 space-y-2 text-sm">
                  <p>
                    <strong>Vị trí:</strong> {device.location}
                  </p>
                  <p>
                    <strong>IP:</strong> {device.ip_address || "—"}
                  </p>
                  <p>
                    <strong>Loại:</strong> {getDeviceLabel(device.device_type)}
                  </p>
                  <p>
                    <strong>Lần đồng bộ:</strong> {device.sync_count || 0}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleDeviceMutation.mutate(device.id)}
                    className="flex-1"
                  >
                    {device.is_active ? "Tạm dừng" : "Kích hoạt"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteDeviceMutation.mutate(device.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Real-time Status */}
      <Card className="surface-card mt-6 border-l-4 border-l-blue-500 bg-blue-50 p-4">
        <div className="flex gap-3">
          <Activity className="size-5 flex-shrink-0 text-blue-600" />
          <div>
            <p className="font-medium text-blue-900">Trạng thái thực tế:</p>
            <p className="mt-1 text-sm text-blue-800">
              Trang này được cập nhật tự động mỗi 30 giây. Tất cả các thiết bị đang kết nối và hoạt động sẽ hiển thị trạng thái "Hoạt động".
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card className="surface-card flex items-center justify-between p-4">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </div>
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
    </Card>
  );
}
