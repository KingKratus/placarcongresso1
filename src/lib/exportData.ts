import jsPDF from "jspdf";

type ExportRow = Record<string, string | number | null | undefined>;

const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const csvCell = (value: unknown) => `"${clean(value).replace(/"/g, '""')}"`;

export function downloadCsv(filename: string, rows: ExportRow[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((row) => headers.map((h) => csvCell(row[h])).join(","))].join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function addWrapped(doc: jsPDF, text: string, x: number, y: number, width: number, lineHeight = 6) {
  const lines = doc.splitTextToSize(clean(text), width);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function addBarChart(doc: jsPDF, title: string, data: { label: string; value: number }[], x: number, y: number, width: number) {
  doc.setFont("helvetica", "bold");
  doc.text(title, x, y);
  const max = Math.max(1, ...data.map((d) => d.value));
  let cy = y + 8;
  data.slice(0, 8).forEach((d, i) => {
    const barWidth = Math.max(3, (d.value / max) * (width - 55));
    doc.setFillColor(i % 2 ? 59 : 15, i % 2 ? 130 : 23, i % 2 ? 246 : 42);
    doc.rect(x + 42, cy - 4, barWidth, 4, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(clean(d.label).slice(0, 18), x, cy);
    doc.text(String(d.value), x + 45 + barWidth, cy);
    cy += 7;
  });
  return cy + 2;
}

export function downloadPdfReport(params: { title: string; subtitle?: string; insights: string[]; charts?: { title: string; data: { label: string; value: number }[] }[]; rows?: ExportRow[]; filename: string; }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  const width = 182;
  let y = 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  y = addWrapped(doc, params.title, margin, y, width, 8) + 2;
  if (params.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    y = addWrapped(doc, params.subtitle, margin, y, width, 5) + 4;
  }
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Insights", margin, y); y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  params.insights.forEach((insight) => { y = addWrapped(doc, `• ${insight}`, margin, y, width, 5) + 2; });
  (params.charts || []).forEach((chart) => {
    if (y > 230) { doc.addPage(); y = 18; }
    doc.setFontSize(10);
    y = addBarChart(doc, chart.title, chart.data, margin, y + 4, width) + 4;
  });
  if (params.rows?.length) {
    if (y > 210) { doc.addPage(); y = 18; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Registros principais", margin, y); y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    params.rows.slice(0, 30).forEach((row, i) => {
      if (y > 282) { doc.addPage(); y = 18; }
      const text = Object.values(row).map(clean).filter(Boolean).join(" · ");
      y = addWrapped(doc, `${i + 1}. ${text}`, margin, y, width, 4.5) + 1;
    });
  }
  doc.save(params.filename.endsWith(".pdf") ? params.filename : `${params.filename}.pdf`);
}