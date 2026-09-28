import { z } from 'zod';
import { examInfoSchema, stageStatusSchema, taskSchema, stageSchema } from './domain';

// ============================================================================
// 创建/更新用的 DTO
// ============================================================================

/** 创建任务时传入的阶段（id / order / status / completedAt 由服务端生成） */
export const createStageInputSchema = z.object({
  name: z.string().min(1),
  /** ISO date 'YYYY-MM-DD' */
  dueDate: z.string().nullable().optional(),
});

export type CreateStageInput = z.infer<typeof createStageInputSchema>;

/** 新增阶段输入（与 CreateStageInput 同构） */
export const addStageInputSchema = createStageInputSchema;

export type AddStageInput = z.infer<typeof addStageInputSchema>;

/** 更新阶段输入：name / dueDate / status 均可选 */
export const updateStageInputSchema = z.object({
  name: z.string().min(1).optional(),
  dueDate: z.string().nullable().optional(),
  status: stageStatusSchema.optional(),
});

export type UpdateStageInput = z.infer<typeof updateStageInputSchema>;

/** 批量重排阶段输入：按新顺序给出该任务全部阶段 id。 */
export const reorderStagesInputSchema = z.object({
  stageIds: z.array(z.string().min(1)).min(1),
});

export type ReorderStagesInput = z.infer<typeof reorderStagesInputSchema>;

/**
 * 创建任务输入。
 * tags / notes 提供默认值，服务端据此生成完整 Task（id / createdAt 等由服务端生成）。
 */
export const createTaskInputSchema = z.object({
  title: z.string().min(1),
  company: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().default(''),
  statusId: z.string().min(1),
  stages: z.array(createStageInputSchema),
});

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

/** 更新任务输入：全部可选，不含 id / createdAt 等不可变字段；阶段整组替换走独立阶段端点。 */
export const updateTaskInputSchema = createTaskInputSchema.omit({ stages: true }).partial();

export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;

/** 阶段流转结果：返回更新后的任务与下一个阶段（无则 null）。 */
export const advanceStageResultSchema = z.object({
  task: taskSchema,
  nextStage: stageSchema.nullable(),
});

export type AdvanceStageResult = z.infer<typeof advanceStageResultSchema>;

/** 手动回退/切换当前阶段输入。 */
export const setCurrentStageInputSchema = z.object({
  stageId: z.string().min(1),
});

export type SetCurrentStageInput = z.infer<typeof setCurrentStageInputSchema>;

// ============================================================================
// 状态分类 DTO
// ============================================================================

/** 创建状态分类输入。 */
export const createStatusInputSchema = z.object({
  name: z.string().min(1),
  color: z.string().min(1),
  order: z.number().int().optional(),
});

export type CreateStatusInput = z.infer<typeof createStatusInputSchema>;

/** 更新状态分类输入：全部可选。 */
export const updateStatusInputSchema = createStatusInputSchema.partial();

export type UpdateStatusInput = z.infer<typeof updateStatusInputSchema>;

// ============================================================================
// 进展记录 DTO
// ============================================================================

/** 新增进展输入。 */
export const createProgressInputSchema = z.object({
  summary: z.string().min(1),
  stageId: z.string().nullable().optional(),
});

export type CreateProgressInput = z.infer<typeof createProgressInputSchema>;

// ============================================================================
// 考试/面试信息 DTO
// ============================================================================

/** 创建考试/面试信息输入。 */
export const createExamInfoInputSchema = z.object({
  title: z.string().min(1),
  type: z.enum(['exam', 'interview']),
  company: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  appliedAt: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateExamInfoInput = z.infer<typeof createExamInfoInputSchema>;

/** 更新考试/面试信息输入：全部可选。 */
export const updateExamInfoInputSchema = createExamInfoInputSchema.partial();

export type UpdateExamInfoInput = z.infer<typeof updateExamInfoInputSchema>;

/** 批量导入输入：内容为文本本身（非 multipart）。 */
export const examsImportInputSchema = z.object({
  format: z.enum(['csv', 'json']),
  content: z.string().min(1),
});

export type ExamsImportInput = z.infer<typeof examsImportInputSchema>;

/** 批量导入结果。 */
export const examsImportResultSchema = z.object({
  imported: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  items: z.array(examInfoSchema),
});

export type ExamsImportResult = z.infer<typeof examsImportResultSchema>;

/** 「转任务」输入。 */
export const convertExamToTaskInputSchema = z.object({
  statusId: z.string().min(1).optional(),
  stages: z.array(createStageInputSchema).optional(),
});

export type ConvertExamToTaskInput = z.infer<typeof convertExamToTaskInputSchema>;