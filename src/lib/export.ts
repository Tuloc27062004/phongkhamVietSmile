import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export type ColumnDef = {
  header: string;
  key: string;
  width?: number; // approx width for PDF/Docx
};

/**
 * Xuất dữ liệu ra file Excel (.xlsx)
 */
export function exportToExcel(data: any[], columns: ColumnDef[], filename: string) {
  // Map data to match column headers
  const exportData = data.map((item) => {
    const row: Record<string, any> = {};
    columns.forEach((col) => {
      row[col.header] = item[col.key];
    });
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  // Format headers
  const colWidths = columns.map((col) => ({
    wch: Math.max(col.header.length, 10) + 5,
  }));
  worksheet["!cols"] = colWidths;

  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Xuất dữ liệu ra file PDF (.pdf)
 */
export function exportToPDF(data: any[], columns: ColumnDef[], filename: string, title: string) {
  // Use jsPDF
  const doc = new jsPDF("p", "pt", "a4");

  // Add a font that supports Vietnamese (fallback to basic for now, for real production you need addFileToVFS with Roboto-Regular.ttf)
  // For basic support, we will just use helvetica but it might strip accents if not embedded properly.
  doc.setFont("helvetica");

  doc.setFontSize(16);
  doc.text(title, 40, 40);

  const tableColumn = columns.map((col) => col.header);
  const tableRows = data.map((item) => columns.map((col) => {
      const val = item[col.key];
      return val === null || val === undefined ? "" : String(val);
  }));

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 60,
    styles: { font: "helvetica", fontSize: 10 },
    headStyles: { fillColor: [65, 105, 225] },
  });

  doc.save(`${filename}.pdf`);
}

/**
 * Xuất dữ liệu ra file Word (.docx)
 */
export async function exportToWord(data: any[], columns: ColumnDef[], filename: string, title: string) {
  const tableRows = [
    // Header Row
    new TableRow({
      children: columns.map(
        (col) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: col.header, bold: true })] })],
            width: { size: col.width || 100 / columns.length, type: WidthType.PERCENTAGE },
          })
      ),
    }),
    // Data Rows
    ...data.map(
      (item) =>
        new TableRow({
          children: columns.map(
            (col) => {
              const val = item[col.key];
              return new TableCell({
                children: [new Paragraph({ text: val === null || val === undefined ? "" : String(val) })],
              });
            }
          ),
        })
    ),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: title,
                bold: true,
                size: 28,
              }),
            ],
            spacing: { after: 400 },
          }),
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
}
