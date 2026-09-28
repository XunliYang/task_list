import { randomUUID } from 'node:crypto';
import type {
  AddStageInput,
  AdvanceStageResult,
  CreateProgressInput,
  CreateTaskInput,
  DataSnapshot,
  ProgressEntry,
  ReorderStagesInput,
  Stage,
  StageStatus,
  Task,
  UpdateStageInput,
  UpdateTaskInput,
} from '@task-list/shared';
import { HttpError, notFound } from '../../http-error';

/** 进程内统一时间源（可被测试替换）。 */
export const now = (): string => new Date().toISOString();

export function uuid(): string {
  return randomUUID();
}

// ---------------------------------------------------------------------------
// 查询（纯读）
// ---------------------------------------------------------------------------

export function getTask(snapshot: DataSnapshot, taskId: string): Task {
  const task = snapshot.tasks.find((t) => t.id === taskId);
  if (!task) {
    throw notFound(`任务不存在：${taskId}`);
  }
  return task;
}

export function getStage(task: Task, stageId: string): Stage {
  const stage = task.stages.find((s) => s.id === stageId);
  if (!stage) {
    throw notFound(`阶段不存在：${stageId}`);
  }
  return stage;
}

export interface TaskFilters {
  /** 可重复的状态分类 id（交集为空时不筛选）。 */
  statusIds?: string[];
  /** 关键词，匹配 title / company / tags。 */
  q?: string;
  /** done=全部阶段已完成；pending=存在未完成阶段。 */
  stageStatus?: 'done' | 'pending';
}

export function listTasks(snapshot: DataSnapshot, filters: TaskFilters = {}): Task[] {
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

export function listProgress(snapshot: DataSnapshot, taskId: string): ProgressEntry[] {
  // 任务不存在时返回 404，保持该资源的 404 语义一致。
  getTask(snapshot, taskId);
  return snapshot.progressEntries
    .filter((entry) => entry.taskId === taskId)
    .sort((a, b) => b.at.localeCompare(a.at));
}

// ---------------------------------------------------------------------------
// 任务写操作（纯函数：snapshot 进入，新 snapshot 出去，immutable 更新）
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

/** 校验 statusId 是否指向已存在的状态分类，避免写入悬空外键。 */
function assertStatusExists(snapshot: DataSnapshot, statusId: string): void {
  if (!snapshot.statusCategories.some((c) => c.id === statusId)) {
    throw new HttpError(400, 'validation_error', `状态分类不存在：${statusId}`);
  }
}

export interface CreateTaskResult {
  snapshot: DataSnapshot;
  task: Task;
}

export function createTask(snapshot: DataSnapshot, input: CreateTaskInput): CreateTaskResult {
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

export interface UpdateTaskResult {
  snapshot: DataSnapshot;
  task: Task;
}

export function updateTask(
  snapshot: DataSnapshot,
  taskId: string,
  input: UpdateTaskInput,
): UpdateTaskResult {
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

export interface DeleteTaskResult {
  snapshot: DataSnapshot;
}

export function deleteTask(snapshot: DataSnapshot, taskId: string): DeleteTaskResult {
  getTask(snapshot, taskId);
  return {
    snapshot: {
      ...snapshot,
      tasks: snapshot.tasks.filter((t) => t.id !== taskId),
      // 级联删除其 progressEntries。
      progressEntries: snapshot.progressEntries.filter((e) => e.taskId !== taskId),
    },
  };
}

// ---------------------------------------------------------------------------
// 进展记录
// ---------------------------------------------------------------------------

export interface AddProgressResult {
  snapshot: DataSnapshot;
  entry: ProgressEntry;
}

export function addProgress(
  snapshot: DataSnapshot,
  taskId: string,
  input: CreateProgressInput,
): AddProgressResult {
  const task = getTask(snapshot, taskId);

  // stageId 若提供，必须属于该任务。
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

export interface UpdateStageResult {
  snapshot: DataSnapshot;
  task: Task;
}

export function updateStage(
  snapshot: DataSnapshot,
  taskId: string,
  stageId: string,
  input: UpdateStageInput,
): UpdateStageResult {
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

  // 重算「阶段前沿」：状态改动后 currentStageId 始终指向第一个未完成阶段（全部完成则末阶段）。
  const updated: Task = {
    ...task,
    stages,
    currentStageId: computeCurrentStageId(stages),
    updatedAt: now(),
  };
  return { snapshot: withTask(snapshot, updated), task: updated };
}

export interface AddStageResult {
  snapshot: DataSnapshot;
  task: Task;
}

export function addStage(
  snapshot: DataSnapshot,
  taskId: string,
  input: AddStageInput,
): AddStageResult {
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

export interface ReorderStagesResult {
  snapshot: DataSnapshot;
  task: Task;
}

export function reorderStages(
  snapshot: DataSnapshot,
  taskId: string,
  input: ReorderStagesInput,
): ReorderStagesResult {
  const task = getTask(snapshot, taskId);

  const existingIds = task.stages.map((s) => s.id);
  const existingSet = new Set(existingIds);
  const requestedSet = new Set(input.stageIds);

  const missing = existingIds.filter((id) => !requestedSet.has(id));
  const extra = input.stageIds.filter((id) => !existingSet.has(id));
  const hasDuplicate = requestedSet.size !== input.stageIds.length;

  if (missing.length > 0 || extra.length > 0 || hasDuplicate) {
    throw new HttpError(
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

export interface DeleteStageResult {
  snapshot: DataSnapshot;
  task: Task;
}

export function deleteStage(
  snapshot: DataSnapshot,
  taskId: string,
  stageId: string,
): DeleteStageResult {
  const task = getTask(snapshot, taskId);
  getStage(task, stageId);

  const remaining = normalizeStages(task.stages.filter((s) => s.id !== stageId));

  let currentStageId = task.currentStageId;
  if (task.currentStageId === stageId) {
    // 删除的是当前阶段：优先选第一个未完成阶段，否则选第一个阶段，均无则为 null。
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

export interface AdvanceStageOutcome {
  snapshot: DataSnapshot;
  result: AdvanceStageResult;
}

/**
 * 完成当前阶段并推进到下一个阶段。
 *
 * - 当前阶段（currentStageId 指向、状态非 done）→ 置 done（completedAt=now）。
 * - 取 order 更大的 pending 阶段置 in_progress 并设为 currentStageId。
 * - 已是末阶段时 nextStage=null，currentStageId 保留为已完成的末阶段。
 * - 自动追加一条 ProgressEntry（summary=`完成阶段「<name>」`）。
 * - 幂等：当前阶段已为 done（无更多可推进阶段）时不报错、不追加记录。
 */
export function advanceStage(snapshot: DataSnapshot, taskId: string): AdvanceStageOutcome {
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

  // 返回映射后的副本，保证 nextStage.status 与 task.stages 内一致（in_progress）。
  const nextUpdated = next ? updatedStages.find((s) => s.id === next.id) ?? null : null;

  return {
    snapshot: {
      ...withTask(snapshot, updated),
      progressEntries: [...snapshot.progressEntries, entry],
    },
    result: { task: updated, nextStage: nextUpdated },
  };
}

export interface SetCurrentStageResult {
  snapshot: DataSnapshot;
  task: Task;
}

/**
 * 手动回退 / 切换当前阶段。
 *
 * - 目标阶段置 in_progress（清空 completedAt）。
 * - order 更大的阶段若为 done，回退为 pending（保持「当前阶段之后不应有已完成」的前沿不变式）。
 */
export function setCurrentStage(
  snapshot: DataSnapshot,
  taskId: string,
  stageId: string,
): SetCurrentStageResult {
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