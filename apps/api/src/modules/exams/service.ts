import type {
  ConvertExamToTaskInput,
  CreateExamInfoInput,
  DataSnapshot,
  ExamInfo,
  UpdateExamInfoInput,
} from '@task-list/shared';
import { createExamInfoInputSchema } from '@task-list/shared';
import { HttpError, notFound } from '../../http-error';
import { createTask, now, uuid } from '../tasks/service';

// ---------------------------------------------------------------------------
// 查询
// ---------------------------------------------------------------------------

export function getExam(snapshot: DataSnapshot, examId: string): ExamInfo {
  const exam = snapshot.examInfos.find((e) => e.id === examId);
  if (!exam) {
    throw notFound(`考试/面试信息不存在：${examId}`);
  }
  return exam;
}

export interface ExamFilters {
  type?: 'exam' | 'interview';
  q?: string;
  status?: string;
}

export function listExams(snapshot: DataSnapshot, filters: ExamFilters = {}): ExamInfo[] {
  const q = filters.q?.trim().toLowerCase();

  return snapshot.examInfos
    .filter((exam) => {
      if (filters.type && exam.type !== filters.type) {
        return false;
      }
      if (filters.status !== undefined && exam.status !== filters.status) {
        return false;
      }
      if (q) {
        const haystack = [exam.title, exam.company ?? ''].join('\n').toLowerCase();
        if (!haystack.includes(q)) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---------------------------------------------------------------------------
// 单条 CRUD
// ---------------------------------------------------------------------------

export interface CreateExamResult {
  snapshot: DataSnapshot;
  exam: ExamInfo;
}

/** 统一构造 ExamInfo（手动与 JSON 导入共用，仅 source 不同）。 */
function buildExam(input: CreateExamInfoInput, source: 'manual' | 'import'): ExamInfo {
  const timestamp = now();
  return {
    id: uuid(),
    title: input.title,
    type: input.type,
    company: input.company ?? null,
    source,
    deadline: input.deadline ?? null,
    appliedAt: input.appliedAt ?? null,
    url: input.url ?? null,
    location: input.location ?? null,
    status: input.status ?? '',
    notes: input.notes ?? '',
    taskId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createExam(snapshot: DataSnapshot, input: CreateExamInfoInput): CreateExamResult {
  const exam = buildExam(input, 'manual');
  return { snapshot: { ...snapshot, examInfos: [...snapshot.examInfos, exam] }, exam };
}

export interface UpdateExamResult {
  snapshot: DataSnapshot;
  exam: ExamInfo;
}

export function updateExam(
  snapshot: DataSnapshot,
  examId: string,
  input: UpdateExamInfoInput,
): UpdateExamResult {
  const existing = getExam(snapshot, examId);
  const updated: ExamInfo = {
    ...existing,
    title: input.title ?? existing.title,
    type: input.type ?? existing.type,
    company: input.company !== undefined ? input.company : existing.company,
    deadline: input.deadline !== undefined ? input.deadline : existing.deadline,
    appliedAt: input.appliedAt !== undefined ? input.appliedAt : existing.appliedAt,
    url: input.url !== undefined ? input.url : existing.url,
    location: input.location !== undefined ? input.location : existing.location,
    status: input.status ?? existing.status,
    notes: input.notes ?? existing.notes,
    updatedAt: now(),
  };
  return {
    snapshot: {
      ...snapshot,
      examInfos: snapshot.examInfos.map((e) => (e.id === examId ? updated : e)),
    },
    exam: updated,
  };
}

export interface DeleteExamResult {
  snapshot: DataSnapshot;
}

export function deleteExam(snapshot: DataSnapshot, examId: string): DeleteExamResult {
  getExam(snapshot, examId);
  return {
    snapshot: { ...snapshot, examInfos: snapshot.examInfos.filter((e) => e.id !== examId) },
  };
}

// ---------------------------------------------------------------------------
// 批量导入
// ---------------------------------------------------------------------------

/** 最小 CSV 解析（RFC 4180：双引号包裹、内嵌引号转义、逗号/换行分隔）。 */
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
      // 忽略 CR（CRLF 或孤立 CR）。
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

function trimOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** 从 CSV 文本解析出 ExamInfo 列表；返回无法解析（缺 title / 非法 type / 列数与表头不符）的行数。 */
export function parseExamsFromCsv(content: string): {
  exams: ExamInfo[];
  skipped: number;
} {
  const rows = parseCsv(content);
  if (rows.length === 0) {
    return { exams: [], skipped: 0 };
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  if (!header.includes('title') || !header.includes('type')) {
    throw new HttpError(400, 'validation_error', 'CSV 表头缺少必需列 title/type');
  }
  const indexOf = (name: string) => header.indexOf(name);
  // 关键列（title/type）在表头中的最大下标：行必须覆盖到该列，否则列数与表头不符。
  const requiredCols = Math.max(indexOf('title'), indexOf('type'));

  const exams: ExamInfo[] = [];
  let skipped = 0;

  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    // 列数不足关键列：无法可靠映射（首列会被兜底成 title、type 兜底成 exam），直接跳过。
    if (cols.length <= requiredCols) {
      skipped++;
      continue;
    }

    const pick = (name: string) => {
      const idx = indexOf(name);
      return idx >= 0 ? cols[idx] : undefined;
    };

    const title = pick('title')?.trim() ?? '';
    const rawType = (pick('type') ?? '').trim().toLowerCase();
    const type = rawType === '' ? 'exam' : rawType;

    if (title === '' || (type !== 'exam' && type !== 'interview')) {
      skipped++;
      continue;
    }

    const timestamp = now();
    exams.push({
      id: uuid(),
      title,
      type: type as 'exam' | 'interview',
      company: trimOrNull(pick('company')),
      source: 'import',
      deadline: trimOrNull(pick('deadline')),
      appliedAt: null,
      url: trimOrNull(pick('url')),
      location: trimOrNull(pick('location')),
      status: (pick('status') ?? '').trim(),
      notes: (pick('notes') ?? '').trim(),
      taskId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  return { exams, skipped };
}

export interface ImportResult {
  snapshot: DataSnapshot;
  imported: number;
  skipped: number;
  items: ExamInfo[];
}

export function importExams(
  snapshot: DataSnapshot,
  format: 'csv' | 'json',
  content: string,
): ImportResult {
  if (format === 'csv') {
    const { exams, skipped } = parseExamsFromCsv(content);
    return {
      snapshot: { ...snapshot, examInfos: [...snapshot.examInfos, ...exams] },
      imported: exams.length,
      skipped,
      items: exams,
    };
  }

  // JSON：内容为数组，逐条按 createExamInfoInputSchema 校验。
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new HttpError(400, 'validation_error', 'JSON 内容解析失败');
  }
  if (!Array.isArray(parsed)) {
    throw new HttpError(400, 'validation_error', 'JSON 内容必须为数组');
  }

  const exams: ExamInfo[] = [];
  let skipped = 0;
  for (const item of parsed) {
    const result = createExamInfoInputSchema.safeParse(item);
    if (!result.success) {
      skipped++;
      continue;
    }
    const exam = buildExam(result.data, 'import');
    exams.push(exam);
    snapshot = { ...snapshot, examInfos: [...snapshot.examInfos, exam] };
  }

  return { snapshot, imported: exams.length, skipped, items: exams };
}

// ---------------------------------------------------------------------------
// 转任务
// ---------------------------------------------------------------------------

export interface ConvertResult {
  snapshot: DataSnapshot;
  task: ReturnType<typeof createTask>['task'];
  exam: ExamInfo;
}

export function convertExamToTask(
  snapshot: DataSnapshot,
  examId: string,
  input: ConvertExamToTaskInput,
): ConvertResult {
  const exam = getExam(snapshot, examId);
  if (exam.taskId !== null) {
    throw new HttpError(409, 'already_converted', '该考试/面试信息已转为任务', {
      taskId: exam.taskId,
    });
  }

  const firstCategory = [...snapshot.statusCategories].sort((a, b) => a.order - b.order)[0];
  const statusId = input.statusId ?? firstCategory?.id;
  if (!statusId) {
    throw new HttpError(400, 'validation_error', '没有可用的状态分类，请先创建状态分类');
  }

  const notes = [exam.notes, exam.url ? `URL: ${exam.url}` : null]
    .filter((part): part is string => Boolean(part))
    .join('\n');

  const { snapshot: withTask, task } = createTask(snapshot, {
    title: exam.title,
    company: exam.company ?? null,
    statusId,
    tags: [],
    notes,
    stages: input.stages ?? [],
  });

  const updatedExam: ExamInfo = { ...exam, taskId: task.id, updatedAt: now() };
  return {
    snapshot: {
      ...withTask,
      examInfos: withTask.examInfos.map((e) => (e.id === examId ? updatedExam : e)),
    },
    task,
    exam: updatedExam,
  };
}