import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, DoorOpen, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession, useSessionProfile } from "@/hooks/use-session";
import { hasAnyRole } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/rooms")({
  head: () => ({
    meta: [
      { title: "Phòng & khung giờ — Việt Smile Clinic Suite" },
      {
        name: "description",
        content: "Quản lý phòng điều trị, ghế nha khoa và khung giờ nhận hẹn của phòng khám.",
      },
      { property: "og:title", content: "Phòng & khung giờ — Việt Smile Clinic Suite" },
      {
        property: "og:description",
        content: "Thiết lập phòng điều trị và slot nhận hẹn theo từng ngày trong tuần.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoomsPage,
});

const WEEKDAYS = [
  { value: 1, label: "T2" },
  { value: 2, label: "T3" },
  { value: 3, label: "T4" },
  { value: 4, label: "T5" },
  { value: 5, label: "T6" },
  { value: 6, label: "T7" },
  { value: 0, label: "CN" },
];

function RoomsPage() {
  const { session } = useAuthSession();
  const profileQuery = useSessionProfile(session?.user.id);
  const queryClient = useQueryClient();
  const canEdit = hasAnyRole(profileQuery.data?.roles ?? [], ["administrator", "manager"]);

  const [newRoom, setNewRoom] = useState({ name: "", code: "", equipment: "" });

  const roomsQuery = useQuery({
    queryKey: ["rooms-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treatment_rooms")
        .select("id, name, code, room_type, equipment, is_active, display_order")
        .is("deleted_at", null)
        .order("display_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const slotsQuery = useQuery({
    queryKey: ["rooms-admin-slots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_time_slots")
        .select("id, room_id, weekday, start_time, end_time, slot_minutes, is_active");
      if (error) throw error;
      return data ?? [];
    },
  });

  const createRoom = useMutation({
    mutationFn: async () => {
      const organizationId = profileQuery.data?.organizationId;
      if (!organizationId) throw new Error("Không xác định được phòng khám");
      if (!newRoom.name.trim()) throw new Error("Vui lòng nhập tên phòng");
      const { error } = await supabase.from("treatment_rooms").insert({
        organization_id: organizationId,
        name: newRoom.name.trim(),
        code: newRoom.code.trim() || null,
        equipment: newRoom.equipment.trim() || null,
        display_order: (roomsQuery.data?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã thêm phòng điều trị");
      setNewRoom({ name: "", code: "", equipment: "" });
      void queryClient.invalidateQueries({ queryKey: ["rooms-admin"] });
      void queryClient.invalidateQueries({ queryKey: ["treatment-rooms"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleRoom = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("treatment_rooms")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rooms-admin"] });
      void queryClient.invalidateQueries({ queryKey: ["treatment-rooms"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeRoom = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("treatment_rooms")
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã xóa phòng");
      void queryClient.invalidateQueries({ queryKey: ["rooms-admin"] });
      void queryClient.invalidateQueries({ queryKey: ["treatment-rooms"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveSlot = useMutation({
    mutationFn: async (payload: {
      roomId: string;
      weekday: number;
      start: string;
      end: string;
      minutes: number;
      existingId?: string;
    }) => {
      const organizationId = profileQuery.data?.organizationId;
      if (!organizationId) throw new Error("Không xác định được phòng khám");
      if (payload.existingId) {
        const { error } = await supabase
          .from("room_time_slots")
          .update({
            start_time: payload.start,
            end_time: payload.end,
            slot_minutes: payload.minutes,
            is_active: true,
          })
          .eq("id", payload.existingId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("room_time_slots").insert({
        organization_id: organizationId,
        room_id: payload.roomId,
        weekday: payload.weekday,
        start_time: payload.start,
        end_time: payload.end,
        slot_minutes: payload.minutes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã lưu khung giờ");
      void queryClient.invalidateQueries({ queryKey: ["rooms-admin-slots"] });
      void queryClient.invalidateQueries({ queryKey: ["room-time-slots"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (roomsQuery.isLoading || slotsQuery.isLoading) return <LoadingState rows={4} />;
  if (roomsQuery.isError) return <ErrorState description={(roomsQuery.error as Error).message} />;

  const rooms = roomsQuery.data ?? [];

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Phòng & khung giờ"
        description="Mỗi phòng là một luồng slot đặt hẹn. Cấu hình ở đây sẽ hiển thị ngay trên calendar lịch khám."
        actions={
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link to="/appointments/calendar">
              <CalendarDays className="mr-2 size-4" />
              Xem calendar
            </Link>
          </Button>
        }
      />

      {canEdit && (
        <Card className="quiet-card min-w-0 p-4">
          <h2 className="mb-3 text-sm font-semibold">Thêm phòng điều trị</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0 space-y-1.5">
              <Label>Tên phòng</Label>
              <Input
                value={newRoom.name}
                onChange={(event) => setNewRoom({ ...newRoom, name: event.target.value })}
                placeholder="Phòng 5 - Implant"
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label>Mã phòng</Label>
              <Input
                value={newRoom.code}
                onChange={(event) => setNewRoom({ ...newRoom, code: event.target.value })}
                placeholder="P5"
              />
            </div>
            <div className="min-w-0 space-y-1.5 sm:col-span-2 lg:col-span-1">
              <Label>Trang thiết bị</Label>
              <Input
                value={newRoom.equipment}
                onChange={(event) => setNewRoom({ ...newRoom, equipment: event.target.value })}
                placeholder="Ghế nha khoa, máy X-quang"
              />
            </div>
            <div className="flex items-end">
              <Button
                className="w-full"
                onClick={() => createRoom.mutate()}
                disabled={createRoom.isPending}
              >
                <Plus className="mr-2 size-4" />
                Thêm phòng
              </Button>
            </div>
          </div>
        </Card>
      )}

      {rooms.length === 0 ? (
        <EmptyState title="Chưa có phòng" description="Thêm phòng điều trị đầu tiên để bắt đầu." />
      ) : (
        <div className="space-y-4">
          {rooms.map((room) => (
            <Card key={room.id} className="quiet-card min-w-0 p-4">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold">
                    <DoorOpen className="size-4 shrink-0 text-primary" />
                    <span className="truncate">{room.name}</span>
                    {room.code && <Badge variant="secondary">{room.code}</Badge>}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {room.equipment || "Chưa mô tả thiết bị"}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      Hoạt động
                      <Switch
                        checked={room.is_active}
                        onCheckedChange={(checked) =>
                          toggleRoom.mutate({ id: room.id, isActive: checked })
                        }
                      />
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Xóa phòng"
                      onClick={() => removeRoom.mutate(room.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {WEEKDAYS.map((day) => {
                  const slot = (slotsQuery.data ?? []).find(
                    (item) => item.room_id === room.id && item.weekday === day.value,
                  );
                  return (
                    <SlotEditor
                      key={`${room.id}-${day.value}`}
                      label={day.label}
                      slot={slot ?? null}
                      readOnly={!canEdit}
                      onSave={(start, end, minutes) =>
                        saveSlot.mutate({
                          roomId: room.id,
                          weekday: day.value,
                          start,
                          end,
                          minutes,
                          ...(slot ? { existingId: slot.id } : {}),
                        })
                      }
                    />
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SlotEditor({
  label,
  slot,
  readOnly,
  onSave,
}: {
  label: string;
  slot: { start_time: string; end_time: string; slot_minutes: number } | null;
  readOnly: boolean;
  onSave: (start: string, end: string, minutes: number) => void;
}) {
  const [start, setStart] = useState(slot?.start_time.slice(0, 5) ?? "08:00");
  const [end, setEnd] = useState(slot?.end_time.slice(0, 5) ?? "17:30");
  const [minutes, setMinutes] = useState(String(slot?.slot_minutes ?? 30));

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-border/70 p-2">
      <span className="w-8 shrink-0 text-xs font-semibold text-muted-foreground">{label}</span>
      <Input
        type="time"
        value={start}
        disabled={readOnly}
        onChange={(event) => setStart(event.target.value)}
        className="h-8 w-[6.5rem]"
      />
      <Input
        type="time"
        value={end}
        disabled={readOnly}
        onChange={(event) => setEnd(event.target.value)}
        className="h-8 w-[6.5rem]"
      />
      <Input
        type="number"
        min={10}
        step={5}
        value={minutes}
        disabled={readOnly}
        onChange={(event) => setMinutes(event.target.value)}
        className="h-8 w-16"
        aria-label="Số phút mỗi slot"
      />
      {!readOnly && (
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label="Lưu khung giờ"
          onClick={() => onSave(start, end, Number(minutes) || 30)}
        >
          <Save className="size-4" />
        </Button>
      )}
    </div>
  );
}
