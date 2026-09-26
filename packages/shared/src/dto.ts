import { z } from 'zod';
import { taskSchema, stageSchema } from './domain';

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

/** 更新任务输入：全部可选，不含 id / createdAt 等不可变字段。 */
export const updateTaskInputSchema = createTaskInputSchema.partial();

export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;

/** 阶段流转结果：返回更新后的任务与下一个阶段（无则 null）。 */
export const advanceStageResultSchema = z.object({
  task: taskSchema,
  nextStage: stageSchema.nullable(),
});

export type AdvanceStageResult = z.infer<typeof advanceStageResultSchema>;