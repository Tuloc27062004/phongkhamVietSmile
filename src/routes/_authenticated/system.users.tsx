import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Lock, ShieldCheck, Unlock, X } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { useAuthSession } from "@/hooks/use-session";
import { APP_ROLES, ROLE_LABELS, type AppRole } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/system/users")({
  head: () => ({
    meta: [
      { title: "Tài khoản người dùng — Việt Smile Clinic Suite" },
      {
        name: "description",
        content: "Duyệt tài khoản đăng ký mới và phân vai trò cho người dùng phòng khám.",
      },
      { property: "og:title", content: "Tài khoản người dùng — Việt Smile Clinic Suite" },
      {
        property: "og:description",
        content: "Duyệt tài khoản đăng ký mới và phân vai trò trong phòng khám.",
      },
    ],
  }),
  component: SystemUsersPage,
});

type ApprovalStatus = "pending" | "approved" | "rejected";

type UserRow = {
  id: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  approval_status: ApprovalStatus;
  created_at: string;
  role: AppRole | null;
};

const STATUS_BADGE: Record<ApprovalStatus, { label: string; className: string }> = {
  pending: { label: "Chờ duyệt", className: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Đã duyệt", className: "bg-green-100 text-green-800" },
  rejected: { label: "Từ chối", className: "bg-red-100 text-red-800" },
};

function SystemUsersPage() {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();
  const [pendingRole, setPendingRole] = useState<Record<string, AppRole>>({});

  const usersQuery = useQuery({
    queryKey: ["system-users"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }] =
        await Promise.all([
          supabase
            .from("user_profiles")
            .select("id, full_name, email, is_active, approval_status, created_at")
            .order("created_at", { ascending: false }),
          supabase.from("user_roles").select("user_id, role"),
        ]);

      if (profilesError) throw profilesError;
      if (rolesError) throw rolesError;

      const roleByUser = new Map((roles || []).map((r) => [r.user_id, r.role as AppRole]));

      return (profiles || []).map((p) => ({
        id: p.id,
        full_name: p.full_name || "—",
        email: p.email,
        is_active: p.is_active,
        approval_status: (p.approval_status as ApprovalStatus) ?? "pending",
        created_at: p.created_at,
        role: roleByUser.get(p.id) ?? null,
      })) as UserRow[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["system-users"] });

  const reviewMutation = useMutation({
    mutationFn: async ({
      userId,
      decision,
      role,
    }: {
      userId: string;
      decision: ApprovalStatus;
      role?: AppRole;
    }) => {
      const { error } = await supabase.rpc("admin_review_user", {
        target_user_id: userId,
        decision,
        ...(role ? { new_role: role } : {}),
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.decision === "approved" ? "Đã duyệt tài khoản" : "Đã từ chối");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.rpc("admin_set_user_role", {
        target_user_id: userId,
        new_role: role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã cập nhật vai trò");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const activeMutation = useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      const { error } = await supabase.rpc("admin_set_user_active", {
        target_user_id: userId,
        active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã cập nhật trạng thái tài khoản");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (usersQuery.isLoading) return <LoadingState rows={5} />;
  if (usersQuery.isError) return <ErrorState description={(usersQuery.error as Error).message} />;

  const users = usersQuery.data || [];
  const pending = users.filter((u) => u.approval_status === "pending");
  const reviewed = users.filter((u) => u.approval_status !== "pending");

  return (
    <div>
      <PageHeader
        title="Tài khoản người dùng"
        description="Người đăng ký mới phải được quản trị viên duyệt và phân vai trò trước khi truy cập hệ thống."
      />

      <Card className="surface-card mb-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Chờ duyệt</h3>
          <Badge className="bg-yellow-100 text-yellow-800">{pending.length} yêu cầu</Badge>
        </div>

        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không có yêu cầu nào đang chờ duyệt.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Họ và tên</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Ngày đăng ký</TableHead>
                  <TableHead>Vai trò cấp</TableHead>
                  <TableHead className="text-right">Quyết định</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.email || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString("vi-VN")}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={pendingRole[user.id] ?? ""}
                        onValueChange={(value) =>
                          setPendingRole((prev) => ({ ...prev, [user.id]: value as AppRole }))
                        }
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue placeholder="Chọn vai trò" />
                        </SelectTrigger>
                        <SelectContent>
                          {APP_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={!pendingRole[user.id] || reviewMutation.isPending}
                          onClick={() =>
                            reviewMutation.mutate({
                              userId: user.id,
                              decision: "approved",
                              role: pendingRole[user.id] as AppRole,
                            })
                          }
                        >
                          <Check className="mr-1 size-4" /> Duyệt
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reviewMutation.isPending}
                          onClick={() =>
                            reviewMutation.mutate({ userId: user.id, decision: "rejected" })
                          }
                        >
                          <X className="mr-1 size-4" /> Từ chối
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {reviewed.length === 0 ? (
        <EmptyState title="Chưa có người dùng" />
      ) : (
        <div className="surface-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Họ và tên</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviewed.map((user) => {
                const isSelf = user.id === session?.user.id;
                const badge = STATUS_BADGE[user.approval_status];
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.email || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge className={badge.className}>{badge.label}</Badge>
                        {user.approval_status === "approved" && !user.is_active && (
                          <Badge className="bg-red-100 text-red-800">Tạm khóa</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role ?? ""}
                        disabled={
                          isSelf ||
                          user.approval_status !== "approved" ||
                          setRoleMutation.isPending
                        }
                        onValueChange={(value) =>
                          setRoleMutation.mutate({ userId: user.id, role: value as AppRole })
                        }
                      >
                        <SelectTrigger className="w-44">
                          <ShieldCheck className="mr-2 size-4 text-muted-foreground" />
                          <SelectValue placeholder="Chưa gán vai trò" />
                        </SelectTrigger>
                        <SelectContent>
                          {APP_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isSelf && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Không thể tự đổi vai trò của chính mình
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isSelf && user.approval_status === "approved" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={activeMutation.isPending}
                          onClick={() =>
                            activeMutation.mutate({ userId: user.id, active: !user.is_active })
                          }
                        >
                          {user.is_active ? (
                            <>
                              <Lock className="mr-1 size-4" /> Khóa
                            </>
                          ) : (
                            <>
                              <Unlock className="mr-1 size-4" /> Mở khóa
                            </>
                          )}
                        </Button>
                      )}
                      {!isSelf && user.approval_status === "rejected" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reviewMutation.isPending || !pendingRole[user.id]}
                          onClick={() =>
                            reviewMutation.mutate({
                              userId: user.id,
                              decision: "approved",
                              role: (pendingRole[user.id] ?? "employee") as AppRole,
                            })
                          }
                        >
                          <Check className="mr-1 size-4" /> Duyệt lại
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
