import type { CreateTaskInput, JobApplication } from '@task-list/shared';

/** 创建弹窗内的一个阶段草稿（仅弹窗本地编辑，提交时才规整为 CreateStageInput）。 */
export interface TaskCreateStageDraft {
  name: string;
  dueDate: string | null;
}

/** 求职信息草稿：五个字段均为纯文本，空串表示「未填写」。 */
export interface JobApplicationDraft {
  /** 投递岗位 */
  position: string;
  /** 公告链接 */
  announcementUrl: string;
  /** 简历链接 */
  resumeUrl: string;
  /** 投递链接 */
  applyUrl: string;
  /** 投递要求 */
  requirements: string;
}

/** 创建弹窗表单状态：与后端 CreateTaskInput 解耦，便于本地校验与默认值。 */
export interface TaskCreateFormState {
  title: string;
  company: string;
  tags: string[];
  statusId: string;
  stages: TaskCreateStageDraft[];
  notes: string;
  jobApplication: JobApplicationDraft;
}

/** 空求职信息草稿（新建弹窗初始 state）。 */
export function emptyJobApplicationDraft(): JobApplicationDraft {
  return {
    position: '',
    announcementUrl: '',
    resumeUrl: '',
    applyUrl: '',
    requirements: '',
  };
}

/** 从 Task.jobApplication 回填到编辑表单（null → 空草稿）。 */
export function jobApplicationDraftFrom(value: JobApplication | null): JobApplicationDraft {
  if (value === null) {
    return emptyJobApplicationDraft();
  }
  return {
    position: value.position ?? '',
    announcementUrl: value.announcementUrl ?? '',
    resumeUrl: value.resumeUrl ?? '',
    applyUrl: value.applyUrl ?? '',
    requirements: value.requirements ?? '',
  };
}

/**
 * 规整求职信息草稿：每个字段 trim 后为空 ⇒ 归一为 `null`；
 * 任一字段非 null ⇒ 组成 `JobApplication` 对象；全空 ⇒ `null`（即「非求职任务」）。
 */
export function normalizeJobApplication(draft: JobApplicationDraft): JobApplication | null {
  const trimOrNull = (value: string): string | null => {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  };
  const jobApplication: JobApplication = {
    position: trimOrNull(draft.position),
    announcementUrl: trimOrNull(draft.announcementUrl),
    resumeUrl: trimOrNull(draft.resumeUrl),
    applyUrl: trimOrNull(draft.applyUrl),
    requirements: trimOrNull(draft.requirements),
  };
  const hasAny = Object.values(jobApplication).some((value) => value !== null);
  return hasAny ? jobApplication : null;
}

const URL_FIELDS: ReadonlyArray<{ field: keyof JobApplication; label: string }> = [
  { field: 'announcementUrl', label: '公告链接' },
  { field: 'resumeUrl', label: '简历链接' },
  { field: 'applyUrl', label: '投递链接' },
];

/**
 * 仅接受 http/https 链接：可安全渲染为 `<a href>`，
 * 阻断 `javascript:` / `mailto:` / `ftp:` 等非跳转协议。
 */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface JobApplicationUrlError {
  field: keyof JobApplication;
  message: string;
}

/**
 * 校验三个 URL 字段（提交前规整）：空值不报错（归一为 null）；
 * 非空必须为合法 http/https 链接（后端 `.url()` 更宽松，此处按「可点击链接」从严）。
 * 传入 `original`（编辑态的任务持久化值）时，未改动的历史非 http 值（如 mailto:/ftp:）
 * 放行不报错，避免编辑弹窗被既有数据卡住；新增或改动为非法值仍会阻断。
 */
export function jobApplicationUrlErrors(
  draft: JobApplicationDraft,
  original?: JobApplication | null,
): JobApplicationUrlError[] {
  const normalized = normalizeJobApplication(draft);
  if (normalized === null) {
    return [];
  }

  const errors: JobApplicationUrlError[] = [];
  for (const { field, label } of URL_FIELDS) {
    const value = normalized[field];
    if (value === null || isHttpUrl(value)) {
      continue;
    }
    // 未改动的历史非 http 值放行（与持久化值逐字段比对）。
    if (original && value === original[field]) {
      continue;
    }
    errors.push({ field, message: `${label}不是有效链接` });
  }
  return errors;
}

/**
 * 把表单状态规整为后端 `CreateTaskInput`。
 *
 * - 标题 trim 后为空 ⇒ 返回 `null`（调用方据此拒绝提交）。
 * - company trim 后为空 ⇒ `null`。
 * - 阶段名 trim 后为空的草稿被过滤（可增删阶段导致空名残留）。
 * - 阶段 dueDate 空值统一为 `null`。
 * - jobApplication 经 `normalizeJobApplication` 规整：空串归一 null，全空 ⇒ null。
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
    jobApplication: normalizeJobApplication(state.jobApplication),
  };
}
