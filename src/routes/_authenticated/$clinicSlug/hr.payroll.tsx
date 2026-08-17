import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import * as XLSX from "xlsx";
import {
  Calculator,
  CheckCircle,
  Edit,
  FileSpreadsheet,
  Printer,
  Save,
  Settings2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ExportButton } from "@/components/export-button";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuthSession, useSessionProfile } from "@/hooks/use-session";
import { hasAnyRole } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/$clinicSlug/hr/payroll")({
  head: () => ({
    meta: [
      { title: "Lương — GZV Clinic Platform" },
      { name: "description", content: "Cấu hình lương, công thức tính và tính lương tự động dựa trên chấm công." },
    ],
  }),
  component: SalaryPage,
});

// ---------------------------------------------------------------------------
// Công thức lương — lưu trong app_settings (group_key="payroll", setting_key="formula")
// để mỗi phòng khám tự cấu hình riêng, không hardcode trong code.
// ---------------------------------------------------------------------------

type PayrollFormula = {
  standardWorkDays: number;
  standardWorkHoursPerDay: number;
  lateGraceMinutes: number;
  lateDeductionMode: "none" | "per_minute" | "per_occurrence";
  lateOccurrencePenaltyDays: number;
  absenceDeductionMode: "none" | "daily_rate";
  overtimeEnabled: boolean;
  overtimeRateMultiplier: number;
  insurancePercent: number;
  includeAllowance: boolean;
  includeBonus: boolean;
  commissionEnabled: boolean;
  commissionPercent: number;
  taxEnabled: boolean;
  personalDeductionAmount: number;
};

const DEFAULT_FORMULA: PayrollFormula = {
  standardWorkDays: 26,
  standardWorkHoursPerDay: 8,
  lateGraceMinutes: 15,
  lateDeductionMode: "per_minute",
  lateOccurrencePenaltyDays: 0.1,
  absenceDeductionMode: "daily_rate",
  overtimeEnabled: true,
  overtimeRateMultiplier: 1.5,
  insurancePercent: 10.5,
  includeAllowance: true,
  includeBonus: true,
  commissionEnabled: false,
  commissionPercent: 10,
  taxEnabled: false,
  personalDeductionAmount: 11_000_000,
};

// Biểu thuế TNCN lũy tiến từng phần theo tháng (Thông tư 111/2013/TT-BTC, thu nhập cư trú).
const PIT_BRACKETS: { upTo: number; rate: number }[] = [
  { upTo: 5_000_000, rate: 0.05 },
  { upTo: 10_000_000, rate: 0.1 },
  { upTo: 18_000_000, rate: 0.15 },
  { upTo: 32_000_000, rate: 0.2 },
  { upTo: 52_000_000, rate: 0.25 },
  { upTo: 80_000_000, rate: 0.3 },
  { upTo: Infinity, rate: 0.35 },
];

function calculatePersonalIncomeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  let previousThreshold = 0;
  for (const bracket of PIT_BRACKETS) {
    if (taxableIncome <= previousThreshold) break;
    const amountInBracket = Math.min(taxableIncome, bracket.upTo) - previousThreshold;
    tax += amountInBracket * bracket.rate;
    previousThreshold = bracket.upTo;
  }
  return tax;
}

function usePayrollFormula() {
  const queryClient = useQueryClient();

  const formulaQuery = useQuery({
    queryKey: ["payroll-formula"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("id, value")
        .eq("group_key", "payroll")
        .eq("setting_key", "formula")
        .maybeSingle();
      if (error) throw error;
      const stored = (data?.value ?? {}) as Partial<PayrollFormula>;
      return { settingId: data?.id ?? null, formula: { ...DEFAULT_FORMULA, ...stored } };
    },
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: async ({
      settingId,
      formula,
      organizationId,
    }: {
      settingId: string | null;
      formula: PayrollFormula;
      organizationId: string;
    }) => {
      if (settingId) {
        const { error } = await supabase
          .from("app_settings")
          .update({ value: formula as unknown as Json })
          .eq("id", settingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("app_settings").insert({
          organization_id: organizationId,
          group_key: "payroll",
          setting_key: "formula",
          value: formula as unknown as Json,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Đã lưu công thức tính lương");
      void queryClient.invalidateQueries({ queryKey: ["payroll-formula"] });
      void queryClient.invalidateQueries({ queryKey: ["payroll"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { formulaQuery, saveMutation };
}

function money(n: number) {
  return `${Math.round(n).toLocaleString("vi-VN")}đ`;
}

function SalaryPage() {
  return (
    <div>
      <PageHeader
        title="Lương"
        description="Cấu hình lương cơ bản/phụ cấp, công thức tính và tính lương tự động dựa trên chấm công."
      />
      <Tabs defaultValue="payroll">
        <TabsList>
          <TabsTrigger value="config">Cấu hình lương</TabsTrigger>
          <TabsTrigger value="formula">
            <Calculator className="mr-1.5 size-3.5" />
            Công thức lương
          </TabsTrigger>
          <TabsTrigger value="payroll">Tính lương</TabsTrigger>
        </TabsList>
        <TabsContent value="config" className="mt-6">
          <SalaryConfigTab />
        </TabsContent>
        <TabsContent value="formula" className="mt-6">
          <FormulaTab />
        </TabsContent>
        <TabsContent value="payroll" className="mt-6">
          <PayrollTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Công thức lương
// ---------------------------------------------------------------------------

function FormulaTab() {
  const { org } = Route.useRouteContext();
  const { session } = useAuthSession();
  const profileQuery = useSessionProfile(session?.user.id);
  const canEdit = hasAnyRole(profileQuery.data?.roles ?? [], ["administrator"]);
  const { formulaQuery, saveMutation } = usePayrollFormula();

  const [draft, setDraft] = useState<PayrollFormula | null>(null);
  const formula = draft ?? formulaQuery.data?.formula ?? DEFAULT_FORMULA;

  if (formulaQuery.isLoading) return <LoadingState rows={4} />;
  if (formulaQuery.isError) return <ErrorState description={(formulaQuery.error as Error).message} />;

  const update = <K extends keyof PayrollFormula>(key: K, value: PayrollFormula[K]) =>
    setDraft({ ...formula, [key]: value });

  const dirty = draft !== null;

  // Ví dụ minh họa trực tiếp với lương cơ bản mẫu để chủ phòng khám hình dung công thức.
  const sampleBase = 10_000_000;
  const dailyRate = sampleBase / (formula.standardWorkDays || 1);
  const hourlyRate = dailyRate / (formula.standardWorkHoursPerDay || 1);
  const minuteRate = hourlyRate / 60;

  return (
    <div className="space-y-6">
      {!canEdit && (
        <Card className="quiet-card min-w-0 border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Chỉ quản trị viên (administrator) mới có thể chỉnh sửa công thức tính lương chung của phòng khám.
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="quiet-card min-w-0 space-y-4 p-4">
          <h3 className="text-sm font-semibold">Chuẩn ngày công</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Số ngày công chuẩn/tháng</Label>
              <Input
                type="number"
                min={1}
                disabled={!canEdit}
                value={formula.standardWorkDays}
                onChange={(e) => update("standardWorkDays", Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Số giờ công chuẩn/ngày</Label>
              <Input
                type="number"
                min={1}
                disabled={!canEdit}
                value={formula.standardWorkHoursPerDay}
                onChange={(e) => update("standardWorkHoursPerDay", Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Dùng để quy đổi lương cơ bản → lương ngày → lương giờ → lương phút cho từng nhân viên.
          </p>
        </Card>

        <Card className="quiet-card min-w-0 space-y-4 p-4">
          <h3 className="text-sm font-semibold">Đi trễ</h3>
          <div className="space-y-1.5">
            <Label>Số phút được miễn trừ (grace period)</Label>
            <Input
              type="number"
              min={0}
              disabled={!canEdit}
              value={formula.lateGraceMinutes}
              onChange={(e) => update("lateGraceMinutes", Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cách trừ lương khi đi trễ</Label>
            <Select
              disabled={!canEdit}
              value={formula.lateDeductionMode}
              onValueChange={(value) => update("lateDeductionMode", value as PayrollFormula["lateDeductionMode"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Không trừ</SelectItem>
                <SelectItem value="per_minute">Trừ theo số phút trễ thực tế</SelectItem>
                <SelectItem value="per_occurrence">Trừ theo số lần trễ (phạt X ngày công/lần)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {formula.lateDeductionMode === "per_occurrence" && (
            <div className="space-y-1.5">
              <Label>Số ngày công bị trừ mỗi lần trễ</Label>
              <Input
                type="number"
                min={0}
                step={0.05}
                disabled={!canEdit}
                value={formula.lateOccurrencePenaltyDays}
                onChange={(e) => update("lateOccurrencePenaltyDays", Number(e.target.value) || 0)}
              />
            </div>
          )}
        </Card>

        <Card className="quiet-card min-w-0 space-y-4 p-4">
          <h3 className="text-sm font-semibold">Vắng mặt</h3>
          <div className="space-y-1.5">
            <Label>Cách trừ lương khi vắng mặt</Label>
            <Select
              disabled={!canEdit}
              value={formula.absenceDeductionMode}
              onValueChange={(value) =>
                update("absenceDeductionMode", value as PayrollFormula["absenceDeductionMode"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Không trừ</SelectItem>
                <SelectItem value="daily_rate">Trừ theo lương 1 ngày công</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card className="quiet-card min-w-0 space-y-4 p-4">
          <h3 className="text-sm font-semibold">Tăng ca</h3>
          <div className="flex items-center justify-between">
            <Label className="text-sm font-normal">Tính lương tăng ca tự động</Label>
            <Switch
              disabled={!canEdit}
              checked={formula.overtimeEnabled}
              onCheckedChange={(checked) => update("overtimeEnabled", checked)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Hệ số lương tăng ca (x lương giờ)</Label>
            <Input
              type="number"
              min={1}
              step={0.1}
              disabled={!canEdit || !formula.overtimeEnabled}
              value={formula.overtimeRateMultiplier}
              onChange={(e) => update("overtimeRateMultiplier", Number(e.target.value) || 0)}
            />
          </div>
        </Card>

        <Card className="quiet-card min-w-0 space-y-4 p-4">
          <h3 className="text-sm font-semibold">Bảo hiểm</h3>
          <div className="space-y-1.5">
            <Label>% BHXH/BHYT/BHTN trích trên lương cơ bản</Label>
            <Input
              type="number"
              min={0}
              step={0.5}
              disabled={!canEdit}
              value={formula.insurancePercent}
              onChange={(e) => update("insurancePercent", Number(e.target.value) || 0)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Có thể ghi đè riêng cho từng nhân viên tại tab "Cấu hình lương" (mục Bảo hiểm ghi đè).
          </p>
        </Card>

        <Card className="quiet-card min-w-0 space-y-4 p-4">
          <h3 className="text-sm font-semibold">Hoa hồng bác sĩ</h3>
          <div className="flex items-center justify-between">
            <Label className="text-sm font-normal">Tính hoa hồng theo doanh thu điều trị</Label>
            <Switch
              disabled={!canEdit}
              checked={formula.commissionEnabled}
              onCheckedChange={(checked) => update("commissionEnabled", checked)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>% hoa hồng trên doanh thu lịch hẹn hoàn tất</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              disabled={!canEdit || !formula.commissionEnabled}
              value={formula.commissionPercent}
              onChange={(e) => update("commissionPercent", Number(e.target.value) || 0)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Tính trên tổng tiền (total_amount) các lịch hẹn trạng thái "Hoàn tất" mà bác sĩ đó phụ trách
            trong tháng — không phụ thuộc chấm công.
          </p>
        </Card>

        <Card className="quiet-card min-w-0 space-y-4 p-4">
          <h3 className="text-sm font-semibold">Thuế TNCN</h3>
          <div className="flex items-center justify-between">
            <Label className="text-sm font-normal">Tự động khấu trừ thuế TNCN lũy tiến</Label>
            <Switch
              disabled={!canEdit}
              checked={formula.taxEnabled}
              onCheckedChange={(checked) => update("taxEnabled", checked)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Giảm trừ bản thân/tháng</Label>
            <Input
              type="number"
              min={0}
              step={100000}
              disabled={!canEdit || !formula.taxEnabled}
              value={formula.personalDeductionAmount}
              onChange={(e) => update("personalDeductionAmount", Number(e.target.value) || 0)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Theo biểu thuế lũy tiến từng phần (TT 111/2013): 5% đến 35%. Thu nhập tính thuế = Lương gộp −
            Bảo hiểm − Giảm trừ bản thân. Chưa hỗ trợ giảm trừ người phụ thuộc riêng từng nhân viên.
          </p>
        </Card>

        <Card className="quiet-card min-w-0 space-y-4 p-4">
          <h3 className="text-sm font-semibold">Phụ cấp & Thưởng</h3>
          <div className="flex items-center justify-between">
            <Label className="text-sm font-normal">Cộng phụ cấp (cấu hình theo NV) vào lương</Label>
            <Switch
              disabled={!canEdit}
              checked={formula.includeAllowance}
              onCheckedChange={(checked) => update("includeAllowance", checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm font-normal">Cộng thưởng (cấu hình theo NV) vào lương</Label>
            <Switch
              disabled={!canEdit}
              checked={formula.includeBonus}
              onCheckedChange={(checked) => update("includeBonus", checked)}
            />
          </div>
        </Card>
      </div>

      <Card className="quiet-card min-w-0 p-4">
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <Settings2 className="size-4 text-primary" />
          Ví dụ minh họa (lương cơ bản mẫu {money(sampleBase)})
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Lương/ngày</p>
            <p className="font-semibold">{money(dailyRate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Lương/giờ</p>
            <p className="font-semibold">{money(hourlyRate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Lương/phút</p>
            <p className="font-semibold">{money(minuteRate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">1 giờ tăng ca</p>
            <p className="font-semibold text-success">
              +{money(formula.overtimeEnabled ? hourlyRate * formula.overtimeRateMultiplier : 0)}
            </p>
          </div>
        </div>
      </Card>

      {canEdit && (
        <div className="flex items-center gap-2">
          <Button
            disabled={!dirty || saveMutation.isPending}
            onClick={() =>
              saveMutation.mutate(
                {
                  settingId: formulaQuery.data?.settingId ?? null,
                  formula,
                  organizationId: org.id,
                },
                { onSuccess: () => setDraft(null) },
              )
            }
          >
            <Save className="mr-2 size-4" />
            Lưu công thức
          </Button>
          {dirty && (
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Hủy thay đổi
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Cấu hình lương (theo từng nhân viên)
// ---------------------------------------------------------------------------

interface EmployeeSalary {
  id: string;
  employee_id: string;
  employee_code: string;
  full_name: string;
  email: string;
  department_name: string;
  position_name: string;
  base_salary: number;
  allowance: number;
  bonus: number;
  insurance_deduction: number;
  is_active: boolean;
  employment_status: string;
}

function SalaryConfigTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<EmployeeSalary>>({});
  const { formulaQuery } = usePayrollFormula();
  const insurancePercent = formulaQuery.data?.formula.insurancePercent ?? DEFAULT_FORMULA.insurancePercent;

  const salaryQuery = useQuery({
    queryKey: ["employee-salary", filterDept, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("employees")
        .select(
          `id,
          employee_code,
          full_name,
          email,
          departments(name),
          positions(name),
          employment_status,
          salary_config(
            id,
            base_salary,
            allowance,
            bonus,
            insurance_deduction
          )`,
        )
        .is("deleted_at", null);

      if (filterStatus !== "all") {
        query = query.eq(
          "employment_status",
          filterStatus as "active" | "on_leave" | "probation" | "suspended" | "terminated",
        );
      }

      const { data: employees, error } = await query.order("full_name");
      if (error) throw error;

      return (employees || []).map((emp: any) => ({
        id: emp.id,
        employee_id: emp.id,
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        email: emp.email,
        department_name: emp.departments?.name || "N/A",
        position_name: emp.positions?.name || "N/A",
        base_salary: emp.salary_config?.base_salary || 0,
        allowance: emp.salary_config?.allowance || 0,
        bonus: emp.salary_config?.bonus || 0,
        insurance_deduction: emp.salary_config?.insurance_deduction || 0,
        is_active: emp.employment_status === "active",
        employment_status: emp.employment_status,
      }));
    },
  });

  const updateSalaryMutation = useMutation({
    mutationFn: async (salary: EmployeeSalary) => {
      const { error } = await supabase
        .from("salary_config")
        .update({
          base_salary: salary.base_salary,
          allowance: salary.allowance,
          bonus: salary.bonus,
          insurance_deduction: salary.insurance_deduction,
          updated_at: new Date().toISOString(),
        })
        .eq("employee_id", salary.employee_id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã lưu cấu hình lương");
      queryClient.invalidateQueries({ queryKey: ["employee-salary"] });
      setEditingId(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const filteredData = (salaryQuery.data || []).filter((item) => {
    const matchesSearch =
      item.full_name.toLowerCase().includes(search.toLowerCase()) ||
      item.employee_code.toLowerCase().includes(search.toLowerCase());
    const matchesDept = !filterDept || item.department_name === filterDept;
    return matchesSearch && matchesDept;
  });

  const estimatedInsurance = (salary: EmployeeSalary) =>
    salary.insurance_deduction > 0 ? salary.insurance_deduction : (salary.base_salary * insurancePercent) / 100;

  const calculateGross = (salary: EmployeeSalary) =>
    salary.base_salary + salary.allowance + salary.bonus - estimatedInsurance(salary);

  const stats = {
    totalEmployees: salaryQuery.data?.length || 0,
    totalBaseSalary: (salaryQuery.data || []).reduce((sum, emp) => sum + emp.base_salary, 0),
    totalGross: (salaryQuery.data || []).reduce((sum, emp) => sum + calculateGross(emp), 0),
  };

  return (
    <div className="space-y-6">
      <Card className="quiet-card min-w-0 border-info/25 bg-info/10 p-3 text-xs text-foreground">
        Đây là cấu hình gốc cho từng nhân viên (lương cơ bản, phụ cấp, thưởng). Các khoản trừ đi trễ/vắng mặt
        được tính tự động từ dữ liệu chấm công thực tế tại tab <strong>Tính lương</strong>, theo{" "}
        <strong>Công thức lương</strong> đã cấu hình — không nhập tay ở đây.
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="surface-card p-6">
          <p className="text-sm text-muted-foreground">Tổng Nhân Viên</p>
          <p className="text-3xl font-bold text-foreground">{stats.totalEmployees}</p>
        </Card>

        <Card className="surface-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Tổng Lương Cơ Bản</p>
              <p className="text-2xl font-bold text-foreground">
                {(stats.totalBaseSalary / 1000000).toFixed(1)}M
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-lg bg-success/10 text-success">
              <TrendingUp className="size-5" />
            </div>
          </div>
        </Card>

        <Card className="surface-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Lương Gộp Dự Kiến (chưa gồm chấm công)</p>
              <p className="text-2xl font-bold text-foreground">
                {(stats.totalGross / 1000000).toFixed(1)}M
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <TrendingDown className="size-5" />
            </div>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="min-w-64 flex-1">
          <Input
            placeholder="Tìm theo tên hoặc mã nhân viên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Chọn phòng ban" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tất cả phòng ban</SelectItem>
            {(departments.data || []).map((dept) => (
              <SelectItem key={dept.id} value={dept.name}>
                {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="active">Đang làm việc</SelectItem>
            <SelectItem value="probation">Thử việc</SelectItem>
            <SelectItem value="suspended">Tạm ngưng</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {salaryQuery.isLoading ? (
        <LoadingState rows={5} />
      ) : salaryQuery.isError ? (
        <ErrorState description={(salaryQuery.error as Error).message} />
      ) : filteredData.length === 0 ? (
        <EmptyState title="Không tìm thấy nhân viên" />
      ) : (
        <div className="quiet-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Mã NV</TableHead>
                  <TableHead>Tên Nhân Viên</TableHead>
                  <TableHead>Phòng Ban</TableHead>
                  <TableHead className="text-right">Lương Cơ Bản</TableHead>
                  <TableHead className="text-right">Phụ Cấp</TableHead>
                  <TableHead className="text-right">Thưởng</TableHead>
                  <TableHead className="text-right">Bảo hiểm (ghi đè, 0 = tự động)</TableHead>
                  <TableHead className="text-right">Lương Gộp Dự Kiến</TableHead>
                  <TableHead className="w-24">Thao Tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((salary) => (
                  <TableRow key={salary.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-sm font-semibold">
                      {salary.employee_code}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{salary.full_name}</p>
                        <p className="text-sm text-muted-foreground">{salary.position_name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{salary.department_name}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === salary.id ? (
                        <Input
                          type="number"
                          value={editData.base_salary ?? salary.base_salary}
                          onChange={(e) =>
                            setEditData({ ...editData, base_salary: Number(e.target.value) })
                          }
                          className="w-28 text-right"
                        />
                      ) : (
                        <span className="font-semibold">
                          {salary.base_salary.toLocaleString("vi-VN")}đ
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === salary.id ? (
                        <Input
                          type="number"
                          value={editData.allowance ?? salary.allowance}
                          onChange={(e) =>
                            setEditData({ ...editData, allowance: Number(e.target.value) })
                          }
                          className="w-24 text-right"
                        />
                      ) : (
                        <span className="font-medium text-success">
                          +{salary.allowance.toLocaleString("vi-VN")}đ
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === salary.id ? (
                        <Input
                          type="number"
                          value={editData.bonus ?? salary.bonus}
                          onChange={(e) =>
                            setEditData({ ...editData, bonus: Number(e.target.value) })
                          }
                          className="w-24 text-right"
                        />
                      ) : (
                        <span className="font-medium text-success">
                          +{salary.bonus.toLocaleString("vi-VN")}đ
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === salary.id ? (
                        <Input
                          type="number"
                          value={editData.insurance_deduction ?? salary.insurance_deduction}
                          onChange={(e) =>
                            setEditData({ ...editData, insurance_deduction: Number(e.target.value) })
                          }
                          className="w-28 text-right"
                        />
                      ) : salary.insurance_deduction > 0 ? (
                        <span className="font-medium text-destructive">
                          -{salary.insurance_deduction.toLocaleString("vi-VN")}đ
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Tự động ({insurancePercent}%)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-primary">
                        {calculateGross(
                          editingId === salary.id ? { ...salary, ...editData } : salary,
                        ).toLocaleString("vi-VN")}
                        đ
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {editingId === salary.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                updateSalaryMutation.mutate({ ...salary, ...editData });
                              }}
                              disabled={updateSalaryMutation.isPending}
                            >
                              <Save className="size-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                              <X className="size-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(salary.id);
                              setEditData(salary);
                            }}
                          >
                            <Edit className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Tính lương
// ---------------------------------------------------------------------------

interface PayrollData {
  id: string;
  employee_id: string;
  employee_code: string;
  full_name: string;
  department_name: string;
  month: number;
  year: number;
  worked_days: number;
  late_days: number;
  late_minutes: number;
  absent_days: number;
  overtime_minutes: number;
  base_salary: number;
  allowance: number;
  bonus: number;
  overtime_pay: number;
  commission_revenue: number;
  commission_pay: number;
  gross_salary: number;
  late_deduction: number;
  absence_deduction: number;
  insurance: number;
  tax: number;
  net_salary: number;
  status: "pending" | "calculated" | "approved" | "paid";
}

function PayrollTab() {
  const { org } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [printTarget, setPrintTarget] = useState<PayrollData | null>(null);
  const { formulaQuery } = usePayrollFormula();
  const formula = formulaQuery.data?.formula ?? DEFAULT_FORMULA;

  const printTable = () => {
    setPrintTarget(null);
    setTimeout(() => window.print(), 50);
  };

  const printPayslip = (payroll: PayrollData) => {
    setPrintTarget(payroll);
    setTimeout(() => {
      window.print();
      setPrintTarget(null);
    }, 50);
  };

  const payrollQuery = useQuery({
    queryKey: ["payroll", selectedMonth, selectedYear, JSON.stringify(formula)],
    enabled: !formulaQuery.isLoading,
    queryFn: async () => {
      const startDate = new Date(selectedYear, selectedMonth - 1, 1);
      const endDate = new Date(selectedYear, selectedMonth, 0);
      const startStr = startDate.toISOString().split("T")[0]!;
      const endStr = endDate.toISOString().split("T")[0]!;

      const [
        { data: attendanceData, error: attendanceError },
        { data: doctorsData, error: doctorsError },
        { data: revenueData, error: revenueError },
      ] = await Promise.all([
        supabase
          .from("attendance_records")
          .select(
            `id,
            employee_id,
            employees(id, employee_code, full_name, departments(name), salary_config(base_salary, allowance, bonus, insurance_deduction)),
            attendance_status,
            late_minutes,
            overtime_minutes`,
          )
          .gte("work_date", startStr)
          .lte("work_date", endStr),
        supabase
          .from("employees")
          .select(
            "id, employee_code, full_name, departments(name), salary_config(base_salary, allowance, bonus, insurance_deduction)",
          )
          .eq("can_receive_appointments", true)
          .is("deleted_at", null),
        supabase
          .from("appointments")
          .select("assigned_dentist_id, total_amount")
          .eq("status", "completed")
          .gte("appointment_date", startStr)
          .lte("appointment_date", endStr),
      ]);

      if (attendanceError) throw attendanceError;
      if (doctorsError) throw doctorsError;
      if (revenueError) throw revenueError;

      const revenueMap = new Map<string, number>();
      (revenueData ?? []).forEach((row) => {
        if (!row.assigned_dentist_id) return;
        revenueMap.set(row.assigned_dentist_id, (revenueMap.get(row.assigned_dentist_id) ?? 0) + (row.total_amount || 0));
      });

      const dailyRateOf = (base: number) => base / (formula.standardWorkDays || 1);
      const hourlyRateOf = (base: number) => dailyRateOf(base) / (formula.standardWorkHoursPerDay || 1);

      const payrollMap = new Map<string, PayrollData>();

      const emptyPayrollFor = (employee: {
        id: string;
        employee_code: string | null;
        full_name: string | null;
        departments: { name: string } | null;
        salary_config: { base_salary: number; allowance: number; bonus: number; insurance_deduction: number } | null;
      }): PayrollData => ({
        id: employee.id,
        employee_id: employee.id,
        employee_code: employee.employee_code || "",
        full_name: employee.full_name || "",
        department_name: employee.departments?.name || "Chưa phân bổ",
        month: selectedMonth,
        year: selectedYear,
        worked_days: 0,
        late_days: 0,
        late_minutes: 0,
        absent_days: 0,
        overtime_minutes: 0,
        base_salary: employee.salary_config?.base_salary || 0,
        allowance: formula.includeAllowance ? employee.salary_config?.allowance || 0 : 0,
        bonus: formula.includeBonus ? employee.salary_config?.bonus || 0 : 0,
        overtime_pay: 0,
        commission_revenue: 0,
        commission_pay: 0,
        gross_salary: 0,
        late_deduction: 0,
        absence_deduction: 0,
        insurance: employee.salary_config?.insurance_deduction || 0,
        tax: 0,
        net_salary: 0,
        status: "calculated",
      });

      // Bác sĩ nhận lịch hẹn luôn xuất hiện trong bảng lương (để tính hoa hồng đúng)
      // ngay cả khi tháng đó chưa có bản ghi chấm công.
      (doctorsData ?? []).forEach((doctor: any) => {
        payrollMap.set(doctor.id, emptyPayrollFor(doctor));
      });

      (attendanceData || []).forEach((record: any) => {
        const key = record.employee_id;
        if (!payrollMap.has(key)) {
          payrollMap.set(key, emptyPayrollFor({ id: key, ...record.employees }));
        }

        const payroll = payrollMap.get(key)!;

        if (record.attendance_status === "absent") {
          payroll.absent_days++;
        } else if (
          record.attendance_status === "leave" ||
          record.attendance_status === "sick" ||
          record.attendance_status === "holiday"
        ) {
          payroll.worked_days++;
        } else {
          payroll.worked_days++;
          const lateMinutes = record.late_minutes || 0;
          if (lateMinutes > formula.lateGraceMinutes) {
            payroll.late_days++;
            payroll.late_minutes += lateMinutes;
          }
          payroll.overtime_minutes += record.overtime_minutes || 0;
        }
      });

      payrollMap.forEach((payroll) => {
        const dailyRate = dailyRateOf(payroll.base_salary);
        const hourlyRate = hourlyRateOf(payroll.base_salary);

        if (formula.lateDeductionMode === "per_minute") {
          payroll.late_deduction = payroll.late_minutes * (hourlyRate / 60);
        } else if (formula.lateDeductionMode === "per_occurrence") {
          payroll.late_deduction = payroll.late_days * formula.lateOccurrencePenaltyDays * dailyRate;
        }

        if (formula.absenceDeductionMode === "daily_rate") {
          payroll.absence_deduction = payroll.absent_days * dailyRate;
        }

        if (formula.overtimeEnabled) {
          payroll.overtime_pay = (payroll.overtime_minutes / 60) * hourlyRate * formula.overtimeRateMultiplier;
        }

        if (formula.commissionEnabled) {
          payroll.commission_revenue = revenueMap.get(payroll.employee_id) ?? 0;
          payroll.commission_pay = (payroll.commission_revenue * formula.commissionPercent) / 100;
        }

        // insurance_deduction đã set sẵn = ghi đè theo nhân viên (nếu > 0); nếu không thì tính theo %.
        payroll.insurance =
          payroll.insurance > 0 ? payroll.insurance : (payroll.base_salary * formula.insurancePercent) / 100;

        payroll.gross_salary =
          payroll.base_salary + payroll.allowance + payroll.bonus + payroll.overtime_pay + payroll.commission_pay;

        if (formula.taxEnabled) {
          const taxableIncome = Math.max(0, payroll.gross_salary - payroll.insurance - formula.personalDeductionAmount);
          payroll.tax = calculatePersonalIncomeTax(taxableIncome);
        }

        payroll.net_salary =
          payroll.gross_salary -
          payroll.late_deduction -
          payroll.absence_deduction -
          payroll.insurance -
          payroll.tax;
      });

      // Bảng lương đã duyệt trước đó (payroll_records) phải phản ánh đúng trạng thái —
      // nếu không, nút "Duyệt" sẽ luôn hiện lại sau khi tải lại trang dù đã duyệt rồi.
      const { data: approvedRecords, error: approvedError } = await supabase
        .from("payroll_records")
        .select("employee_id, status")
        .eq("month", selectedMonth)
        .eq("year", selectedYear);
      if (approvedError) throw approvedError;

      const statusMap = new Map((approvedRecords ?? []).map((row) => [row.employee_id, row.status]));
      payrollMap.forEach((payroll) => {
        const savedStatus = statusMap.get(payroll.employee_id);
        if (savedStatus) payroll.status = savedStatus as PayrollData["status"];
      });

      return Array.from(payrollMap.values());
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (payrollData: PayrollData) => {
      const { error } = await supabase.from("payroll_records").upsert(
        [
          {
            employee_id: payrollData.employee_id,
            month: payrollData.month,
            year: payrollData.year,
            worked_days: payrollData.worked_days,
            late_days: payrollData.late_days,
            late_minutes: payrollData.late_minutes,
            absent_days: payrollData.absent_days,
            overtime_minutes: payrollData.overtime_minutes,
            base_salary: payrollData.base_salary,
            allowance: payrollData.allowance,
            bonus: payrollData.bonus,
            overtime_pay: payrollData.overtime_pay,
            commission_revenue: payrollData.commission_revenue,
            commission_pay: payrollData.commission_pay,
            gross_salary: payrollData.gross_salary,
            late_deduction: payrollData.late_deduction,
            absence_deduction: payrollData.absence_deduction,
            insurance: payrollData.insurance,
            tax: payrollData.tax,
            net_salary: payrollData.net_salary,
            status: "approved",
            approved_at: new Date().toISOString(),
          },
        ],
        { onConflict: "employee_id,month,year" },
      );

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã duyệt bảng lương");
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const departmentOptions = Array.from(
    new Set((payrollQuery.data ?? []).map((item) => item.department_name)),
  ).sort();

  const filteredPayroll = (payrollQuery.data || []).filter((item) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      item.full_name.toLowerCase().includes(term) ||
      item.employee_code.toLowerCase().includes(term);
    const matchesDept = filterDept === "all" || item.department_name === filterDept;
    const matchesStatus = filterStatus === "all" || item.status === filterStatus;
    return matchesSearch && matchesDept && matchesStatus;
  });

  const stats = {
    totalEmployees: filteredPayroll.length,
    totalGross: filteredPayroll.reduce((sum, p) => sum + p.gross_salary, 0),
    totalDeductions: filteredPayroll.reduce(
      (sum, p) => sum + p.late_deduction + p.absence_deduction + p.insurance,
      0,
    ),
    totalNetSalary: filteredPayroll.reduce((sum, p) => sum + p.net_salary, 0),
  };



  return (
    <>
      <div className="space-y-6 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <SelectItem key={m} value={m.toString()}>
                  Tháng {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  Năm {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={printTable} disabled={filteredPayroll.length === 0}>
            <Printer className="mr-2 size-4" />
            In bảng lương
          </Button>
          <ExportButton
            data={filteredPayroll.map((r) => ({
              ...r,
              net_salary_formatted: Math.round(r.net_salary).toLocaleString("vi-VN") + "đ",
              gross_salary_formatted: Math.round(r.gross_salary).toLocaleString("vi-VN") + "đ",
              status_label: r.status === "approved" ? "Đã duyệt" : "Chưa duyệt",
            }))}
            columns={[
              { header: "Mã NV", key: "employee_code", width: 10 },
              { header: "Họ và tên", key: "full_name", width: 20 },
              { header: "Ngày công", key: "worked_days", width: 10 },
              { header: "Lương gộp", key: "gross_salary_formatted", width: 15 },
              { header: "Thực lãnh", key: "net_salary_formatted", width: 15 },
              { header: "Trạng thái", key: "status_label", width: 15 },
            ]}
            filename={`Bang_luong_thang_${selectedMonth}_${selectedYear}`}
            title={`Bảng Lương Tháng ${selectedMonth}/${selectedYear}`}
            disabled={filteredPayroll.length === 0}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="surface-card p-4">
            <p className="text-sm text-muted-foreground">Tổng Nhân Viên</p>
            <p className="text-2xl font-bold text-foreground">{stats.totalEmployees}</p>
          </Card>

          <Card className="surface-card p-4">
            <p className="text-sm text-muted-foreground">Tổng Lương Gộp</p>
            <p className="text-xl font-bold text-success">{(stats.totalGross / 1000000).toFixed(1)}M</p>
          </Card>

          <Card className="surface-card p-4">
            <p className="text-sm text-muted-foreground">Tổng Trừ Lương</p>
            <p className="text-xl font-bold text-destructive">
              {(stats.totalDeductions / 1000000).toFixed(2)}M
            </p>
          </Card>

          <Card className="surface-card p-4">
            <p className="text-sm text-muted-foreground">Tổng Lương Thực</p>
            <p className="text-xl font-bold text-primary">
              {(stats.totalNetSalary / 1000000).toFixed(1)}M
            </p>
          </Card>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="min-w-56 flex-1">
            <Input
              placeholder="Tìm theo tên hoặc mã nhân viên..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Phòng ban" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả phòng ban</SelectItem>
              {departmentOptions.map((dept) => (
                <SelectItem key={dept} value={dept}>
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Trạng thái duyệt" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              <SelectItem value="calculated">Chưa duyệt</SelectItem>
              <SelectItem value="approved">Đã duyệt</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {payrollQuery.isLoading ? (
          <LoadingState rows={5} />
        ) : payrollQuery.isError ? (
          <ErrorState description={(payrollQuery.error as Error).message} />
        ) : filteredPayroll.length === 0 ? (
          <EmptyState title="Không có dữ liệu chấm công" />
        ) : (
          <div className="quiet-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Mã NV</TableHead>
                    <TableHead>Tên Nhân Viên</TableHead>
                    <TableHead>Phòng ban</TableHead>
                    <TableHead className="text-center">Công</TableHead>
                    <TableHead className="text-center">Trễ</TableHead>
                    <TableHead className="text-center">Vắng</TableHead>
                    <TableHead className="text-center">Tăng ca</TableHead>
                    <TableHead className="text-right">Lương CB</TableHead>
                    <TableHead className="text-right">Phụ cấp+Thưởng</TableHead>
                    <TableHead className="text-right">Lương tăng ca</TableHead>
                    <TableHead className="text-right">Hoa hồng</TableHead>
                    <TableHead className="text-right">Trừ đi trễ</TableHead>
                    <TableHead className="text-right">Trừ vắng</TableHead>
                    <TableHead className="text-right">Bảo hiểm</TableHead>
                    <TableHead className="text-right">Thuế TNCN</TableHead>
                    <TableHead className="text-right">Lương Thực</TableHead>
                    <TableHead className="w-32">Trạng Thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayroll.map((payroll) => (
                    <TableRow key={payroll.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm font-semibold">
                        {payroll.employee_code}
                      </TableCell>
                      <TableCell className="font-medium">{payroll.full_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{payroll.department_name}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{payroll.worked_days} ngày</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {payroll.late_days > 0 ? (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                            {payroll.late_days} lần
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {payroll.absent_days > 0 ? (
                          <Badge variant="destructive">{payroll.absent_days} ngày</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {payroll.overtime_minutes > 0 ? (
                          <Badge variant="secondary" className="bg-sky-100 text-sky-800">
                            {(payroll.overtime_minutes / 60).toFixed(1)}h
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {payroll.base_salary.toLocaleString("vi-VN")}đ
                      </TableCell>
                      <TableCell className="text-right">
                        {payroll.allowance + payroll.bonus > 0 ? (
                          <span className="font-medium text-success">
                            +{(payroll.allowance + payroll.bonus).toLocaleString("vi-VN")}đ
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {payroll.overtime_pay > 0 ? (
                          <span className="font-medium text-info">
                            +{Math.round(payroll.overtime_pay).toLocaleString("vi-VN")}đ
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {payroll.commission_pay > 0 ? (
                          <span className="font-medium text-success" title={`Doanh thu: ${Math.round(payroll.commission_revenue).toLocaleString("vi-VN")}đ`}>
                            +{Math.round(payroll.commission_pay).toLocaleString("vi-VN")}đ
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {payroll.late_deduction > 0 ? (
                          <span className="font-medium text-destructive">
                            -{Math.round(payroll.late_deduction).toLocaleString("vi-VN")}đ
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {payroll.absence_deduction > 0 ? (
                          <span className="font-medium text-destructive">
                            -{Math.round(payroll.absence_deduction).toLocaleString("vi-VN")}đ
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium text-destructive">
                          -{Math.round(payroll.insurance).toLocaleString("vi-VN")}đ
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {payroll.tax > 0 ? (
                          <span className="font-medium text-destructive">
                            -{Math.round(payroll.tax).toLocaleString("vi-VN")}đ
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-primary">
                          {Math.round(payroll.net_salary).toLocaleString("vi-VN")}đ
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => approveMutation.mutate(payroll)}
                            disabled={approveMutation.isPending || payroll.status === "approved"}
                          >
                            <CheckCircle className="mr-1 size-4" />
                            {payroll.status === "approved" ? "Đã duyệt" : "Duyệt"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="In phiếu lương"
                            onClick={() => printPayslip(payroll)}
                          >
                            <Printer className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      <div className="hidden print:block">
        {printTarget ? (
          <PayslipPrint clinicName={org.name} payroll={printTarget} standardWorkDays={formula.standardWorkDays} />
        ) : (
          <PayrollTablePrint
            clinicName={org.name}
            month={selectedMonth}
            year={selectedYear}
            rows={filteredPayroll}
            filterDept={filterDept}
            filterStatus={filterStatus}
          />
        )}
      </div>
    </>
  );
}

function PayrollTablePrint({
  clinicName,
  month,
  year,
  rows,
  filterDept,
  filterStatus,
}: {
  clinicName: string;
  month: number;
  year: number;
  rows: PayrollData[];
  filterDept: string;
  filterStatus: string;
}) {
  const totalNet = rows.reduce((sum, r) => sum + r.net_salary, 0);
  const filterLabel = [
    filterDept === "all" ? "Tất cả phòng ban" : `Phòng ban: ${filterDept}`,
    filterStatus === "all"
      ? "Tất cả trạng thái"
      : `Trạng thái: ${filterStatus === "approved" ? "Đã duyệt" : "Chưa duyệt"}`,
  ].join(" · ");
  return (
    <div className="p-8 text-black">
      <h1 className="text-xl font-bold">{clinicName}</h1>
      <h2 className="mt-1 text-lg font-semibold">
        BẢNG LƯƠNG THÁNG {month}/{year}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">Bộ lọc áp dụng: {filterLabel}</p>
      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="py-1 text-left">Mã NV</th>
            <th className="py-1 text-left">Họ tên</th>
            <th className="py-1 text-left">Phòng ban</th>
            <th className="py-1 text-right">Công</th>
            <th className="py-1 text-right">Trễ</th>
            <th className="py-1 text-right">Vắng</th>
            <th className="py-1 text-right">OT (h)</th>
            <th className="py-1 text-right">Lương CB</th>
            <th className="py-1 text-right">PC+Thưởng</th>
            <th className="py-1 text-right">Tăng ca</th>
            <th className="py-1 text-right">Hoa hồng</th>
            <th className="py-1 text-right">Trừ</th>
            <th className="py-1 text-right">Thuế</th>
            <th className="py-1 text-right">Thực lãnh</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-gray-300">
              <td className="py-1">{r.employee_code}</td>
              <td className="py-1">{r.full_name}</td>
              <td className="py-1">{r.department_name}</td>
              <td className="py-1 text-right">{r.worked_days}</td>
              <td className="py-1 text-right">{r.late_days}</td>
              <td className="py-1 text-right">{r.absent_days}</td>
              <td className="py-1 text-right">{(r.overtime_minutes / 60).toFixed(1)}</td>
              <td className="py-1 text-right">{money(r.base_salary)}</td>
              <td className="py-1 text-right">{money(r.allowance + r.bonus)}</td>
              <td className="py-1 text-right">{money(r.overtime_pay)}</td>
              <td className="py-1 text-right">{money(r.commission_pay)}</td>
              <td className="py-1 text-right">
                {money(r.late_deduction + r.absence_deduction + r.insurance)}
              </td>
              <td className="py-1 text-right">{money(r.tax)}</td>
              <td className="py-1 text-right font-semibold">{money(r.net_salary)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-black font-bold">
            <td colSpan={13} className="py-2 text-right">
              Tổng thực lãnh
            </td>
            <td className="py-2 text-right">{money(totalNet)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-10 text-right text-sm">Ngày in: {new Date().toLocaleDateString("vi-VN")}</p>
    </div>
  );
}

function PayslipPrint({
  clinicName,
  payroll,
  standardWorkDays,
}: {
  clinicName: string;
  payroll: PayrollData;
  standardWorkDays: number;
}) {
  return (
    <div className="p-8 text-black">
      <h1 className="text-xl font-bold">{clinicName}</h1>
      <h2 className="mt-1 text-lg font-semibold">
        PHIẾU LƯƠNG THÁNG {payroll.month}/{payroll.year}
      </h2>

      <div className="mt-6 space-y-1 text-sm">
        <p>
          <span className="font-medium">Mã nhân viên:</span> {payroll.employee_code}
        </p>
        <p>
          <span className="font-medium">Họ và tên:</span> {payroll.full_name}
        </p>
        <p>
          <span className="font-medium">Ngày công chuẩn:</span> {standardWorkDays} ngày
        </p>
      </div>

      <table className="mt-6 w-full border-collapse text-sm">
        <tbody>
          <tr className="border-b border-gray-300">
            <td className="py-1.5">Số ngày công thực tế</td>
            <td className="py-1.5 text-right">{payroll.worked_days} ngày</td>
          </tr>
          <tr className="border-b border-gray-300">
            <td className="py-1.5">Số lần đi trễ</td>
            <td className="py-1.5 text-right">{payroll.late_days} lần ({payroll.late_minutes} phút)</td>
          </tr>
          <tr className="border-b border-gray-300">
            <td className="py-1.5">Số ngày vắng mặt</td>
            <td className="py-1.5 text-right">{payroll.absent_days} ngày</td>
          </tr>
          <tr className="border-b border-gray-300">
            <td className="py-1.5">Số giờ tăng ca</td>
            <td className="py-1.5 text-right">{(payroll.overtime_minutes / 60).toFixed(1)} giờ</td>
          </tr>
          <tr className="border-b border-gray-300">
            <td className="py-1.5">Lương cơ bản</td>
            <td className="py-1.5 text-right">{money(payroll.base_salary)}</td>
          </tr>
          <tr className="border-b border-gray-300">
            <td className="py-1.5">Phụ cấp</td>
            <td className="py-1.5 text-right">+{money(payroll.allowance)}</td>
          </tr>
          <tr className="border-b border-gray-300">
            <td className="py-1.5">Thưởng</td>
            <td className="py-1.5 text-right">+{money(payroll.bonus)}</td>
          </tr>
          <tr className="border-b border-gray-300">
            <td className="py-1.5">Lương tăng ca</td>
            <td className="py-1.5 text-right">+{money(payroll.overtime_pay)}</td>
          </tr>
          {payroll.commission_pay > 0 && (
            <tr className="border-b border-gray-300">
              <td className="py-1.5">
                Hoa hồng ({payroll.commission_revenue > 0 ? `${money(payroll.commission_revenue)} doanh thu` : ""})
              </td>
              <td className="py-1.5 text-right">+{money(payroll.commission_pay)}</td>
            </tr>
          )}
          <tr className="border-b border-gray-300 font-semibold">
            <td className="py-1.5">Lương gộp</td>
            <td className="py-1.5 text-right">{money(payroll.gross_salary)}</td>
          </tr>
          <tr className="border-b border-gray-300">
            <td className="py-1.5">Trừ đi trễ</td>
            <td className="py-1.5 text-right">-{money(payroll.late_deduction)}</td>
          </tr>
          <tr className="border-b border-gray-300">
            <td className="py-1.5">Trừ vắng mặt</td>
            <td className="py-1.5 text-right">-{money(payroll.absence_deduction)}</td>
          </tr>
          <tr className="border-b border-gray-300">
            <td className="py-1.5">Bảo hiểm</td>
            <td className="py-1.5 text-right">-{money(payroll.insurance)}</td>
          </tr>
          {payroll.tax > 0 && (
            <tr className="border-b border-gray-300">
              <td className="py-1.5">Thuế TNCN</td>
              <td className="py-1.5 text-right">-{money(payroll.tax)}</td>
            </tr>
          )}
          <tr className="border-t-2 border-black font-bold">
            <td className="py-2">Thực lãnh</td>
            <td className="py-2 text-right">{money(payroll.net_salary)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-16 grid grid-cols-2 gap-8 text-center text-sm">
        <div>
          <p className="font-medium">Người lập phiếu</p>
          <p className="mt-16 text-xs text-muted-foreground">(Ký, ghi rõ họ tên)</p>
        </div>
        <div>
          <p className="font-medium">Nhân viên nhận lương</p>
          <p className="mt-16 text-xs text-muted-foreground">(Ký, ghi rõ họ tên)</p>
        </div>
      </div>

      <p className="mt-10 text-right text-sm">Ngày in: {new Date().toLocaleDateString("vi-VN")}</p>
    </div>
  );
}
