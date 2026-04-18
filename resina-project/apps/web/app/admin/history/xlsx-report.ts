type AlertLevelKey = "normal" | "critical" | "evacuation" | "spilling";

export type AnalyticsReportRow = {
  recordedAt: string;
  readingDate: string | null;
  readingTime: string | null;
  waterLevel: number;
  alertLevel: AlertLevelKey;
  statusLabel: string;
  description: string;
};

type BuildAnalyticsWorkbookOptions = {
  rows: AnalyticsReportRow[];
  dateRangeLabel: string;
  generatedAt: string;
  reportTitle: string;
  barangayName: string;
  cityName: string;
};

const TEXT_ENCODER = new TextEncoder();

function encodeUtf8(value: string): Uint8Array {
  return TEXT_ENCODER.encode(value);
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

function writeUint16LE(view: DataView, offset: number, value: number): number {
  view.setUint16(offset, value, true);
  return offset + 2;
}

function writeUint32LE(view: DataView, offset: number, value: number): number {
  view.setUint32(offset, value, true);
  return offset + 4;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index] ?? 0;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & (-(crc & 1)));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(entries: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const nameBytes = encodeUtf8(entry.name);
    const data = entry.data;
    const crc = crc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    let pointer = 0;
    pointer = writeUint32LE(localView, pointer, 0x04034b50);
    pointer = writeUint16LE(localView, pointer, 20);
    pointer = writeUint16LE(localView, pointer, 0);
    pointer = writeUint16LE(localView, pointer, 0);
    pointer = writeUint16LE(localView, pointer, 0);
    pointer = writeUint16LE(localView, pointer, 0);
    pointer = writeUint32LE(localView, pointer, crc);
    pointer = writeUint32LE(localView, pointer, data.length);
    pointer = writeUint32LE(localView, pointer, data.length);
    pointer = writeUint16LE(localView, pointer, nameBytes.length);
    pointer = writeUint16LE(localView, pointer, 0);
    localHeader.set(nameBytes, pointer);

    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    pointer = 0;
    pointer = writeUint32LE(centralView, pointer, 0x02014b50);
    pointer = writeUint16LE(centralView, pointer, 20);
    pointer = writeUint16LE(centralView, pointer, 20);
    pointer = writeUint16LE(centralView, pointer, 0);
    pointer = writeUint16LE(centralView, pointer, 0);
    pointer = writeUint16LE(centralView, pointer, 0);
    pointer = writeUint16LE(centralView, pointer, 0);
    pointer = writeUint32LE(centralView, pointer, crc);
    pointer = writeUint32LE(centralView, pointer, data.length);
    pointer = writeUint32LE(centralView, pointer, data.length);
    pointer = writeUint16LE(centralView, pointer, nameBytes.length);
    pointer = writeUint16LE(centralView, pointer, 0);
    pointer = writeUint16LE(centralView, pointer, 0);
    pointer = writeUint16LE(centralView, pointer, 0);
    pointer = writeUint16LE(centralView, pointer, 0);
    pointer = writeUint32LE(centralView, pointer, 0);
    pointer = writeUint32LE(centralView, pointer, localOffset);
    centralHeader.set(nameBytes, pointer);

    centralParts.push(centralHeader);
    localOffset += localHeader.length + data.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const localData = concatBytes(localParts);

  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  let pointer = 0;
  pointer = writeUint32LE(endView, pointer, 0x06054b50);
  pointer = writeUint16LE(endView, pointer, 0);
  pointer = writeUint16LE(endView, pointer, 0);
  pointer = writeUint16LE(endView, pointer, entries.length);
  pointer = writeUint16LE(endView, pointer, entries.length);
  pointer = writeUint32LE(endView, pointer, centralDirectory.length);
  pointer = writeUint32LE(endView, pointer, localData.length);
  writeUint16LE(endView, pointer, 0);

  return concatBytes([localData, centralDirectory, endRecord]);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index: number): string {
  let remaining = index;
  let name = "";

  while (remaining >= 0) {
    name = String.fromCharCode((remaining % 26) + 65) + name;
    remaining = Math.floor(remaining / 26) - 1;
  }

  return name;
}

function inlineStringCell(reference: string, value: string, styleId: number): string {
  return `<c r="${reference}" t="inlineStr" s="${styleId}"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function numberCell(reference: string, value: number, styleId: number): string {
  return `<c r="${reference}" s="${styleId}"><v>${value.toFixed(2)}</v></c>`;
}

function rowXml(rowNumber: number, cells: string[], height?: number): string {
  const heightAttributes = height ? ` ht="${height}" customHeight="1"` : "";
  return `<row r="${rowNumber}"${heightAttributes}>${cells.join("")}</row>`;
}

function createSheetXml(options: BuildAnalyticsWorkbookOptions): string {
  const rows = options.rows;
  const dataStartRow = 9;

  const headerRow = rowXml(8, [
    inlineStringCell("A8", "Date", 6),
    inlineStringCell("B8", "Time", 6),
    inlineStringCell("C8", "Status", 6),
    inlineStringCell("D8", "Water Level (m)", 6),
    inlineStringCell("E8", "Description", 6),
  ], 22);

  const dataRows = rows.map((entry, index) => {
    const rowNumber = dataStartRow + index;
    const statusStyle =
      entry.alertLevel === "normal"
        ? 10
        : entry.alertLevel === "critical"
          ? 11
          : entry.alertLevel === "evacuation"
            ? 12
            : 13;

    return rowXml(rowNumber, [
      inlineStringCell(`A${rowNumber}`, formatExcelDate(entry), 7),
      inlineStringCell(`B${rowNumber}`, formatExcelTime(entry), 7),
      inlineStringCell(`C${rowNumber}`, entry.statusLabel, statusStyle),
      numberCell(`D${rowNumber}`, entry.waterLevel, 8),
      inlineStringCell(`E${rowNumber}`, entry.description, 9),
    ], 20);
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:G${Math.max(9, dataStartRow + rows.length - 1)}"/>
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="7" topLeftCell="A8" activePane="bottomLeft" state="frozen"/>
      <selection pane="bottomLeft" activeCell="A8" sqref="A8"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols>
    <col min="1" max="1" width="16" customWidth="1"/>
    <col min="2" max="2" width="16" customWidth="1"/>
    <col min="3" max="3" width="16" customWidth="1"/>
    <col min="4" max="4" width="16" customWidth="1"/>
    <col min="5" max="5" width="52" customWidth="1"/>
    <col min="6" max="6" width="16" customWidth="1"/>
    <col min="7" max="7" width="16" customWidth="1"/>
  </cols>
  <sheetData>
    ${rowXml(1, [inlineStringCell("B1", options.reportTitle, 1)], 30)}
    ${rowXml(2, [inlineStringCell("B2", options.barangayName, 2)], 22)}
    ${rowXml(3, [inlineStringCell("B3", options.cityName, 3)], 20)}
    ${rowXml(4, [], 10)}
    ${rowXml(5, [inlineStringCell("B5", `Report Period: ${options.dateRangeLabel}`, 4)], 20)}
    ${rowXml(6, [inlineStringCell("B6", `Generated At: ${options.generatedAt}    |    Total Records: ${rows.length}`, 4)], 20)}
    ${rowXml(7, [], 10)}
    ${headerRow}
    ${dataRows.join("")}
  </sheetData>
  <autoFilter ref="A8:E${Math.max(8, dataStartRow + rows.length - 1)}"/>
  <mergeCells count="5">
    <mergeCell ref="B1:F1"/>
    <mergeCell ref="B2:F2"/>
    <mergeCell ref="B3:F3"/>
    <mergeCell ref="B5:F5"/>
    <mergeCell ref="B6:F6"/>
  </mergeCells>
</worksheet>`;
}

function createWorkbookXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews>
    <workbookView activeTab="0"/>
  </bookViews>
  <sheets>
    <sheet name="Analytics Report" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
}

function createWorkbookRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function createRootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function createContentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
}

function createStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="9">
    <font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="18"/><color rgb="FF0F2847"/><name val="Aptos"/><family val="2"/></font>
    <font><sz val="13"/><color rgb="FF4F709E"/><name val="Aptos"/><family val="2"/></font>
    <font><sz val="12"/><color rgb="FF5F7CA3"/><name val="Aptos"/><family val="2"/></font>
    <font><i/><sz val="10"/><color rgb="FF4B6A8E"/><name val="Aptos"/><family val="2"/></font>
    <font><b/><color rgb="FFFFFFFF"/><name val="Aptos"/><family val="2"/></font>
    <font><b/><color rgb="FF1F2937"/><name val="Aptos"/><family val="2"/></font>
    <font><color rgb="FF334155"/><name val="Aptos"/><family val="2"/></font>
    <font><color rgb="FF334155"/><name val="Aptos"/><family val="2"/></font>
  </fonts>
  <fills count="9">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDCEBFA"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF3F8FF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF123B63"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD1FAE5"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE6BA9F"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF7C8C8"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD8E5F3"/></left><right style="thin"><color rgb="FFD8E5F3"/></right><top style="thin"><color rgb="FFD8E5F3"/></top><bottom style="thin"><color rgb="FFD8E5F3"/></bottom><diagonal/></border>
    <border><left style="thin"><color rgb="FFFFFFFF"/></left><right style="thin"><color rgb="FFFFFFFF"/></right><top style="thin"><color rgb="FFFFFFFF"/></top><bottom style="thin"><color rgb="FFFFFFFF"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="14">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="7" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="2" fontId="8" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="7" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="6" fillId="5" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="6" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="7" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="8" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

async function fetchImageBytes(path: string): Promise<Uint8Array> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load image: ${path}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

function formatExcelDate(entry: AnalyticsReportRow): string {
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

function formatExcelTime(entry: AnalyticsReportRow): string {
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

export async function buildAnalyticsReportXlsx(options: BuildAnalyticsWorkbookOptions): Promise<Uint8Array> {
  const files = [
    { name: "[Content_Types].xml", data: encodeUtf8(createContentTypesXml()) },
    { name: "_rels/.rels", data: encodeUtf8(createRootRelsXml()) },
    { name: "xl/workbook.xml", data: encodeUtf8(createWorkbookXml()) },
    { name: "xl/_rels/workbook.xml.rels", data: encodeUtf8(createWorkbookRelsXml()) },
    { name: "xl/styles.xml", data: encodeUtf8(createStylesXml()) },
    { name: "xl/worksheets/sheet1.xml", data: encodeUtf8(createSheetXml(options)) },
  ];

  return createZip(files);
}

export async function downloadAnalyticsReportXlsx(options: BuildAnalyticsWorkbookOptions, fileName: string): Promise<void> {
  const archive = await buildAnalyticsReportXlsx(options);
  const archiveBuffer = archive.buffer.slice(
    archive.byteOffset,
    archive.byteOffset + archive.byteLength,
  ) as ArrayBuffer;

  const blob = new Blob([archiveBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}