import type { AnalyticsReportExportOptions, AnalyticsReportRow } from "./xlsx-report";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const STA_RITA_ICON_PATH = "/images/Sta Rita Icon.png";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPdfDate(entry: AnalyticsReportRow): string {
  if (entry.readingDate) {
    const date = new Date(`${entry.readingDate}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-PH", {
        timeZone: "Asia/Manila",
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
    }
  }

  return new Date(entry.recordedAt).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatPdfTime(entry: AnalyticsReportRow): string {
  if (entry.readingTime) {
    const date = new Date(`2000-01-01T${entry.readingTime}`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString("en-PH", {
        timeZone: "Asia/Manila",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
  }

  return new Date(entry.recordedAt).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function buildAnalyticsReportPdfHtml(options: AnalyticsReportExportOptions): string {
  const rowsHtml =
    options.rows.length > 0
      ? options.rows
          .map(
            (entry) => `
              <tr>
                <td>${escapeHtml(formatPdfDate(entry))}</td>
                <td>${escapeHtml(formatPdfTime(entry))}</td>
                <td><span class="status status-${entry.alertLevel}">${escapeHtml(entry.statusLabel)}</span></td>
                <td class="water-level">${entry.waterLevel.toFixed(2)} m</td>
              </tr>
            `,
          )
          .join("")
      : `<tr><td class="empty" colspan="4">No records available for the selected filters.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(options.reportTitle)}</title>
    <style>
      @page {
        size: A4 landscape;
        margin: 12mm;
      }

      :root {
        color-scheme: light;
        --ink: #13253f;
        --muted: #5f7690;
        --line: #d8e3ef;
        --panel: #f7fbff;
        --brand: #123b63;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: Arial, Helvetica, sans-serif;
        color: var(--ink);
        background: #fff;
      }

      .report {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .header {
        border: 1px solid var(--line);
        border-radius: 18px;
        background: linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%);
        padding: 18px 20px;
      }

      .eyebrow {
        font-size: 11px;
        letter-spacing: 0.18em;
        font-weight: 700;
        color: #5b7ea9;
        text-transform: uppercase;
        margin-bottom: 8px;
      }

      h1 {
        margin: 0;
        font-size: 24px;
        line-height: 1.15;
      }

      .subhead {
        margin-top: 4px;
        color: var(--muted);
        font-size: 13px;
      }

      .meta-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
      }

      .meta-card {
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--panel);
        padding: 12px 14px;
      }

      .meta-label {
        color: var(--muted);
        font-size: 10px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        font-weight: 700;
        margin-bottom: 6px;
      }

      .meta-value {
        font-size: 14px;
        font-weight: 700;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }

      thead {
        display: table-header-group;
      }

      thead th {
        background: var(--brand);
        color: #fff;
        text-align: left;
        padding: 12px 14px;
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      tbody tr {
        page-break-inside: avoid;
      }

      tbody td {
        border-bottom: 1px solid var(--line);
        padding: 12px 14px;
        vertical-align: top;
      }

      tbody tr:nth-child(even) td {
        background: #fbfdff;
      }

      .status {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 700;
      }

      .status-normal { background: #d1fae5; color: #166534; }
      .status-critical { background: #fef3c7; color: #b45309; }
      .status-evacuation { background: #f3d4c6; color: #9a4d22; }
      .status-spilling { background: #f7c8c8; color: #be3b3b; }

      .water-level {
        font-weight: 700;
        color: var(--brand);
        white-space: nowrap;
      }

      .empty {
        text-align: center;
        color: var(--muted);
        padding: 24px 14px;
      }

      .footer-note {
        color: var(--muted);
        font-size: 11px;
        text-align: right;
      }
    </style>
  </head>
  <body>
    <div class="report">
      <section class="header">
        <div class="eyebrow">Analytics Report</div>
        <h1>${escapeHtml(options.reportTitle)}</h1>
        <div class="subhead">Printable summary for reporting and archival use.</div>
      </section>

      <section class="meta-grid">
        <div class="meta-card">
          <div class="meta-label">Barangay</div>
          <div class="meta-value">${escapeHtml(options.barangayName)}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">City</div>
          <div class="meta-value">${escapeHtml(options.cityName)}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Report Period</div>
          <div class="meta-value">${escapeHtml(options.dateRangeLabel)}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Generated At</div>
          <div class="meta-value">${escapeHtml(options.generatedAt)}</div>
        </div>
      </section>

      <section>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Status</th>
              <th>Water Level (m)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </section>

      <div class="footer-note">Total records: ${options.rows.length}</div>
    </div>
  </body>
</html>`;
}

async function loadImageDataUrl(path: string): Promise<string> {
  const response = await fetch(encodeURI(path));
  if (!response.ok) {
    throw new Error(`Failed to load image: ${path}`);
  }

  const blob = await response.blob();

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(`Failed to convert image to data URL: ${path}`));
    reader.readAsDataURL(blob);
  });
}

export async function downloadAnalyticsReportPdf(options: AnalyticsReportExportOptions, fileName: string): Promise<void> {
  const document = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    putOnlyUsedFonts: true,
    compress: true,
  });

  const margin = 12;
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const metaStartY = 48;

  const safeFileName = fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`;

  // Format generatedAt to include the word "at" before the time when possible
  function formatGeneratedAt(raw: string): string {
    const parts = raw.split(/,\s*/);
    if (parts.length >= 2) {
      const timePart = parts[parts.length - 1];
      const datePart = parts.slice(0, parts.length - 1).join(", ");
      return `${datePart} at ${timePart}`;
    }
    return raw;
  }

  const generatedAtText = formatGeneratedAt(options.generatedAt);
  try {
    const logoDataUrl = await loadImageDataUrl(STA_RITA_ICON_PATH);
    document.addImage(logoDataUrl, "PNG", margin, 10, 24, 24);
  } catch {
    // Continue export even when logo loading fails.
  }

  const titleStartX = 40;
  document.setFont("helvetica", "bold");
  document.setFontSize(16);
  document.text(options.reportTitle, titleStartX, 18, {
    maxWidth: pageWidth - titleStartX - margin,
  });

  // Removed overlapping subtitle to avoid collision with barangay/city lines

  document.setDrawColor(216, 227, 239);
  document.setLineWidth(0.2);
  document.line(margin, 36, pageWidth - margin, 36);

  document.setTextColor(19, 37, 63);
  // Two lines: print the provided barangay and city values directly (avoid duplicating the word "Barangay")
  document.setFont("helvetica", "normal");
  document.setFontSize(11);
  document.text(options.barangayName, titleStartX, 28);
  document.text(options.cityName, titleStartX, 34);

  // Metadata row: bold only the labels "Report Period:" and "Generated At:" and leave values normal
  const leftX = margin;
  const midX = pageWidth / 2;

  // Report Period label (bold) and value (normal)
  document.setFont("helvetica", "bold");
  document.setFontSize(10);
  document.text("Report Period:", leftX, metaStartY);
  document.setFont("helvetica", "normal");
  const rptLabelWidth = (document as any).getTextWidth("Report Period:");
  document.text(options.dateRangeLabel, leftX + rptLabelWidth + 6, metaStartY);

  // Generated At label (bold) and value (normal)
  const genLabel = "Generated At:";
  document.setFont("helvetica", "bold");
  document.text(genLabel, midX, metaStartY);
  document.setFont("helvetica", "normal");
  const genLabelWidth = (document as any).getTextWidth(genLabel);
  document.text(generatedAtText, midX + genLabelWidth + 6, metaStartY, { maxWidth: pageWidth - midX - margin });

  const bodyRows =
    options.rows.length > 0
      ? options.rows.map((entry) => [
          formatPdfDate(entry),
          formatPdfTime(entry),
          entry.statusLabel,
          `${entry.waterLevel.toFixed(2)} m`,
        ])
      : [["No records available for the selected filters.", "", "", ""]];

  autoTable(document, {
    startY: metaStartY + 18,
    head: [["Date", "Time", "Status", "Water Level (m)"]],
    body: bodyRows,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2.6,
      textColor: [31, 41, 55],
      lineColor: [216, 227, 239],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [18, 59, 99],
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: 30 },
      2: { cellWidth: 52 },
      3: { halign: "right", cellWidth: 42 },
    },
    didParseCell: ({ cell, column, row, section }) => {
      if (section !== "body" || options.rows.length === 0) {
        return;
      }

      if (column.index === 2) {
        const alertLevel = options.rows[row.index]?.alertLevel;
        if (alertLevel === "normal") {
          cell.styles.fillColor = [209, 250, 229];
          cell.styles.textColor = [22, 101, 52];
        } else if (alertLevel === "critical") {
          cell.styles.fillColor = [254, 243, 199];
          cell.styles.textColor = [180, 83, 9];
        } else if (alertLevel === "evacuation") {
          cell.styles.fillColor = [243, 212, 198];
          cell.styles.textColor = [154, 77, 34];
        } else if (alertLevel === "spilling") {
          cell.styles.fillColor = [247, 200, 200];
          cell.styles.textColor = [190, 59, 59];
        }
      }

      if (column.index === 3) {
        cell.styles.fontStyle = "bold";
        cell.styles.textColor = [18, 59, 99];
      }
    },
  });

  const finalY = (document as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? metaStartY + 18;
  const footerY = Math.min(pageHeight - margin, finalY + 8);
  document.setFontSize(9);
  document.setTextColor(95, 118, 144);
  document.text(`Total records: ${options.rows.length}`, pageWidth - margin, footerY, { align: "right" });

  document.save(safeFileName);
}