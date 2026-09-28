import type { Stage, Task } from '@task-list/shared';

/** 阶段按 order 升序返回副本。 */
export function sortedStages(stages: Stage[]): Stage[] {
  return [...stages].sort((a, b) => a.order - b.order);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Date 转本地 'YYYY-MM-DD'。 */
export function toDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 格式化 ISO datetime 为本地可读字符串。 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 阶段逾期：有截止时间、早于今天、且未完成。 */
export function isStageOverdue(stage: Stage, today: Date = new Date()): boolean {
  if (!stage.dueDate || stage.status === 'done') return false;
  return stage.dueDate < toDayKey(today);
}

export interface FlowAction {
  label: string;
  disabled: boolean;
  kind: 'advance' | 'none';
}

/** 阶段流转主按钮的文案与可用性（纯函数，便于单测）。 */
export function getFlowAction(task: Task): FlowAction {
  const stages = sortedStages(task.stages);
  if (stages.length === 0) {
    return { label: '暂无阶段可流转', disabled: true, kind: 'none' };
  }
  if (stages.every((s) => s.status === 'done')) {
    return { label: '全部阶段已完成', disabled: true, kind: 'none' };
  }
  const current = stages.find((s) => s.id === task.currentStageId);
  if (!current) {
    return { label: '无当前阶段', disabled: true, kind: 'none' };
  }
  const isLast = current.id === stages[stages.length - 1].id;
  if (isLast) {
    return { label: '完成最后一个阶段', disabled: false, kind: 'advance' };
  }
  return { label: `完成「${current.name}」并进入下一阶段`, disabled: false, kind: 'advance' };
}

/** 当前阶段之前的那一个阶段（回退目标），无则 null。 */
export function previousStage(task: Task): Stage | null {
  const stages = sortedStages(task.stages);
  const idx = stages.findIndex((s) => s.id === task.currentStageId);
  if (idx <= 0) return null;
  return stages[idx - 1];
}