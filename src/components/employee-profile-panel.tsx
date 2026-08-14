import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Briefcase, Mail, Phone, Save, Star, X } from "lucide-react";
import { toast } from "sonner";

import { AvatarUploadField } from "@/components/avatar-upload-field";
import { EmptyState, ErrorState, LoadingState } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";

type EmployeeProfileRecord = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  profile_photo_url: string | null;
  professional_title: string | null;
  specialization: string | null;
  license_number: string | null;
  years_of_experience: number | null;
  qualifications: string | null;
  employment_status: string;
  start_date: string | null;
  departments: { name: string } | null;
  positions: { name: string } | null;
};

type EditableDraft = {
  phone?: string;
  professional_title?: string;
  specialization?: string;
  license_number?: string;
  years_of_experience?: number;
  qualifications?: string;
  avatar_url?: string;
};

/** Read-only or editable employee profile content — embed inside a Dialog (team roster) or a full page (own profile). */
export function EmployeeProfilePanel({
  employeeId,
  organizationId,
  editable,
}: {
  employeeId: string;
  organizationId: string;
  editable: boolean;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditableDraft>({});

  const query = useQuery({
    queryKey: ["employee-profile-panel", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select(
          "id, full_name, email, phone, avatar_url, profile_photo_url, professional_title, specialization, license_number, years_of_experience, qualifications, employment_status, start_date, departments(name), positions(name)",
        )
        .eq("id", employeeId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as EmployeeProfileRecord | null;
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: EditableDraft) => {
      const payload: TablesUpdate<"employees"> = {};
      if ("phone" in values) payload.phone = values.phone || null;
      if ("professional_title" in values) payload.professional_title = values.professional_title || null;
      if ("specialization" in values) payload.specialization = values.specialization || null;
      if ("license_number" in values) payload.license_number = values.license_number || null;
      if ("qualifications" in values) payload.qualifications = values.qualifications || null;
      if ("years_of_experience" in values) payload.years_of_experience = values.years_of_experience ?? null;
      if (values.avatar_url !== undefined) {
        payload.avatar_url = values.avatar_url;
        payload.profile_photo_url = values.avatar_url;
      }
      const { error } = await supabase.from("employees").update(payload).eq("id", employeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã lưu hồ sơ");
      setEditing(false);
      setDraft({});
      void queryClient.invalidateQueries({ queryKey: ["employee-profile-panel", employeeId] });
      void queryClient.invalidateQueries({ queryKey: ["clinic-team-roster"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (query.isLoading) return <LoadingState rows={3} />;
  if (query.isError) return <ErrorState description={(query.error as Error).message} />;
  if (!query.data) return <EmptyState title="Không tìm thấy hồ sơ nhân viên" />;

  const employee = query.data;
  const avatarUrl = draft.avatar_url ?? employee.avatar_url ?? employee.profile_photo_url ?? "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-4">
        {editing ? (
          <AvatarUploadField
            value={avatarUrl}
            organizationId={organizationId}
            ownerId={employeeId}
            disabled={mutation.isPending}
            onUploaded={(url) => setDraft((prev) => ({ ...prev, avatar_url: url }))}
          />
        ) : (
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-lg font-semibold text-muted-foreground">
            {avatarUrl ? (
              <img src={avatarUrl} alt={employee.full_name} className="size-full object-cover" />
            ) : (
              (employee.full_name?.charAt(0) ?? "?").toUpperCase()
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold">{employee.full_name}</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(draft.professional_title ?? employee.professional_title ?? employee.positions?.name) && (
              <Badge>{draft.professional_title ?? employee.professional_title ?? employee.positions?.name}</Badge>
            )}
            {employee.departments?.name && <Badge variant="outline">{employee.departments.name}</Badge>}
            <Badge variant={employee.employment_status === "active" ? "default" : "secondary"}>
              {employee.employment_status === "active" ? "Đang làm việc" : "Tạm dừng"}
            </Badge>
          </div>
        </div>
        {editable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing((prev) => !prev);
              setDraft({});
            }}
          >
            {editing ? (
              <>
                <X className="mr-1.5 size-3.5" /> Đóng
              </>
            ) : (
              "Chỉnh sửa"
            )}
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="size-3.5" /> Email
          </p>
          <p className="text-sm font-medium">{employee.email || "—"}</p>
        </div>
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="size-3.5" /> Điện thoại
          </p>
          {editing ? (
            <Input
              value={draft.phone ?? employee.phone ?? ""}
              onChange={(event) => setDraft((prev) => ({ ...prev, phone: event.target.value }))}
              className="h-8"
            />
          ) : (
            <p className="text-sm font-medium">{employee.phone || "—"}</p>
          )}
        </div>
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Star className="size-3.5" /> Chuyên môn
          </p>
          {editing ? (
            <Input
              value={draft.specialization ?? employee.specialization ?? ""}
              onChange={(event) => setDraft((prev) => ({ ...prev, specialization: event.target.value }))}
              placeholder="VD: Nha chu, Implant, Chỉnh nha..."
              className="h-8"
            />
          ) : (
            <p className="text-sm font-medium">{employee.specialization || "Chưa cập nhật"}</p>
          )}
        </div>
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Award className="size-3.5" /> Số giấy phép hành nghề
          </p>
          {editing ? (
            <Input
              value={draft.license_number ?? employee.license_number ?? ""}
              onChange={(event) => setDraft((prev) => ({ ...prev, license_number: event.target.value }))}
              className="h-8"
            />
          ) : (
            <p className="text-sm font-medium">{employee.license_number || "Chưa cập nhật"}</p>
          )}
        </div>
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Briefcase className="size-3.5" /> Số năm kinh nghiệm
          </p>
          {editing ? (
            <Input
              type="number"
              min={0}
              value={draft.years_of_experience ?? employee.years_of_experience ?? ""}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, years_of_experience: Number(event.target.value) || 0 }))
              }
              className="h-8"
            />
          ) : (
            <p className="text-sm font-medium">
              {employee.years_of_experience ? `${employee.years_of_experience} năm` : "Chưa cập nhật"}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Chức danh hiển thị</p>
          {editing ? (
            <Input
              value={draft.professional_title ?? employee.professional_title ?? ""}
              onChange={(event) => setDraft((prev) => ({ ...prev, professional_title: event.target.value }))}
              placeholder="VD: Bác sĩ chính, Trưởng khoa..."
              className="h-8"
            />
          ) : (
            <p className="text-sm font-medium">{employee.professional_title || "Chưa cập nhật"}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Bằng cấp / Chứng chỉ</p>
        {editing ? (
          <Textarea
            rows={3}
            value={draft.qualifications ?? employee.qualifications ?? ""}
            onChange={(event) => setDraft((prev) => ({ ...prev, qualifications: event.target.value }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{employee.qualifications || "Chưa cập nhật"}</p>
        )}
      </div>

      {editing && (
        <div className="flex justify-end gap-2 border-t border-border/70 pt-4">
          <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={mutation.isPending}>
            Hủy
          </Button>
          <Button type="button" onClick={() => mutation.mutate(draft)} disabled={mutation.isPending}>
            <Save className="mr-2 size-4" />
            Lưu thay đổi
          </Button>
        </div>
      )}

      {!editable && !editing && (
        <p className="border-t border-border/70 pt-3 text-xs text-muted-foreground">
          Chỉ Quản trị viên/Quản lý mới chỉnh sửa được hồ sơ nhân viên (bao gồm ảnh đại diện).
        </p>
      )}
    </div>
  );
}
