import { useId, useState } from 'react';
import { normalizeJobApplication } from './task-create';
import type { JobApplicationDraft } from './task-create';

export interface JobApplicationFieldsProps {
  value: JobApplicationDraft;
  onChange: (value: JobApplicationDraft) => void;
  /** 字段级错误提示（key 为字段名）。 */
  errors: Record<string, string>;
}

function hasContent(value: JobApplicationDraft): boolean {
  return normalizeJobApplication(value) !== null;
}

/**
 * 「求职信息」可折叠分区（创建/编辑弹窗共用）：
 * 投递岗位 / 公告链接 / 简历链接 / 投递链接（type=url）/ 投递要求（多行）。
 *
 * 默认折叠（无内容时收起，不占用表单视觉空间）；已有内容时默认展开。
 */
export function JobApplicationFields({ value, onChange, errors }: JobApplicationFieldsProps) {
  const fieldId = useId();
  const [open, setOpen] = useState(() => hasContent(value));

  const setField = (field: keyof JobApplicationDraft, fieldValue: string) =>
    onChange({ ...value, [field]: fieldValue });

  const hasError = Object.values(errors).some((message) => Boolean(message));

  return (
    <div className="job-application">
      <button
        type="button"
        className="job-application-toggle"
        aria-expanded={open}
        aria-controls={fieldId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        求职信息
      </button>
      {!open && hasError && <p className="field-error">求职信息中的链接格式不正确</p>}
      {open && (
        <div id={fieldId} className="job-application-fields">
          <label>
            投递岗位
            <input
              value={value.position}
              onChange={(e) => setField('position', e.target.value)}
              aria-label="投递岗位"
            />
          </label>

          <label>
            公告链接
            <input
              type="url"
              value={value.announcementUrl}
              onChange={(e) => setField('announcementUrl', e.target.value)}
              aria-label="公告链接"
              placeholder="https://…"
            />
          </label>
          {errors.announcementUrl && <p className="field-error">{errors.announcementUrl}</p>}

          <label>
            简历链接
            <input
              type="url"
              value={value.resumeUrl}
              onChange={(e) => setField('resumeUrl', e.target.value)}
              aria-label="简历链接"
              placeholder="https://…"
            />
          </label>
          {errors.resumeUrl && <p className="field-error">{errors.resumeUrl}</p>}

          <label>
            投递链接
            <input
              type="url"
              value={value.applyUrl}
              onChange={(e) => setField('applyUrl', e.target.value)}
              aria-label="投递链接"
              placeholder="https://…"
            />
          </label>
          {errors.applyUrl && <p className="field-error">{errors.applyUrl}</p>}

          <label>
            投递要求
            <textarea
              value={value.requirements}
              onChange={(e) => setField('requirements', e.target.value)}
              aria-label="投递要求"
            />
          </label>
        </div>
      )}
    </div>
  );
}
