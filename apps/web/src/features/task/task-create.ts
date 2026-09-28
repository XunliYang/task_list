import type { CreateTaskInput } from '@task-list/shared';

/** 创建弹窗内的一个阶段草稿（仅弹窗本地编辑，提交时才规整为 CreateStageInput）。 */
export interface TaskCreateStageDraft {
  name: string;
  dueDate: string | null;
}

/** 创建弹窗表单状态：与后端 CreateTaskInput 解耦，便于本地校验与默认值。 */
export interface TaskCreateFormState {
  title: string;
  company: string;
  tags: string[];
  statusId: string;
  stages: TaskCreateStageDraft[];
  notes: string;
}

/**
 * 把表单状态规整为后端 `CreateTaskInput`。
 *
 * - 标题 trim 后为空 ⇒ 返回 `null`（调用方据此拒绝提交）。
 * - company trim 后为空 ⇒ `null`。
 * - 阶段名 trim 后为空的草稿被过滤（可增删阶段导致空名残留）。
 * - 阶段 dueDate 空值统一为 `null`。
 *
 * 返回的对象总是干净、可直接提交的。
 */
export function buildCreateTaskInput(state: TaskCreateFormState): CreateTaskInput | null {
  const title = state.title.trim();
  if (title.length === 0) {
    return null;
  }

  const company = state.company.trim();
  const stages = state.stages
    .map((stage) => ({
      name: stage.name.trim(),
      dueDate: stage.dueDate ? stage.dueDate : null,
    }))
    .filter((stage) => stage.name.length > 0);

  return {
    title,
    company: company === '' ? null : company,
    tags: state.tags,
    statusId: state.statusId,
    stages,
    notes: state.notes,
  };
}
