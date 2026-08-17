import { FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportToExcel, exportToPDF, exportToWord, ColumnDef } from "@/lib/export";

interface ExportButtonProps {
  data: any[];
  columns: ColumnDef[];
  filename: string;
  title: string;
  disabled?: boolean;
}

export function ExportButton({ data, columns, filename, title, disabled }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (type: "excel" | "pdf" | "word") => {
    if (!data || data.length === 0) {
      toast.error("Không có dữ liệu để xuất");
      return;
    }

    setIsExporting(true);
    try {
      if (type === "excel") {
        exportToExcel(data, columns, filename);
      } else if (type === "pdf") {
        exportToPDF(data, columns, filename, title);
      } else if (type === "word") {
        await exportToWord(data, columns, filename, title);
      }
      toast.success("Xuất file thành công");
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi xuất file");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || isExporting}>
          <FileDown className="mr-2 size-4" />
          {isExporting ? "Đang xuất..." : "Xuất dữ liệu"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("excel")}>
          <FileSpreadsheet className="mr-2 size-4 text-green-600" />
          Xuất Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf")}>
          <FileText className="mr-2 size-4 text-red-600" />
          Xuất PDF (.pdf)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("word")}>
          <FileText className="mr-2 size-4 text-blue-600" />
          Xuất Word (.docx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
