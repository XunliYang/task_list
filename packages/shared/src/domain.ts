import { z } from 'zod';

// ============================================================================
// 阶段（Stage）：任务是「一串有序阶段」，进度由阶段推导，不单独存百分比。
// ============================================================================

export const STAGE_STATUSES = ['pending', 'in_progress', 'done'] as const;

export const stageStatusSchema = z.enum(STAGE_STATUSES);

export type StageStatus = (typeof STAGE_STATUSES)[number];

export const stageSchema = z.object({
  /** 稳定 id（nanoid/uuid） */
  id: z.string().min(1),
  /** 如「笔试」「一面」 */
  name: z.string().min(1),
  /** 从 0 递增，唯一 */
  order: z.number().int().nonnegative(),
  status: stageStatusSchema,
  /** ISO date 'YYYY-MM-DD'，可空 */
  dueDate: z.string().nullable(),
  /** ISO datetime */
  completedAt: z.string().nullable(),
});

export type Stage = z.infer<typeof stageSchema>;

// ============================================================================
// 任务状态分类（可编辑的字典，不是硬编码枚举）
// ============================================================================

export const statusCategorySchema = z.object({
  id: z.string().min(1),
  /** 如「进行中」「已挂」 */
  name: z.string().min(1),
  /** hex，前端用于着色 */
  color: z.string().min(1),
  order: z.number().int(),
});

export type StatusCategory = z.infer<typeof statusCategorySchema>;

// ============================================================================
// 任务（Task）
// ============================================================================

export const taskSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    company: z.string().nullable(),
    /** 外键 → StatusCategory */
    statusId: z.string().min(1),
    tags: z.array(z.string()),
    /** 有序；进度 = done 阶段数 / 总阶段数 */
    stages: z.array(stageSchema),
    /** 当前所处阶段（阶段流转的操作对象） */
    currentStageId: z.string().nullable(),
    notes: z.string(),
    /** ISO datetime */
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .superRefine((task, ctx) => {
    // Stage.order 在同一任务内必须唯一。
    const seen = new Set<number>();
    task.stages.forEach((stage, index) => {
      if (seen.has(stage.order)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Stage.order must be unique within a task, duplicated: ${stage.order}`,
          path: ['stages', index, 'order'],
        });
      }
      seen.add(stage.order);
    });

    // currentStageId 必须指向任务内某个已存在的阶段。
    if (
      task.currentStageId !== null &&
      !task.stages.some((stage) => stage.id === task.currentStageId)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'currentStageId must reference an existing stage',
        path: ['currentStageId'],
      });
    }
  });

export type Task = z.infer<typeof taskSchema>;

// ============================================================================
// 进展记录（时间线：新增当前进展）
// ============================================================================

export const progressEntrySchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  /** ISO datetime */
  at: z.string(),
  summary: z.string(),
  /** 该条进展发生在哪个阶段 */
  stageId: z.string().nullable(),
});

export type ProgressEntry = z.infer<typeof progressEntrySchema>;

// ============================================================================
// 考试/面试信息（预留页面用）
// ============================================================================

export const examInfoSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(['exam', 'interview']),
  company: z.string().nullable(),
  source: z.enum(['manual', 'import']),
  /** ISO date */
  deadline: z.string().nullable(),
  appliedAt: z.string().nullable(),
  url: z.string().nullable(),
  location: z.string().nullable(),
  /** 自由文本（如「待报名」） */
  status: z.string(),
  notes: z.string(),
  /** 已转为任务时回链 */
  taskId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ExamInfo = z.infer<typeof examInfoSchema>;

// ============================================================================
// 全量持久化文档（单一 JSON 文档，见架构 ADR-3）
// ============================================================================

export const dataSnapshotSchema = z.object({
  version: z.literal(1),
  tasks: z.array(taskSchema),
  statusCategories: z.array(statusCategorySchema),
  progressEntries: z.array(progressEntrySchema),
  examInfos: z.array(examInfoSchema),
});

export type DataSnapshot = z.infer<typeof dataSnapshotSchema>;