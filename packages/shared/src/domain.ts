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
// 求职信息（JobApplication）：任务中加入公告/简历/投递链接、投递岗位/要求。
// null 表示「非求职类任务」；任一字段填写即视为求职任务。
// ============================================================================

/** 规整层：空串 / 纯空白归一为 null（URL 与文本字段统一处理）。 */
const emptyToNull = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? null : value;

export const jobApplicationSchema = z.object({
  /** 公告链接 */
  announcementUrl: z.preprocess(emptyToNull, z.string().url().nullable()),
  /** 简历链接 */
  resumeUrl: z.preprocess(emptyToNull, z.string().url().nullable()),
  /** 投递链接 */
  applyUrl: z.preprocess(emptyToNull, z.string().url().nullable()),
  /** 投递岗位 */
  position: z.preprocess(emptyToNull, z.string().nullable()),
  /** 投递要求 */
  requirements: z.preprocess(emptyToNull, z.string().nullable()),
});

export type JobApplication = z.infer<typeof jobApplicationSchema>;

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
    /** 求职信息：null 表示非求职类任务（缺省键在解析时归一为 null） */
    jobApplication: jobApplicationSchema.nullable().default(null),
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
// 最近进展聚合投影（GET /api/progress 只读跨任务聚合；ProgressEntry + 联出的 taskTitle）
// ============================================================================

export const recentProgressEntrySchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  /** 联出的任务标题（侧栏展示与跳转详情用） */
  taskTitle: z.string(),
  /** ISO datetime（原 ProgressEntry.at） */
  at: z.string(),
  summary: z.string(),
  /** 该条进展发生在哪个阶段 */
  stageId: z.string().nullable(),
});

export type RecentProgressEntry = z.infer<typeof recentProgressEntrySchema>;

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