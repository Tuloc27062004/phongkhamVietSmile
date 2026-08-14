import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSwitchClinic } from "@/hooks/use-switch-clinic";
import { supabase } from "@/integrations/supabase/client";

const CLINIC_CATEGORIES = [
  { value: "dental", icon: "🦷", label: "Nha Khoa" },
  { value: "general", icon: "🏥", label: "Phòng Khám Đa Khoa" },
  { value: "obgyn", icon: "👶", label: "Sản - Phụ Khoa" },
  { value: "pediatrics", icon: "🧸", label: "Nhi Khoa" },
  { value: "dermatology", icon: "✨", label: "Da Liễu" },
  { value: "ophthalmology", icon: "👁️", label: "Mắt" },
  { value: "ent", icon: "👂", label: "Tai Mũi Họng" },
  { value: "aesthetics", icon: "💄", label: "Thẩm Mỹ" },
  { value: "rehab", icon: "🦾", label: "Vật Lý Trị Liệu" },
  { value: "hospital", icon: "🏬", label: "Bệnh Viện / Cơ Sở Y Tế" },
] as const;

const COMBINING_DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Super Admin-only dialog to create a new clinic tenant by specialty, then switch straight into it. */
export function CreateClinicDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [category, setCategory] = useState<string>("general");
  const queryClient = useQueryClient();
  const switchClinic = useSwitchClinic();

  const createClinic = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("super_admin_create_clinic", {
        p_name: name.trim(),
        p_slug: (slugTouched ? slug : slugify(name)).trim(),
        p_clinic_category: category,
      });
      if (error) throw error;
      return data?.[0];
    },
    onSuccess: (created) => {
      if (!created) return;
      toast.success(`Đã tạo phòng khám "${name}" thành công!`);
      void queryClient.invalidateQueries({ queryKey: ["super-admin-clinics-taxonomy"] });
      setOpen(false);
      setName("");
      setSlug("");
      setSlugTouched(false);
      setCategory("general");
      switchClinic.mutate({ slug: created.slug, subpath: "/admin/dashboard" });
    },
    onError: (err: Error) => {
      toast.error(`Không thể tạo phòng khám: ${err.message}`);
    },
  });

  const effectiveSlug = slugTouched ? slug : slugify(name);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="mr-1 size-4" /> Thêm Phòng Khám Chi Nhánh Mới
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo phòng khám mới</DialogTitle>
          <DialogDescription>
            Tạo nhanh một phòng khám/chi nhánh mới theo loại hình chuyên khoa. Sau khi tạo, bạn sẽ
            được chuyển thẳng vào không gian làm việc của phòng khám đó.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="clinic-name">Tên phòng khám</Label>
            <Input
              id="clinic-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Phòng Khám Đa Khoa An Bình"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clinic-slug">Slug (đường dẫn URL)</Label>
            <Input
              id="clinic-slug"
              value={effectiveSlug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(slugify(event.target.value));
              }}
              placeholder="da-khoa-an-binh"
            />
            <p className="text-xs text-muted-foreground">
              Truy cập tại: <code>/{effectiveSlug || "..."}/dashboard</code>
            </p>
          </div>

          <div className="space-y-2">
            <Label>Loại hình chuyên khoa</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn chuyên khoa..." />
              </SelectTrigger>
              <SelectContent>
                {CLINIC_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <span className="mr-1.5">{cat.icon}</span>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() => createClinic.mutate()}
            disabled={!name.trim() || !effectiveSlug || createClinic.isPending}
          >
            {createClinic.isPending ? "Đang tạo..." : "Tạo phòng khám"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
