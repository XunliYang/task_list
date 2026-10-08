import { ZodError } from 'zod';
import {
  addStageInputSchema,
  convertExamToTaskInputSchema,
  createExamInfoInputSchema,
  createProgressInputSchema,
  createStatusInputSchema,
  createTaskInputSchema,
  dataSnapshotSchema,
  examsImportInputSchema,
  reorderStagesInputSchema,
  setCurrentStageInputSchema,
  updateExamInfoInputSchema,
  updateStageInputSchema,
  updateStatusInputSchema,
  updateTaskInputSchema,
} from '@task-list/shared';
import type {
  AdvanceStageResult,
  DataSnapshot,
  ExamInfo,
  ExamsImportResult,
  ProgressEntry,
  Stage,
  StageStatus,
  StatusCategory,
  Task,
} from '@task-list/shared';
import { ApiError } from './errors';

/**
 * 浏览器本地持久化数据源（Netlify 静态托管降级）。
 *
 * 与 REST API 对齐（同一批路由/校验/语义），但：
 * - 单用户、单进程（浏览器标签页），数据保存在 localStorage；
 * - 复用 `@task-list/shared` 的 `DataSnapshot` 结构与 zod schema 校验；
 * - 写操作「先写临时 key 再落到正式 key」（参考 JsonStore 的 tmp+rename 策略），
 *   避免半写状态残留。
 */

export const STORAGE_KEY = 'task-list-store-v1';

export type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------

/** 进程内统一时间源。 */
function now(): string {
  return new Date().toISOString();
}

/** 稳定 id（优先 crypto.randomUUID，非安全上下文兜底）。 */
function uuid(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') {
    return c.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function httpError(status: number, code: string, message: string, details?: unknown): never {
  throw new ApiError(status, { code, message, details });
}

function notFound(message: string): never {
  return httpError(404, 'not_found', message);
}

/** zod 校验失败映射为和后端统一的 400 validation_error。 */
function parseOrThrow<T>(schema: { parse: (data: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      httpError(400, 'validation_error', '请求校验失败', err.issues);
    }
    throw err;
  }
}

/** 首次写入的 seed 数据（与 apps/api/src/store/seed.ts 相同）。 */
export function createSeedSnapshot(): DataSnapshot {
  return {
    version: 1,
    tasks: [],
    statusCategories: [
      { id: 'status-todo', name: '待开始', color: '#9e9e9e', order: 0 },
      { id: 'status-in-progress', name: '进行中', color: '#1976d2', order: 1 },
      { id: 'status-done', name: '已完成', color: '#388e3c', order: 2 },
    ],
    progressEntries: [],
    examInfos: [],
  };
}

// ---------------------------------------------------------------------------
// 任务查询（纯读）
// ---------------------------------------------------------------------------

function getTask(snapshot: DataSnapshot, taskId: string): Task {
  const task = snapshot.tasks.find((t) => t.id === taskId);
  if (!task) {
    notFound(`任务不存在：${taskId}`);
  }
  return task;
}

function getStage(task: Task, stageId: string): Stage {
  const stage = task.stages.find((s) => s.id === stageId);
  if (!stage) {
    notFound(`阶段不存在：${stageId}`);
  }
  return stage;
}

function listTasks(
  snapshot: DataSnapshot,
  filters: { statusIds?: string[]; q?: string; stageStatus?: 'done' | 'pending' },
): Task[] {
  const q = filters.q?.trim().toLowerCase();

  const result = snapshot.tasks.filter((task) => {
    if (filters.statusIds && filters.statusIds.length > 0) {
      if (!filters.statusIds.includes(task.statusId)) {
        return false;
      }
    }

    if (q) {
      const haystack = [task.title, task.company ?? '', ...task.tags]
        .join('\n')
        .toLowerCase();
      if (!haystack.includes(q)) {
        return false;
      }
    }

    if (filters.stageStatus === 'done') {
      const allDone =
        task.stages.length > 0 && task.stages.every((s) => s.status === 'done');
      if (!allDone) {
        return false;
      }
    }

    if (filters.stageStatus === 'pending') {
      const hasPending = task.stages.some((s) => s.status !== 'done');
      if (!hasPending) {
        return false;
      }
    }

    return true;
  });

  // 按 updatedAt 倒序（更新的在前）。
  return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function listProgress(snapshot: DataSnapshot, taskId: string): ProgressEntry[] {
  getTask(snapshot, taskId);
  return snapshot.progressEntries
    .filter((entry) => entry.taskId === taskId)
    .sort((a, b) => b.at.localeCompare(a.at));
}

// ---------------------------------------------------------------------------
// 任务写操作（immutable 更新）
// ---------------------------------------------------------------------------

function nextOrder(stages: Stage[]): number {
  return stages.reduce((max, s) => Math.max(max, s.order), -1) + 1;
}

function withTask(snapshot: DataSnapshot, task: Task): DataSnapshot {
  return {
    ...snapshot,
    tasks: snapshot.tasks.map((t) => (t.id === task.id ? task : t)),
  };
}

function assertStatusExists(snapshot: DataSnapshot, statusId: string): void {
  if (!snapshot.statusCategories.some((c) => c.id === statusId)) {
    httpError(400, 'validation_error', `状态分类不存在：${statusId}`);
  }
}

function createTask(
  snapshot: DataSnapshot,
  input: {
    title: string;
    company?: string | null;
    tags: string[];
    notes: string;
    statusId: string;
    stages: { name: string; dueDate?: string | null }[];
  },
): { snapshot: DataSnapshot; task: Task } {
  const timestamp = now();
  assertStatusExists(snapshot, input.statusId);

  const stages: Stage[] = input.stages.map((stage, index) => ({
    id: uuid(),
    name: stage.name,
    order: index,
    status: index === 0 ? ('in_progress' as StageStatus) : ('pending' as StageStatus),
    dueDate: stage.dueDate ?? null,
    completedAt: null,
  }));

  const task: Task = {
    id: uuid(),
    title: input.title,
    company: input.company ?? null,
    statusId: input.statusId,
    tags: input.tags,
    stages,
    currentStageId: stages.length > 0 ? stages[0].id : null,
    notes: input.notes,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    snapshot: { ...snapshot, tasks: [...snapshot.tasks, task] },
    task,
  };
}

function updateTask(
  snapshot: DataSnapshot,
  taskId: string,
  input: { title?: string; company?: string | null; statusId?: string; tags?: string[]; notes?: string },
): { snapshot: DataSnapshot; task: Task } {
  const existing = getTask(snapshot, taskId);

  if (input.statusId !== undefined && input.statusId !== existing.statusId) {
    assertStatusExists(snapshot, input.statusId);
  }

  const updated: Task = {
    ...existing,
    title: input.title ?? existing.title,
    company: input.company !== undefined ? input.company : existing.company,
    statusId: input.statusId ?? existing.statusId,
    tags: input.tags ?? existing.tags,
    notes: input.notes !== undefined ? input.notes : existing.notes,
    updatedAt: now(),
  };

  return { snapshot: withTask(snapshot, updated), task: updated };
}

function deleteTask(snapshot: DataSnapshot, taskId: string): DataSnapshot {
  getTask(snapshot, taskId);
  return {
    ...snapshot,
    tasks: snapshot.tasks.filter((t) => t.id !== taskId),
    // 级联删除其 progressEntries。
    progressEntries: snapshot.progressEntries.filter((e) => e.taskId !== taskId),
  };
}

// ---------------------------------------------------------------------------
// 进展记录
// ---------------------------------------------------------------------------

function addProgress(
  snapshot: DataSnapshot,
  taskId: string,
  input: { summary: string; stageId?: string | null },
): { snapshot: DataSnapshot; entry: ProgressEntry } {
  const task = getTask(snapshot, taskId);

  const stageId = input.stageId ?? null;
  if (stageId !== null) {
    getStage(task, stageId);
  }

  const entry: ProgressEntry = {
    id: uuid(),
    taskId,
    at: now(),
    summary: input.summary,
    stageId,
  };

  return {
    snapshot: { ...snapshot, progressEntries: [...snapshot.progressEntries, entry] },
    entry,
  };
}

// ---------------------------------------------------------------------------
// 阶段增删改
// ---------------------------------------------------------------------------

function normalizeStages(stages: Stage[]): Stage[] {
  return stages.map((stage, index) => ({ ...stage, order: index }));
}

/** 「阶段前沿」不变式：第一个未完成阶段为当前阶段；全部完成指向末阶段；无阶段为 null。 */
function computeCurrentStageId(stages: Stage[]): string | null {
  if (stages.length === 0) {
    return null;
  }
  const firstNotDone = stages.find((s) => s.status !== 'done');
  return firstNotDone ? firstNotDone.id : stages[stages.length - 1].id;
}

function updateStage(
  snapshot: DataSnapshot,
  taskId: string,
  stageId: string,
  input: { name?: string; dueDate?: string | null; status?: StageStatus },
): { snapshot: DataSnapshot; task: Task } {
  const task = getTask(snapshot, taskId);
  getStage(task, stageId);

  const stages = task.stages.map((stage) => {
    if (stage.id !== stageId) {
      return stage;
    }
    const status = input.status ?? stage.status;
    return {
      ...stage,
      name: input.name ?? stage.name,
      dueDate: input.dueDate !== undefined ? input.dueDate : stage.dueDate,
      status,
      // status 置 done 时补记完成时间；离开 done 时清空。
      completedAt:
        status === 'done'
          ? stage.completedAt ?? now()
          : status === stage.status && stage.completedAt !== null
            ? stage.completedAt
            : null,
    };
  });

  const updated: Task = {
    ...task,
    stages,
    currentStageId: computeCurrentStageId(stages),
    updatedAt: now(),
  };
  return { snapshot: withTask(snapshot, updated), task: updated };
}

function addStage(
  snapshot: DataSnapshot,
  taskId: string,
  input: { name: string; dueDate?: string | null },
): { snapshot: DataSnapshot; task: Task } {
  const task = getTask(snapshot, taskId);

  const stage: Stage = {
    id: uuid(),
    name: input.name,
    order: nextOrder(task.stages),
    status: 'pending',
    dueDate: input.dueDate ?? null,
    completedAt: null,
  };

  const stages = normalizeStages([...task.stages, stage]);
  const updated: Task = {
    ...task,
    stages,
    currentStageId: computeCurrentStageId(stages),
    updatedAt: now(),
  };
  return { snapshot: withTask(snapshot, updated), task: updated };
}

function reorderStages(
  snapshot: DataSnapshot,
  taskId: string,
  input: { stageIds: string[] },
): { snapshot: DataSnapshot; task: Task } {
  const task = getTask(snapshot, taskId);

  const existingIds = task.stages.map((s) => s.id);
  const existingSet = new Set(existingIds);
  const requestedSet = new Set(input.stageIds);

  const missing = existingIds.filter((id) => !requestedSet.has(id));
  const extra = input.stageIds.filter((id) => !existingSet.has(id));
  const hasDuplicate = requestedSet.size !== input.stageIds.length;

  if (missing.length > 0 || extra.length > 0 || hasDuplicate) {
    httpError(
      400,
      'invalid_stage_order',
      '阶段顺序必须包含且仅包含该任务的全部阶段 id（无缺失、无多余、无重复）',
    );
  }

  const byId = new Map(task.stages.map((s) => [s.id, s]));
  const stages = normalizeStages(input.stageIds.map((id) => byId.get(id) as Stage));

  const updated: Task = {
    ...task,
    stages,
    currentStageId: computeCurrentStageId(stages),
    updatedAt: now(),
  };
  return { snapshot: withTask(snapshot, updated), task: updated };
}

function deleteStage(
  snapshot: DataSnapshot,
  taskId: string,
  stageId: string,
): { snapshot: DataSnapshot; task: Task } {
  const task = getTask(snapshot, taskId);
  getStage(task, stageId);

  const remaining = normalizeStages(task.stages.filter((s) => s.id !== stageId));

  let currentStageId = task.currentStageId;
  if (task.currentStageId === stageId) {
    const next =
      remaining.find((s) => s.status !== 'done') ?? remaining[0] ?? null;
    currentStageId = next?.id ?? null;
  }

  const updated: Task = { ...task, stages: remaining, currentStageId, updatedAt: now() };
  return { snapshot: withTask(snapshot, updated), task: updated };
}

// ---------------------------------------------------------------------------
// 阶段流转
// ---------------------------------------------------------------------------

function advanceStage(
  snapshot: DataSnapshot,
  taskId: string,
): { snapshot: DataSnapshot; result: AdvanceStageResult } {
  const task = getTask(snapshot, taskId);
  const current = task.currentStageId
    ? task.stages.find((s) => s.id === task.currentStageId)
    : undefined;

  // 无当前阶段，或当前阶段已完成 → 幂等返回。
  if (!current || current.status === 'done') {
    return {
      snapshot,
      result: { task, nextStage: null },
    };
  }

  const timestamp = now();
  const completed: Stage = { ...current, status: 'done', completedAt: timestamp };

  const next = task.stages
    .filter((s) => s.status === 'pending' && s.order > current.order)
    .sort((a, b) => a.order - b.order)[0];

  const updatedStages = task.stages.map((s) => {
    if (s.id === current.id) {
      return completed;
    }
    if (next && s.id === next.id) {
      return { ...s, status: 'in_progress' as StageStatus };
    }
    return s;
  });

  const updated: Task = {
    ...task,
    stages: updatedStages,
    currentStageId: next ? next.id : completed.id,
    updatedAt: timestamp,
  };

  const entry: ProgressEntry = {
    id: uuid(),
    taskId,
    at: timestamp,
    summary: `完成阶段「${current.name}」`,
    stageId: current.id,
  };

  const nextUpdated = next ? updatedStages.find((s) => s.id === next.id) ?? null : null;

  return {
    snapshot: {
      ...withTask(snapshot, updated),
      progressEntries: [...snapshot.progressEntries, entry],
    },
    result: { task: updated, nextStage: nextUpdated },
  };
}

function setCurrentStage(
  snapshot: DataSnapshot,
  taskId: string,
  stageId: string,
): { snapshot: DataSnapshot; task: Task } {
  const task = getTask(snapshot, taskId);
  const target = getStage(task, stageId);

  const stages = task.stages.map((stage) => {
    if (stage.id === stageId) {
      return { ...stage, status: 'in_progress' as StageStatus, completedAt: null };
    }
    if (stage.order > target.order && stage.status === 'done') {
      return { ...stage, status: 'pending' as StageStatus, completedAt: null };
    }
    return stage;
  });

  const updated: Task = { ...task, stages, currentStageId: stageId, updatedAt: now() };
  return { snapshot: withTask(snapshot, updated), task: updated };
}

// ---------------------------------------------------------------------------
// 状态分类
// ---------------------------------------------------------------------------

function listStatuses(snapshot: DataSnapshot): StatusCategory[] {
  return [...snapshot.statusCategories].sort((a, b) => a.order - b.order);
}

function createStatus(
  snapshot: DataSnapshot,
  input: { name: string; color: string; order?: number },
): { snapshot: DataSnapshot; category: StatusCategory } {
  const order =
    input.order ??
    snapshot.statusCategories.reduce((max, c) => Math.max(max, c.order), -1) + 1;
  const category: StatusCategory = {
    id: uuid(),
    name: input.name,
    color: input.color,
    order,
  };
  return {
    snapshot: { ...snapshot, statusCategories: [...snapshot.statusCategories, category] },
    category,
  };
}

function updateStatus(
  snapshot: DataSnapshot,
  statusId: string,
  input: { name?: string; color?: string; order?: number },
): { snapshot: DataSnapshot; category: StatusCategory } {
  const existing = snapshot.statusCategories.find((c) => c.id === statusId);
  if (!existing) {
    notFound(`状态分类不存在：${statusId}`);
  }
  const updated: StatusCategory = {
    ...existing,
    name: input.name ?? existing.name,
    color: input.color ?? existing.color,
    order: input.order ?? existing.order,
  };
  return {
    snapshot: {
      ...snapshot,
      statusCategories: snapshot.statusCategories.map((c) => (c.id === updated.id ? updated : c)),
    },
    category: updated,
  };
}

function deleteStatus(
  snapshot: DataSnapshot,
  statusId: string,
): { snapshot: DataSnapshot; conflictTaskIds: string[] } {
  const category = snapshot.statusCategories.find((c) => c.id === statusId);
  if (!category) {
    notFound(`状态分类不存在：${statusId}`);
  }
  const taskIds = snapshot.tasks.filter((t) => t.statusId === statusId).map((t) => t.id);
  if (taskIds.length > 0) {
    return { snapshot, conflictTaskIds: taskIds };
  }
  return {
    snapshot: {
      ...snapshot,
      statusCategories: snapshot.statusCategories.filter((c) => c.id !== statusId),
    },
    conflictTaskIds: [],
  };
}

// ---------------------------------------------------------------------------
// 考试/面试信息：单条 CRUD
// ---------------------------------------------------------------------------

function getExam(snapshot: DataSnapshot, examId: string): ExamInfo {
  const exam = snapshot.examInfos.find((e) => e.id === examId);
  if (!exam) {
    notFound(`考试/面试信息不存在：${examId}`);
  }
  return exam;
}

function listExams(
  snapshot: DataSnapshot,
  filters: { type?: 'exam' | 'interview'; q?: string; status?: string },
): ExamInfo[] {
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

/** 统一构造 ExamInfo（手动与 JSON 导入共用，仅 source 不同）。 */
function buildExam(
  input: {
    title: string;
    type: 'exam' | 'interview';
    company?: string | null;
    deadline?: string | null;
    appliedAt?: string | null;
    url?: string | null;
    location?: string | null;
    status?: string;
    notes?: string;
  },
  source: 'manual' | 'import',
): ExamInfo {
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

function createExam(
  snapshot: DataSnapshot,
  input: {
    title: string;
    type: 'exam' | 'interview';
    company?: string | null;
    deadline?: string | null;
    appliedAt?: string | null;
    url?: string | null;
    location?: string | null;
    status?: string;
    notes?: string;
  },
): { snapshot: DataSnapshot; exam: ExamInfo } {
  const exam = buildExam(input, 'manual');
  return { snapshot: { ...snapshot, examInfos: [...snapshot.examInfos, exam] }, exam };
}

function updateExam(
  snapshot: DataSnapshot,
  examId: string,
  input: {
    title?: string;
    type?: 'exam' | 'interview';
    company?: string | null;
    deadline?: string | null;
    appliedAt?: string | null;
    url?: string | null;
    location?: string | null;
    status?: string;
    notes?: string;
  },
): { snapshot: DataSnapshot; exam: ExamInfo } {
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

function deleteExam(snapshot: DataSnapshot, examId: string): DataSnapshot {
  getExam(snapshot, examId);
  return { ...snapshot, examInfos: snapshot.examInfos.filter((e) => e.id !== examId) };
}

// ---------------------------------------------------------------------------
// 考试/面试信息：批量导入
// ---------------------------------------------------------------------------

/** 最小 CSV 解析（RFC 4180：双引号包裹、内嵌引号转义、逗号/换行分隔）。 */
function parseCsv(content: string): string[][] {
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

/** 从 CSV 文本解析出 ExamInfo 列表；返回无法解析（缺 title / 非法 type）的行数。 */
function parseExamsFromCsv(content: string): { exams: ExamInfo[]; skipped: number } {
  const rows = parseCsv(content);
  if (rows.length === 0) {
    return { exams: [], skipped: 0 };
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  if (!header.includes('title') || !header.includes('type')) {
    httpError(400, 'validation_error', 'CSV 表头缺少必需列 title/type');
  }
  const indexOf = (name: string) => header.indexOf(name);

  const exams: ExamInfo[] = [];
  let skipped = 0;

  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
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

function importExams(
  snapshot: DataSnapshot,
  format: 'csv' | 'json',
  content: string,
): { snapshot: DataSnapshot; imported: number; skipped: number; items: ExamInfo[] } {
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
    httpError(400, 'validation_error', 'JSON 内容解析失败');
  }
  if (!Array.isArray(parsed)) {
    httpError(400, 'validation_error', 'JSON 内容必须为数组');
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
// 考试/面试信息：转任务
// ---------------------------------------------------------------------------

function convertExamToTask(
  snapshot: DataSnapshot,
  examId: string,
  input: { statusId?: string; stages?: { name: string; dueDate?: string | null }[] },
): { snapshot: DataSnapshot; task: Task; exam: ExamInfo } {
  const exam = getExam(snapshot, examId);
  if (exam.taskId !== null) {
    httpError(409, 'already_converted', '该考试/面试信息已转为任务', {
      taskId: exam.taskId,
    });
  }

  const firstCategory = [...snapshot.statusCategories].sort((a, b) => a.order - b.order)[0];
  const statusId = input.statusId ?? firstCategory?.id;
  if (!statusId) {
    httpError(400, 'validation_error', '没有可用的状态分类，请先创建状态分类');
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

// ---------------------------------------------------------------------------
// LocalStore：localStorage 持久化 + 路由分发
// ---------------------------------------------------------------------------

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function resolveStorage(): StorageLike | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    // 隐私模式等场景禁用 localStorage 时降级为纯内存。
  }
  return null;
}

export class LocalStore {
  private readonly storage: StorageLike | null;
  private readonly key: string;
  private cache: DataSnapshot | null = null;

  constructor(storage?: StorageLike | null, key: string = STORAGE_KEY) {
    // 显式传 null 表示禁用持久化（测试用）；不传则解析全局 localStorage。
    this.storage = storage === undefined ? resolveStorage() : storage;
    this.key = key;
  }

  /** 读取快照：命中缓存直接返回；否则从持久化读，无效/缺失时写回 seed。 */
  private load(): DataSnapshot {
    if (this.cache !== null) {
      return this.cache;
    }

    const raw = this.storage?.getItem(this.key) ?? null;
    if (raw !== null) {
      try {
        const parsed = dataSnapshotSchema.safeParse(JSON.parse(raw));
        if (parsed.success) {
          this.cache = parsed.data;
          return this.cache;
        }
      } catch {
        // JSON 解析失败 → 视作损坏，回退 seed。
      }
    }

    this.cache = createSeedSnapshot();
    this.persist(this.cache);
    return this.cache;
  }

  /** 原子化持久化：先写 tmp key，再落正式 key，最后清除 tmp。 */
  private persist(snapshot: DataSnapshot): void {
    if (!this.storage) {
      return;
    }
    const json = JSON.stringify(snapshot);
    const tmpKey = `${this.key}.tmp`;
    this.storage.setItem(tmpKey, json);
    this.storage.setItem(this.key, json);
    this.storage.removeItem(tmpKey);
  }

  /** 在串行读-改-写流程内执行一次变更并带回结果。 */
  private write<T>(mutator: (snapshot: DataSnapshot) => { snapshot: DataSnapshot; result: T }): T {
    const current = this.load();
    const out = mutator(current);
    this.persist(out.snapshot);
    this.cache = out.snapshot;
    return out.result;
  }

  /** 仅测试用：清空内存缓存，模拟「重启后重新读盘」。 */
  resetCache(): void {
    this.cache = null;
  }

  /** 清空持久化数据并复位缓存（测试用）。 */
  clear(): void {
    this.storage?.removeItem(this.key);
    this.storage?.removeItem(`${this.key}.tmp`);
    this.cache = null;
  }

  /**
   * 以 REST 风格分发请求（与 Express 路由对齐）。返回响应体；
   * 空响应（204，如删除）返回 undefined；失败抛 ApiError。
   */
  request<T = void>(method: Method, path: string, body?: unknown): T {
    const qIndex = path.indexOf('?');
    const pathname = qIndex >= 0 ? path.slice(0, qIndex) : path;
    const query = new URLSearchParams(qIndex >= 0 ? path.slice(qIndex + 1) : '');
    const segments = pathname.split('/').filter((s) => s.length > 0);

    const route = segments[0] ?? '';
    if (route === 'tasks') {
      return this.routeTasks(method, segments, query, body) as T;
    }
    if (route === 'statuses') {
      return this.routeStatuses(method, segments, body) as T;
    }
    if (route === 'exams') {
      return this.routeExams(method, segments, query, body) as T;
    }
    notFound(`未找到路由：${method} ${pathname}`);
  }

  private routeTasks(
    method: Method,
    segments: string[],
    query: URLSearchParams,
    body: unknown,
  ): unknown {
    const [, id, sub] = segments;

    if (id === undefined) {
      // /tasks
      if (method === 'GET') {
        return listTasks(this.load(), this.taskFilters(query));
      }
      if (method === 'POST') {
        const input = parseOrThrow(createTaskInputSchema, body);
        return this.write((s) => {
          const { snapshot, task } = createTask(s, input);
          return { snapshot, result: task };
        });
      }
    } else if (sub === undefined) {
      // /tasks/:id
      if (method === 'GET') {
        return getTask(this.load(), id);
      }
      if (method === 'PATCH') {
        const input = parseOrThrow(updateTaskInputSchema, body);
        return this.write((s) => {
          const { snapshot, task } = updateTask(s, id, input);
          return { snapshot, result: task };
        });
      }
      if (method === 'DELETE') {
        this.write((s) => ({ snapshot: deleteTask(s, id), result: undefined }));
        return undefined;
      }
    } else if (sub === 'progress' && segments[3] === undefined) {
      // /tasks/:id/progress
      if (method === 'GET') {
        return listProgress(this.load(), id);
      }
      if (method === 'POST') {
        const input = parseOrThrow(createProgressInputSchema, body);
        return this.write((s) => {
          const { snapshot, entry } = addProgress(s, id, input);
          return { snapshot, result: entry };
        });
      }
    } else if (sub === 'stages') {
      const stageId = segments[3];
      if (stageId === 'order' && segments[4] === undefined) {
        // /tasks/:id/stages/order
        if (method === 'PATCH') {
          const input = parseOrThrow(reorderStagesInputSchema, body);
          return this.write((s) => {
            const { snapshot, task } = reorderStages(s, id, input);
            return { snapshot, result: task };
          });
        }
      } else if (stageId === undefined && segments[4] === undefined) {
        // /tasks/:id/stages
        if (method === 'POST') {
          const input = parseOrThrow(addStageInputSchema, body);
          return this.write((s) => {
            const { snapshot, task } = addStage(s, id, input);
            return { snapshot, result: task };
          });
        }
      } else if (stageId !== undefined && segments[4] === undefined) {
        // /tasks/:id/stages/:stageId
        if (method === 'PATCH') {
          const input = parseOrThrow(updateStageInputSchema, body);
          return this.write((s) => {
            const { snapshot, task } = updateStage(s, id, stageId, input);
            return { snapshot, result: task };
          });
        }
        if (method === 'DELETE') {
          return this.write((s) => {
            const { snapshot, task } = deleteStage(s, id, stageId);
            return { snapshot, result: task };
          });
        }
      }
    } else if (sub === 'advance' && segments[3] === undefined) {
      // /tasks/:id/advance
      if (method === 'POST') {
        return this.write((s) => {
          const { snapshot, result } = advanceStage(s, id);
          return { snapshot, result };
        });
      }
    } else if (sub === 'current-stage' && segments[3] === undefined) {
      // /tasks/:id/current-stage
      if (method === 'PATCH') {
        const { stageId } = parseOrThrow(setCurrentStageInputSchema, body);
        return this.write((s) => {
          const { snapshot, task } = setCurrentStage(s, id, stageId);
          return { snapshot, result: task };
        });
      }
    }

    notFound(`未找到路由：${method} ${segments.join('/')}`);
  }

  private taskFilters(query: URLSearchParams): {
    statusIds?: string[];
    q?: string;
    stageStatus?: 'done' | 'pending';
  } {
    const statusIds = query.getAll('statusId');
    const q = query.get('q') ?? undefined;
    const stageStatusRaw = query.get('stageStatus');
    let stageStatus: 'done' | 'pending' | undefined;
    if (stageStatusRaw !== null) {
      if (stageStatusRaw !== 'done' && stageStatusRaw !== 'pending') {
        httpError(400, 'validation_error', `stageStatus 只能为 done|pending，收到：${stageStatusRaw}`);
      }
      stageStatus = stageStatusRaw;
    }
    return { statusIds: statusIds.length > 0 ? statusIds : undefined, q, stageStatus };
  }

  private routeStatuses(method: Method, segments: string[], body: unknown): unknown {
    const [, id] = segments;

    if (id === undefined) {
      // /statuses
      if (method === 'GET') {
        return listStatuses(this.load());
      }
      if (method === 'POST') {
        const input = parseOrThrow(createStatusInputSchema, body);
        return this.write((s) => {
          const { snapshot, category } = createStatus(s, input);
          return { snapshot, result: category };
        });
      }
    } else if (segments[2] === undefined) {
      // /statuses/:id
      if (method === 'PATCH') {
        const input = parseOrThrow(updateStatusInputSchema, body);
        return this.write((s) => {
          const { snapshot, category } = updateStatus(s, id, input);
          return { snapshot, result: category };
        });
      }
      if (method === 'DELETE') {
        const out = this.write((s) => {
          const { snapshot, conflictTaskIds } = deleteStatus(s, id);
          return { snapshot, result: conflictTaskIds };
        });
        if (out.length > 0) {
          httpError(409, 'status_in_use', `该分类下还有 ${out.length} 个任务，请先移动`, {
            taskIds: out,
          });
        }
        return undefined;
      }
    }

    notFound(`未找到路由：${method} ${segments.join('/')}`);
  }

  private routeExams(
    method: Method,
    segments: string[],
    query: URLSearchParams,
    body: unknown,
  ): unknown {
    const [, id, sub] = segments;

    if (id === undefined) {
      // /exams
      if (method === 'GET') {
        return listExams(this.load(), this.examFilters(query));
      }
      // POST /exams（注意 /exams/import 已在上面的分支处理）。
      if (method === 'POST') {
        const input = parseOrThrow(createExamInfoInputSchema, body);
        return this.write((s) => {
          const { snapshot, exam } = createExam(s, input);
          return { snapshot, result: exam };
        });
      }
    } else if (id === 'import' && sub === undefined) {
      // /exams/import（字面量路径，先于 /:id 匹配）
      if (method === 'POST') {
        const input = parseOrThrow(examsImportInputSchema, body);
        return this.write((s) => {
          const { snapshot, imported, skipped, items } = importExams(
            s,
            input.format,
            input.content,
          );
          const result: ExamsImportResult = { imported, skipped, items };
          return { snapshot, result };
        });
      }
    } else if (sub === 'to-task' && segments[3] === undefined) {
      // /exams/:id/to-task
      if (method === 'POST') {
        const input = parseOrThrow(convertExamToTaskInputSchema, body);
        return this.write((s) => {
          const { snapshot, task, exam } = convertExamToTask(s, id, input);
          return { snapshot, result: { task, exam } };
        });
      }
    } else if (sub === undefined) {
      // /exams/:id
      if (method === 'PATCH') {
        const input = parseOrThrow(updateExamInfoInputSchema, body);
        return this.write((s) => {
          const { snapshot, exam } = updateExam(s, id, input);
          return { snapshot, result: exam };
        });
      }
      if (method === 'DELETE') {
        this.write((s) => ({ snapshot: deleteExam(s, id), result: undefined }));
        return undefined;
      }
    }

    notFound(`未找到路由：${method} ${segments.join('/')}`);
  }

  private examFilters(query: URLSearchParams): {
    type?: 'exam' | 'interview';
    q?: string;
    status?: string;
  } {
    const typeRaw = query.get('type');
    if (typeRaw !== null && typeRaw !== 'exam' && typeRaw !== 'interview') {
      httpError(400, 'validation_error', `type 只能为 exam|interview，收到：${typeRaw}`);
    }
    return {
      type: typeRaw === null ? undefined : (typeRaw as 'exam' | 'interview'),
      q: query.get('q') ?? undefined,
      status: query.get('status') ?? undefined,
    };
  }
}

/** 客户端默认使用的单例（数据落在全局 localStorage）。 */
export const localStore = new LocalStore();