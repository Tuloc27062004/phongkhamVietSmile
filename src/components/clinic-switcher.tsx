import { useState } from "react";
import { Building2, Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSuperAdminClinics, useSwitchClinic } from "@/hooks/use-switch-clinic";
import { cn } from "@/lib/utils";

/** Super Admin-only clinic workspace switcher. Renders nothing for non-super-admins. */
export function ClinicSwitcher({
  isSuperAdmin,
  currentSlug,
  currentSubpath,
}: {
  isSuperAdmin: boolean;
  currentSlug: string;
  currentSubpath: string;
}) {
  const [open, setOpen] = useState(false);
  const clinicsQuery = useSuperAdminClinics(isSuperAdmin);
  const switchClinic = useSwitchClinic();

  if (!isSuperAdmin) return null;

  const clinics = clinicsQuery.data ?? [];
  const current = clinics.find((c) => c.is_active_workspace);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className="max-w-[220px] justify-between gap-2 text-xs"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{current?.name ?? "Chọn phòng khám"}</span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Tìm phòng khám..." />
          <CommandList>
            <CommandEmpty>Không tìm thấy phòng khám.</CommandEmpty>
            <CommandGroup>
              {clinics.map((clinic) => (
                <CommandItem
                  key={clinic.id}
                  value={clinic.name}
                  onSelect={() => {
                    setOpen(false);
                    if (clinic.slug !== currentSlug) {
                      switchClinic.mutate({ slug: clinic.slug, subpath: currentSubpath });
                    }
                  }}
                >
                  <Check
                    className={cn(
                      "size-4",
                      clinic.slug === currentSlug ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex-1 truncate">{clinic.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {clinic.clinic_category_label}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
