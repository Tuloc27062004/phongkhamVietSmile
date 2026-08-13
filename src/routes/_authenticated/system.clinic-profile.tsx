import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuthSession, useSessionProfile } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/system/clinic-profile")({
  head: () => ({
    meta: [
      { title: "Hồ sơ phòng khám — Việt Smile Clinic Suite" },
      {
        name: "description",
        content: "Cấu hình thông tin phòng khám: tên, địa chỉ, liên hệ, giờ làm việc và chính sách.",
      },
      { property: "og:title", content: "Hồ sơ phòng khám — Việt Smile Clinic Suite" },
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
    ["name", "Tên phòng khám"],
    ["short_name", "Tên rút gọn"],
    ["legal_name", "Tên pháp lý"],
    ["tax_code", "Mã số thuế"],
    ["representative_name", "Người đại diện"],
    ["manager_name", "Quản lý phòng khám"],
    ["logo_url", "Logo (URL)"],
    ["cover_url", "Ảnh bìa (URL)"],
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

function ClinicProfilePage() {
  const queryClient = useQueryClient();
  const { session } = useAuthSession();
  const profileQuery = useSessionProfile(session?.user.id);
  const canEdit = profileQuery.data?.roles.includes("administrator") ?? false;

  const clinicQuery = useQuery({
    queryKey: ["clinic-profile-full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clinic_profiles").select("*").maybeSingle();
      if (error) throw error;
      return data;
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
      const clinic = clinicQuery.data;
      if (!clinic) throw new Error("Chưa có hồ sơ phòng khám");
      const payload = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, value === undefined ? null : value]),
      ) as TablesUpdate<"clinic_profiles">;
      const { error } = await supabase.from("clinic_profiles").update(payload).eq("id", clinic.id);
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        organization_id: clinic.organization_id,
        user_id: session?.user.id ?? null,
        actor_name: profileQuery.data?.fullName ?? null,
        action: "clinic_profile.updated",
        entity_type: "clinic_profiles",
        entity_id: clinic.id,
        new_values: values,
        user_agent: typeof navigator === "undefined" ? null : navigator.userAgent,
      });
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
            </TabsList>

            {(["identity", "contact", "operations"] as const).map((group) => (
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
