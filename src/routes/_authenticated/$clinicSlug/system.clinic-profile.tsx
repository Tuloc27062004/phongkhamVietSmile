import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckCircle2,
  ImageIcon,
  Loader2,
  Lock,
  MessageCircle,
  Save,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { getZaloConfigStatus, saveZaloConfig } from "@/lib/zalo-config.functions";

export const Route = createFileRoute("/_authenticated/$clinicSlug/system/clinic-profile")({
  head: () => ({
    meta: [
      { title: "Hồ sơ phòng khám — GZV Clinic Platform" },
      {
        name: "description",
        content: "Cấu hình thông tin phòng khám: tên, địa chỉ, liên hệ, giờ làm việc và chính sách.",
      },
      { property: "og:title", content: "Hồ sơ phòng khám — GZV Clinic Platform" },
      { property: "og:description", content: "Cấu hình thông tin và nhận diện phòng khám." },
    ],
  }),
  component: ClinicProfilePage,
});

const schema = z.object({
  name: z.string().min(2, "Tên phòng khám bắt buộc"),
  short_name: z.string().optional(),
  legal_name: z.string().optional(),
  logo_url: z.string().url("URL không hợp lệ").or(z.literal("")).optional(),
  favicon_url: z.string().url("URL không hợp lệ").or(z.literal("")).optional(),
  cover_url: z.string().url("URL không hợp lệ").or(z.literal("")).optional(),
  address: z.string().optional(),
  ward: z.string().optional(),
  district: z.string().optional(),
  city: z.string().optional(),
  maps_url: z.string().optional(),
  phone: z.string().optional(),
  hotline: z.string().optional(),
  appointment_phone: z.string().optional(),
  email: z.string().email("Email không hợp lệ").or(z.literal("")).optional(),
  website: z.string().optional(),
  facebook: z.string().optional(),
  zalo: z.string().optional(),
  working_hours: z.string().optional(),
  lunch_break: z.string().optional(),
  weekly_days_off: z.string().optional(),
  tax_code: z.string().optional(),
  representative_name: z.string().optional(),
  manager_name: z.string().optional(),
  timezone: z.string().optional(),
  language: z.string().optional(),
  date_format: z.string().optional(),
  time_format: z.string().optional(),
  grace_period_minutes: z.coerce.number().int().min(0).max(120),
  reminder_policy: z.string().optional(),
  attendance_policy: z.string().optional(),
  overtime_policy: z.string().optional(),
  description: z.string().optional(),
  footer_info: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const TEXT_FIELDS: Record<string, [keyof FormValues, string][]> = {
  identity: [
    ["short_name", "Tên rút gọn"],
    ["legal_name", "Tên pháp lý"],
    ["tax_code", "Mã số thuế"],
    ["representative_name", "Người đại diện"],
    ["manager_name", "Quản lý phòng khám"],
  ],
  contact: [
    ["address", "Địa chỉ"],
    ["ward", "Phường/Xã"],
    ["district", "Quận/Huyện"],
    ["city", "Tỉnh/Thành phố"],
    ["maps_url", "Google Maps"],
    ["phone", "Điện thoại chính"],
    ["hotline", "Hotline"],
    ["appointment_phone", "Số đặt lịch"],
    ["email", "Email"],
    ["website", "Website"],
    ["facebook", "Facebook"],
    ["zalo", "Zalo"],
  ],
  operations: [
    ["working_hours", "Giờ làm việc"],
    ["lunch_break", "Giờ nghỉ trưa"],
    ["weekly_days_off", "Ngày nghỉ trong tuần"],
    ["timezone", "Múi giờ"],
    ["language", "Ngôn ngữ"],
    ["date_format", "Định dạng ngày"],
    ["time_format", "Định dạng giờ"],
  ],
};

function AssetUploadField({
  label,
  hint,
  value,
  organizationId,
  assetKind,
  disabled,
  onUploaded,
  wide,
}: {
  label: string;
  hint: string;
  value: string;
  organizationId: string;
  assetKind: "logo" | "favicon" | "cover";
  disabled: boolean;
  onUploaded: (url: string) => void;
  wide?: boolean;
}) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Chỉ chấp nhận file ảnh (PNG, JPG, SVG...)");
      return;
    }
    const maxSizeMb = assetKind === "favicon" ? 1 : 4;
    if (file.size > maxSizeMb * 1024 * 1024) {
      toast.error(`Dung lượng ảnh tối đa ${maxSizeMb}MB`);
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${organizationId}/${assetKind}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("clinic-assets")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("clinic-assets").getPublicUrl(path);
      onUploaded(data.publicUrl);
      toast.success("Đã tải ảnh lên");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div
          className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/40 ${
            wide ? "h-16 w-28" : "size-16"
          }`}
        >
          {value ? (
            <img src={value} alt={label} className="size-full object-contain" />
          ) : (
            <ImageIcon className="size-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <label
            className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent ${
              disabled || uploading ? "pointer-events-none opacity-50" : ""
            }`}
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {uploading ? "Đang tải lên..." : value ? "Đổi ảnh" : "Tải ảnh lên"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={disabled || uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.target.value = "";
              }}
            />
          </label>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
    </div>
  );
}

function ClinicProfilePage() {
  const queryClient = useQueryClient();
  const { org, profile, isSuperAdmin } = Route.useRouteContext();
  const canEdit = profile.roles.includes("administrator");
  const canRename = isSuperAdmin;
  const orgId = org.id;

  const clinicQuery = useQuery({
    queryKey: ["clinic-profile-full", orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clinic_profiles")
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();

      if (data) return data;

      return {
        id: null,
        organization_id: orgId,
        name: org.name,
        short_name: org.name,
      };
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", grace_period_minutes: 5 },
  });

  useEffect(() => {
    if (!clinicQuery.data) return;
    const record = clinicQuery.data as Record<string, unknown>;
    const values = {} as Record<string, unknown>;
    for (const key of Object.keys(schema.shape)) {
      values[key] = record[key] ?? (key === "grace_period_minutes" ? 0 : "");
    }
    form.reset(values as FormValues);
  }, [clinicQuery.data, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, value === undefined ? null : value]),
      ) as TablesUpdate<"clinic_profiles">;

      const { data: existing } = await supabase
        .from("clinic_profiles")
        .select("id")
        .eq("organization_id", orgId)
        .maybeSingle();

      if (existing?.id) {
        if (!canRename) delete (payload as Record<string, unknown>)["name"];
        const { error } = await supabase.from("clinic_profiles").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const insertPayload: TablesInsert<"clinic_profiles"> = {
          ...payload,
          organization_id: orgId,
          name: values.name,
        };
        const { error } = await supabase.from("clinic_profiles").insert(insertPayload);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Đã lưu hồ sơ phòng khám");
      await queryClient.invalidateQueries({ queryKey: ["clinic-profile-full"] });
      await queryClient.invalidateQueries({ queryKey: ["clinic-profile"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (clinicQuery.isLoading) return <LoadingState rows={4} />;
  if (clinicQuery.isError) return <ErrorState description={(clinicQuery.error as Error).message} />;

  const values = form.watch();

  return (
    <div>
      <PageHeader
        title="Hồ sơ phòng khám"
        description="Thông tin này được dùng trên toàn hệ thống, báo cáo và file Excel xuất ra."
        actions={
          <Button
            onClick={form.handleSubmit((data) => mutation.mutate(data))}
            disabled={!canEdit || mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Lưu thay đổi
          </Button>
        }
      />

      {!canEdit && (
        <p className="mb-4 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          Bạn chỉ có quyền xem. Chỉ quản trị viên mới được chỉnh sửa hồ sơ phòng khám.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form className="surface-card p-6" onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
          <Tabs defaultValue="identity">
            <TabsList className="flex flex-wrap">
              <TabsTrigger value="identity">Nhận diện</TabsTrigger>
              <TabsTrigger value="contact">Liên hệ</TabsTrigger>
              <TabsTrigger value="operations">Vận hành</TabsTrigger>
              <TabsTrigger value="policy">Chính sách</TabsTrigger>
              <TabsTrigger value="zalo">Tích hợp Zalo</TabsTrigger>
            </TabsList>

            <TabsContent value="identity" className="mt-6 space-y-6">
              <div className="space-y-2 rounded-lg border border-border/70 p-4">
                <Label htmlFor="name" className="flex items-center gap-1.5">
                  Tên phòng khám
                  {!canRename && <Lock className="size-3.5 text-muted-foreground" />}
                </Label>
                <Input id="name" disabled={!canRename} {...form.register("name")} />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  {canRename ? (
                    <>
                      <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      Bạn đang ở quyền Quản trị viên nền tảng GZV nên có thể đổi tên phòng khám này.
                    </>
                  ) : (
                    <>
                      <Lock className="mt-0.5 size-3.5 shrink-0" />
                      Tên phòng khám ảnh hưởng đến đường dẫn (URL) truy cập toàn hệ thống — chỉ Quản trị
                      viên nền tảng GZV mới đổi được, kể cả quản trị viên của phòng khám cũng không thể tự
                      đổi. Liên hệ đội ngũ GZV nếu cần đổi tên.
                    </>
                  )}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <AssetUploadField
                  label="Logo (hiển thị ở sidebar & header)"
                  hint="Ảnh vuông, nền trong suốt, tối đa 4MB. Thay thế icon mẫu mặc định."
                  value={values.logo_url || ""}
                  organizationId={orgId}
                  assetKind="logo"
                  disabled={!canEdit}
                  onUploaded={(url) => form.setValue("logo_url", url, { shouldDirty: true })}
                />
                <AssetUploadField
                  label="Favicon (icon tab trình duyệt)"
                  hint="Ảnh vuông nhỏ (ví dụ 64x64px), tối đa 1MB."
                  value={values.favicon_url || ""}
                  organizationId={orgId}
                  assetKind="favicon"
                  disabled={!canEdit}
                  onUploaded={(url) => form.setValue("favicon_url", url, { shouldDirty: true })}
                />
                <AssetUploadField
                  label="Ảnh bìa"
                  hint="Ảnh ngang, tối đa 4MB. Dùng cho trang giới thiệu/hồ sơ công khai."
                  value={values.cover_url || ""}
                  organizationId={orgId}
                  assetKind="cover"
                  disabled={!canEdit}
                  onUploaded={(url) => form.setValue("cover_url", url, { shouldDirty: true })}
                  wide
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {TEXT_FIELDS["identity"]?.map(([field, label]) => (
                  <div key={field} className="space-y-2">
                    <Label htmlFor={field}>{label}</Label>
                    <Input id={field} disabled={!canEdit} {...form.register(field)} />
                    {form.formState.errors[field] && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors[field]?.message as string}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            {(["contact", "operations"] as const).map((group) => (
              <TabsContent key={group} value={group} className="mt-6 grid gap-4 md:grid-cols-2">
                {TEXT_FIELDS[group]?.map(([field, label]) => (
                  <div key={field} className="space-y-2">
                    <Label htmlFor={field}>{label}</Label>
                    <Input id={field} disabled={!canEdit} {...form.register(field)} />
                    {form.formState.errors[field] && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors[field]?.message as string}
                      </p>
                    )}
                  </div>
                ))}
              </TabsContent>
            ))}

            <TabsContent value="policy" className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="grace_period_minutes">Thời gian ân hạn đi trễ (phút)</Label>
                <Input
                  id="grace_period_minutes"
                  type="number"
                  disabled={!canEdit}
                  {...form.register("grace_period_minutes")}
                />
              </div>
              {(
                [
                  ["attendance_policy", "Chính sách chấm công"],
                  ["overtime_policy", "Chính sách tăng ca"],
                  ["reminder_policy", "Chính sách nhắc lịch hẹn"],
                  ["description", "Giới thiệu phòng khám"],
                  ["footer_info", "Thông tin chân trang"],
                ] as const
              ).map(([field, label]) => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={field}>{label}</Label>
                  <Textarea id={field} rows={3} disabled={!canEdit} {...form.register(field)} />
                </div>
              ))}
            </TabsContent>

            <TabsContent value="zalo" className="mt-6">
              <ZaloIntegrationTab canEdit={canEdit} />
            </TabsContent>
          </Tabs>
        </form>

        <aside className="surface-card h-fit overflow-hidden">
          <div className="brand-gradient flex items-center gap-3 p-6">
            <div className="flex size-12 items-center justify-center rounded-xl bg-card/20">
              {values.logo_url ? (
                <img src={values.logo_url} alt="Logo" className="size-12 rounded-xl object-cover" />
              ) : (
                <Sparkles className="size-5 text-primary-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-primary-foreground">
                {values.short_name || values.name || "Tên phòng khám"}
              </p>
              <p className="truncate text-xs text-primary-foreground/80">
                {values.working_hours || "Giờ làm việc"}
              </p>
            </div>
          </div>
          <div className="space-y-2 p-6 text-sm">
            <p className="font-medium">{values.name}</p>
            <p className="text-muted-foreground">
              {[values.address, values.ward, values.district, values.city].filter(Boolean).join(", ")}
            </p>
            <p className="text-muted-foreground">Hotline: {values.hotline || "—"}</p>
            <p className="text-muted-foreground">Email: {values.email || "—"}</p>
            <p className="pt-3 text-xs text-muted-foreground">{values.footer_info}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ZaloIntegrationTab({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const getStatus = useServerFn(getZaloConfigStatus);
  const save = useServerFn(saveZaloConfig);

  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [touched, setTouched] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["zalo-config-status"],
    queryFn: () => getStatus(),
  });

  useEffect(() => {
    if (!statusQuery.data || touched) return;
    setAppId(statusQuery.data.appId);
    setIsEnabled(statusQuery.data.isEnabled);
  }, [statusQuery.data, touched]);

  const saveMutation = useMutation({
    mutationFn: () => save({ data: { appId, appSecret: appSecret || undefined, isEnabled } }),
    onSuccess: () => {
      toast.success("Đã lưu cấu hình Zalo");
      setAppSecret("");
      setTouched(false);
      void queryClient.invalidateQueries({ queryKey: ["zalo-config-status"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (statusQuery.isLoading) return <LoadingState rows={3} />;
  if (statusQuery.isError) return <ErrorState description={(statusQuery.error as Error).message} />;

  return (
    <div className="space-y-4">
      <Card className="quiet-card min-w-0 border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        <p className="flex items-center gap-1.5 font-medium">
          <MessageCircle className="size-4" />
          Giai đoạn 1: lưu trữ an toàn App ID/Secret cho từng phòng khám
        </p>
        <p className="mt-1 text-xs text-sky-800">
          App Secret được mã hoá (AES-256-GCM) trước khi lưu, không hiển thị lại sau khi lưu và chỉ đọc được
          từ phía server. Luồng đăng nhập/đặt lịch qua Zalo cho bệnh nhân và gửi thông báo (Zalo ZNS) là một
          hạng mục lớn riêng (cần liên kết danh tính bệnh nhân, route công khai, xác thực OAuth2) — sẽ được
          triển khai ở các giai đoạn tiếp theo, chưa hoạt động ở bản này.
        </p>
      </Card>

      {!canEdit && (
        <Card className="quiet-card min-w-0 border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Chỉ quản trị viên mới có thể cấu hình tích hợp Zalo.
        </Card>
      )}

      <Card className="quiet-card min-w-0 space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Trạng thái</h3>
            <p className="text-xs text-muted-foreground">
              {statusQuery.data?.hasSecret ? "Đã cấu hình App Secret" : "Chưa cấu hình App Secret"}
              {statusQuery.data?.updatedAt &&
                ` · Cập nhật lần cuối ${new Date(statusQuery.data.updatedAt).toLocaleString("vi-VN")}`}
            </p>
          </div>
          {statusQuery.data?.hasSecret && (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle2 className="mr-1 size-3.5" />
              Đã lưu
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-sm font-normal">Bật tích hợp Zalo cho phòng khám này</Label>
          <Switch
            disabled={!canEdit}
            checked={isEnabled}
            onCheckedChange={(checked) => {
              setIsEnabled(checked);
              setTouched(true);
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Zalo App ID</Label>
          <Input
            disabled={!canEdit}
            value={appId}
            onChange={(event) => {
              setAppId(event.target.value);
              setTouched(true);
            }}
            placeholder="Lấy từ Zalo Developers — Ứng dụng của bạn"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Zalo App Secret</Label>
          <Input
            type="password"
            disabled={!canEdit}
            value={appSecret}
            onChange={(event) => {
              setAppSecret(event.target.value);
              setTouched(true);
            }}
            placeholder={statusQuery.data?.hasSecret ? "•••••••• (giữ nguyên nếu để trống)" : "Nhập App Secret"}
          />
          <p className="text-xs text-muted-foreground">
            Vì lý do bảo mật, App Secret đã lưu sẽ không hiển thị lại. Để trống nếu không muốn đổi.
          </p>
        </div>

        {canEdit && (
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !appId.trim()}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Lưu cấu hình Zalo
          </Button>
        )}
      </Card>
    </div>
  );
}
