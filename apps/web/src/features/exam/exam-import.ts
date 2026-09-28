/**
 * 导入预览的纯解析逻辑（与后端 `parseExamsFromCsv` 同构，仅用于前端预览与「预计导入/跳过」计数）。
 * 刻意与 React 解耦，便于单测。
 */
import { CSV_HEADER } from './exam-copy';

/** 预览用草稿（列与 CSV 表头一一对应，日期/URL 等保留为原始文本）。 */
export interface ExamImportDraft {
  title: string;
  type: 'exam' | 'interview';
  company: string;
  deadline: string;
  url: string;
  location: string;
  status: string;
  notes: string;
}

export interface ExamImportPreview {
  /** 成功解析出的草稿（可导入）。 */
  drafts: ExamImportDraft[];
  /** 无法解析（缺 title 或非法 type）而被跳过的数据行数。 */
  skipped: number;
  /** 结构级错误（如 JSON 非数组 / 表头缺列），存在时 drafts/skipped 均无意义。 */
  error?: string;
}

/** 生成模板 CSV 文本（仅表头一行，用于「下载模板」）。 */
export function csvTemplate(): string {
  return CSV_HEADER.join(',');
}

/**
 * 最小 CSV 解析（RFC 4180）：双引号包裹字段、内嵌引号转义为 `""`、逗号与换行分隔。
 * 返回二维数组（首行为表头），单测可先直接校验此函数。
 */
export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      // 忽略孤立 CR（配合 CRLF）。
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const REQUIRED_HEADERS = ['title', 'type'] as const;

/**
 * 解析 CSV 文本为导入草稿。
 *
 * 跳过规则与后端 `parseExamsFromCsv` 保持一致：
 * - 缺失 title / type 表头 → `error`；
 * - 数据行 title 为空、或 type 非 exam|interview（空 type 视为 exam）→ skipped；
 * - 整行为空的数据行不计入 skipped。
 */
export function parseCsvToDrafts(content: string): ExamImportPreview {
  const rows = parseCsv(content);
  if (rows.length === 0) {
    return { drafts: [], skipped: 0 };
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const missing = REQUIRED_HEADERS.filter((name) => !header.includes(name));
  if (missing.length > 0) {
    return { drafts: [], skipped: 0, error: `CSV 表头缺少必需列：${missing.join(', ')}` };
  }

  const pick = (name: string, cols: string[]): string => {
    const idx = header.indexOf(name);
    return idx >= 0 ? (cols[idx] ?? '').trim() : '';
  };

  const drafts: ExamImportDraft[] = [];
  let skipped = 0;

  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    // 整行空白（含结尾换行产生的空行）不算「跳过」。
    if (cols.every((c) => c.trim() === '')) {
      continue;
    }

    const title = pick('title', cols);
    const rawType = pick('type', cols).toLowerCase();
    const type: 'exam' | 'interview' = rawType === '' ? 'exam' : (rawType as 'exam' | 'interview');

    if (title === '' || (type !== 'exam' && type !== 'interview')) {
      skipped++;
      continue;
    }

    drafts.push({
      title,
      type,
      company: pick('company', cols),
      deadline: pick('deadline', cols),
      url: pick('url', cols),
      location: pick('location', cols),
      status: pick('status', cols),
      notes: pick('notes', cols),
    });
  }

  return { drafts, skipped };
}

/**
 * 解析 JSON 文本为导入草稿。
 *
 * 与后端 JSON 分支对齐：内容必须为数组；每条按 `createExamInfoInputSchema` 语义，
 * title 必填、type 必须显式为 exam|interview，其余字段字符串化后可选。
 */
export function parseJsonToDrafts(content: string): ExamImportPreview {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { drafts: [], skipped: 0, error: 'JSON 内容解析失败' };
  }

  if (!Array.isArray(parsed)) {
    return { drafts: [], skipped: 0, error: 'JSON 内容必须为数组' };
  }

  const drafts: ExamImportDraft[] = [];
  let skipped = 0;

  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

  for (const item of parsed) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      skipped++;
      continue;
    }
    const rec = item as Record<string, unknown>;
    const title = str(rec.title);
    const type = str(rec.type) as 'exam' | 'interview';

    if (title === '' || (type !== 'exam' && type !== 'interview')) {
      skipped++;
      continue;
    }

    drafts.push({
      title,
      type,
      company: str(rec.company),
      deadline: str(rec.deadline),
      url: str(rec.url),
      location: str(rec.location),
      status: str(rec.status),
      notes: str(rec.notes),
    });
  }

  return { drafts, skipped };
}