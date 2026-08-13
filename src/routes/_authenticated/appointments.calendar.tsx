import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  DoorOpen,
  Phone,
  Plus,
  Stethoscope,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";

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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/appointments/calendar")({
  head: () => ({
    meta: [
      { title: "Lịch khám theo phòng — Việt Smile Clinic Suite" },
      {
        name: "description",
        content:
          "Lịch khám dạng calendar theo phòng điều trị và khung giờ, xác nhận hẹn chỉ với một chạm.",
      },
      { property: "og:title", content: "Lịch khám theo phòng — Việt Smile Clinic Suite" },
      {
        property: "og:description",
        content: "Xem lịch khám theo phòng, đặt hẹn vào slot trống và xác nhận nhanh.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AppointmentsCalendarPage,
});

const STATUS_CONFIG: Record<string, { label: string; className: string; dot: string }> = {
  scheduled: { label: "Chờ xác nhận", className: "bg-sky-50 text-sky-700", dot: "bg-sky-500" },
  confirmed: {
    label: "Đã xác nhận",
    className: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  completed: { label: "Hoàn tất", className: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  cancelled: { label: "Đã hủy", className: "bg-rose-50 text-rose-600", dot: "bg-rose-500" },
  no_show: { label: "Không đến", className: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
};

type ApptRow = {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string | null;
  status: string;
  notes: string | null;
  room_id: string | null;
  reminder_sent: boolean;
  patient_name: string;
  patient_phone: string;
  service_name: string;
  doctor_name: string;
};

function toISO(date: Date) {
  return date.toISOString().split("T")[0] ?? "";
}

function shiftDate(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

function startOfWeek(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  const day = (date.getDay() + 6) % 7; // monday-first
  date.setDate(date.getDate() - day);
  return toISO(date);
}

function hhmm(value: string | null) {
  return value ? value.slice(0, 5) : "--:--";
}

function minutesOf(value: string) {
  const [h = "0", m = "0"] = value.split(":");
  return Number(h) * 60 + Number(m);
}

function AppointmentsCalendarPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<"day" | "week">("day");
  const [selectedDate, setSelectedDate] = useState(toISO(new Date()));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const weekStart = startOfWeek(selectedDate);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => shiftDate(weekStart, index)),
    [weekStart],
  );
  const rangeStart = view === "day" ? selectedDate : weekStart;
  const rangeEnd = view === "day" ? selectedDate : shiftDate(weekStart, 6);

  const roomsQuery = useQuery({
    queryKey: ["treatment-rooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treatment_rooms")
        .select("id, name, code, room_type, is_active")
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 300_000,
  });

  const slotsQuery = useQuery({
    queryKey: ["room-time-slots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_time_slots")
        .select("room_id, weekday, start_time, end_time, slot_minutes, is_active")
        .eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 300_000,
  });

  const appointmentsQuery = useQuery({
    queryKey: ["appointments-calendar", rangeStart, rangeEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, appointment_date, start_time, end_time, status, notes, room_id, reminder_sent, patients(full_name, phone), services(name), employees:assigned_dentist_id(full_name)",
        )
        .gte("appointment_date", rangeStart)
        .lte("appointment_date", rangeEnd)
        .order("start_time", { ascending: true });
      if (error) throw error;

      return (data ?? []).map((row): ApptRow => {
        const record = row as unknown as {
          id: string;
          appointment_date: string;
          start_time: string;
          end_time: string | null;
          status: string;
          notes: string | null;
          room_id: string | null;
          reminder_sent: boolean;
          patients: { full_name: string; phone: string | null } | null;
          services: { name: string } | null;
          employees: { full_name: string } | null;
        };
        return {
          id: record.id,
          appointment_date: record.appointment_date,
          start_time: record.start_time,
          end_time: record.end_time,
          status: record.status,
          notes: record.notes,
          room_id: record.room_id,
          reminder_sent: record.reminder_sent,
          patient_name: record.patients?.full_name ?? "—",
          patient_phone: record.patients?.phone ?? "—",
          service_name: record.services?.name ?? "—",
          doctor_name: record.employees?.full_name ?? "Chưa gán bác sĩ",
        };
      });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã cập nhật trạng thái lịch hẹn");
      void queryClient.invalidateQueries({ queryKey: ["appointments-calendar"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rooms = roomsQuery.data ?? [];
  const allAppointments = appointmentsQuery.data ?? [];

  const filtered = allAppointments.filter((record) => {
    const term = search.trim().toLowerCase();
    const matchTerm =
      !term ||
      record.patient_name.toLowerCase().includes(term) ||
      record.patient_phone.includes(term) ||
      record.doctor_name.toLowerCase().includes(term);
    const matchStatus = statusFilter === "all" || record.status === statusFilter;
    return matchTerm && matchStatus;
  });

  const dayAppointments = filtered.filter((item) => item.appointment_date === selectedDate);

  // Build the time axis from the configured room slots of that weekday.
  const weekday = new Date(`${selectedDate}T00:00:00`).getDay();
  const daySlots = (slotsQuery.data ?? []).filter((slot) => slot.weekday === weekday);
  const timeAxis = useMemo(() => {
    if (daySlots.length === 0) return [] as string[];
    const step = Math.min(...daySlots.map((slot) => slot.slot_minutes || 30));
    const from = Math.min(...daySlots.map((slot) => minutesOf(slot.start_time)));
    const to = Math.max(...daySlots.map((slot) => minutesOf(slot.end_time)));
    const list: string[] = [];
    for (let m = from; m < to; m += step) {
      list.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    }
    return list;
  }, [JSON.stringify(daySlots)]);

  const stats = {
    total: dayAppointments.length,
    scheduled: dayAppointments.filter((item) => item.status === "scheduled").length,
    confirmed: dayAppointments.filter((item) => item.status === "confirmed").length,
    completed: dayAppointments.filter((item) => item.status === "completed").length,
  };

  const loading = roomsQuery.isLoading || appointmentsQuery.isLoading || slotsQuery.isLoading;
  const errorMessage =
    (roomsQuery.error as Error | null)?.message ??
    (appointmentsQuery.error as Error | null)?.message ??
    (slotsQuery.error as Error | null)?.message;

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Lịch khám"
        description="Calendar theo phòng điều trị và khung giờ — nhấn vào ô trống để đặt hẹn ngay."
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link to="/appointments/booking" search={{ date: selectedDate, time: undefined, room: undefined }}>
              <Plus className="mr-2 size-4" />
              Tạo hẹn mới
            </Link>
          </Button>
        }
      />

      {/* Toolbar */}
      <Card className="quiet-card min-w-0 p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Lùi"
              onClick={() => setSelectedDate(shiftDate(selectedDate, view === "day" ? -1 : -7))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="h-9 w-[9.5rem]"
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Tiến"
              onClick={() => setSelectedDate(shiftDate(selectedDate, view === "day" ? 1 : 7))}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedDate(toISO(new Date()))}>
              Hôm nay
            </Button>
          </div>

          <Tabs value={view} onValueChange={(value) => setView(value as "day" | "week")}>
            <TabsList>
              <TabsTrigger value="day">Theo ngày</TabsTrigger>
              <TabsTrigger value="week">Theo tuần</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row lg:justify-end">
            <Input
              placeholder="Tìm bệnh nhân, SĐT, bác sĩ..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 sm:max-w-64"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 sm:w-44">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<CalendarDays className="size-4" />} label="Tổng hẹn" value={stats.total} />
        <StatCard icon={<Clock className="size-4" />} label="Chờ xác nhận" value={stats.scheduled} />
        <StatCard icon={<Check className="size-4" />} label="Đã xác nhận" value={stats.confirmed} />
        <StatCard icon={<User className="size-4" />} label="Hoàn tất" value={stats.completed} />
      </section>

      {loading ? (
        <LoadingState rows={6} />
      ) : errorMessage ? (
        <ErrorState description={errorMessage} />
      ) : view === "week" ? (
        <WeekView days={weekDays} appointments={filtered} onPickDay={(day) => {
          setSelectedDate(day);
          setView("day");
        }} />
      ) : rooms.length === 0 ? (
        <EmptyState
          title="Chưa có phòng điều trị"
          description="Hãy tạo phòng và khung giờ trong mục Phòng & khung giờ để dùng lịch theo phòng."
        />
      ) : (
        <>
          {/* Desktop / tablet: room grid */}
          <Card className="quiet-card hidden min-w-0 overflow-hidden p-0 md:block">
            <div className="w-full overflow-x-auto">
              <div
                className="min-w-[720px]"
                style={{
                  display: "grid",
                  gridTemplateColumns: `72px repeat(${rooms.length}, minmax(180px, 1fr))`,
                }}
              >
                <div className="sticky left-0 z-10 border-b border-border bg-muted/40 px-2 py-3 text-xs font-medium text-muted-foreground">
                  Giờ
                </div>
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="border-b border-l border-border bg-muted/40 px-3 py-3 text-sm font-semibold"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <DoorOpen className="size-4 shrink-0 text-primary" />
                      <span className="truncate">{room.name}</span>
                    </span>
                  </div>
                ))}

                {timeAxis.map((slotTime) => (
                  <FragmentRow
                    key={slotTime}
                    slotTime={slotTime}
                    rooms={rooms}
                    date={selectedDate}
                    appointments={dayAppointments}
                    onUpdate={(id, status) => updateStatus.mutate({ id, status })}
                  />
                ))}
              </div>
            </div>
          </Card>

          {/* Mobile: compact agenda */}
          <div className="space-y-3 md:hidden">
            {dayAppointments.length === 0 ? (
              <EmptyState title="Không có lịch hẹn" description="Ngày này chưa có hẹn nào." />
            ) : (
              dayAppointments.map((item) => (
                <AgendaCard
                  key={item.id}
                  appointment={item}
                  roomName={rooms.find((room) => room.id === item.room_id)?.name ?? "Chưa xếp phòng"}
                  onUpdate={(status) => updateStatus.mutate({ id: item.id, status })}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function FragmentRow({
  slotTime,
  rooms,
  date,
  appointments,
  onUpdate,
}: {
  slotTime: string;
  rooms: Array<{ id: string; name: string }>;
  date: string;
  appointments: ApptRow[];
  onUpdate: (id: string, status: string) => void;
}) {
  return (
    <>
      <div className="sticky left-0 z-10 border-b border-border bg-background px-2 py-3 text-xs text-muted-foreground">
        {slotTime}
      </div>
      {rooms.map((room) => {
        const booked = appointments.find(
          (item) => item.room_id === room.id && hhmm(item.start_time) === slotTime,
        );
        if (!booked) {
          return (
            <Link
              key={`${room.id}-${slotTime}`}
              to="/appointments/booking"
              search={{ date, time: slotTime, room: room.id }}
              className="group flex min-h-14 items-center justify-center border-b border-l border-border text-xs text-muted-foreground/60 transition-colors hover:bg-primary/5"
            >
              <span className="opacity-0 transition-opacity group-hover:opacity-100">
                + Đặt {slotTime}
              </span>
            </Link>
          );
        }
        const config = STATUS_CONFIG[booked.status] ?? STATUS_CONFIG["scheduled"]!;
        return (
          <div key={`${room.id}-${slotTime}`} className="border-b border-l border-border p-1.5">
            <div className={`rounded-lg p-2 ${config.className}`}>
              <p className="truncate text-sm font-semibold">{booked.patient_name}</p>
              <p className="truncate text-xs opacity-80">
                {hhmm(booked.start_time)}–{hhmm(booked.end_time)} · {booked.service_name}
              </p>
              <p className="truncate text-xs opacity-70">{booked.doctor_name}</p>
              {booked.status === "scheduled" && (
                <div className="mt-1.5 flex gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-6 px-2 text-xs"
                    onClick={() => onUpdate(booked.id, "confirmed")}
                  >
                    <Check className="mr-1 size-3" /> Xác nhận
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => onUpdate(booked.id, "cancelled")}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

function WeekView({
  days,
  appointments,
  onPickDay,
}: {
  days: string[];
  appointments: ApptRow[];
  onPickDay: (day: string) => void;
}) {
  return (
    <div className="min-w-0 overflow-x-auto pb-2">
      <div className="grid min-w-[700px] grid-cols-7 gap-3">
        {days.map((day) => {
          const items = appointments.filter((item) => item.appointment_date === day);
          const date = new Date(`${day}T00:00:00`);
          return (
            <Card key={day} className="quiet-card min-w-0 p-3">
              <button
                type="button"
                onClick={() => onPickDay(day)}
                className="mb-2 w-full text-left"
              >
                <p className="text-xs uppercase text-muted-foreground">
                  {date.toLocaleDateString("vi-VN", { weekday: "short" })}
                </p>
                <p className="text-lg font-semibold">{date.getDate()}/{date.getMonth() + 1}</p>
              </button>
              <div className="space-y-1.5">
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Trống</p>
                ) : (
                  items.slice(0, 6).map((item) => {
                    const config = STATUS_CONFIG[item.status] ?? STATUS_CONFIG["scheduled"]!;
                    return (
                      <div key={item.id} className={`rounded-md px-2 py-1 text-xs ${config.className}`}>
                        <span className="font-medium">{hhmm(item.start_time)}</span>{" "}
                        <span className="truncate">{item.patient_name}</span>
                      </div>
                    );
                  })
                )}
                {items.length > 6 && (
                  <p className="text-xs text-muted-foreground">+{items.length - 6} hẹn khác</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function AgendaCard({
  appointment,
  roomName,
  onUpdate,
}: {
  appointment: ApptRow;
  roomName: string;
  onUpdate: (status: string) => void;
}) {
  const config = STATUS_CONFIG[appointment.status] ?? STATUS_CONFIG["scheduled"]!;
  return (
    <Card className="quiet-card min-w-0 p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{appointment.patient_name}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              {hhmm(appointment.start_time)}–{hhmm(appointment.end_time)}
            </span>
            <span className="flex items-center gap-1">
              <DoorOpen className="size-3.5" />
              {roomName}
            </span>
            <span className="flex min-w-0 items-center gap-1">
              <Phone className="size-3.5" />
              <span className="truncate">{appointment.patient_phone}</span>
            </span>
          </p>
          <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <Stethoscope className="size-3.5" />
            {appointment.doctor_name} · {appointment.service_name}
          </p>
        </div>
        <Badge className={`${config.className} shrink-0 border-0`}>{config.label}</Badge>
      </div>
      {appointment.status === "scheduled" && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => onUpdate("confirmed")}>
            <Check className="mr-1 size-4" /> Xác nhận
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={() => onUpdate("cancelled")}>
            <X className="mr-1 size-4" /> Hủy
          </Button>
        </div>
      )}
    </Card>
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
    <Card className="quiet-card min-w-0 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
      </div>
    </Card>
  );
}
