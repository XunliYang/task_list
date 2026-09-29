import { useState } from 'react';
import type { CSSProperties, DragEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from './Badge';
import { StatusDot } from './StatusDot';
import './Row.css';

export type RowStageStatus = 'pending' | 'in_progress' | 'done';

export interface RowStage {
  id: string;
  name: string;
  status: RowStageStatus;
  dueDate?: string | null;
}

export interface RowMoveTarget {
  id: string;
  name: string;
}

export const rowCopy = {
  detailLabel: '查看任务详情',
  moveLabel: '移动到…',
  moveMenuLabel: '选择目标状态分类',
  progressLabel: '阶段进度',
  dueLabel: '截止',
  overdueSuffix: '逾期',
} as const;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** 行内「截止」列与逾期判定（纯函数，固定 now 可注入）：截止取未完成阶段最早到期日。 */
export function rowDeadline(
  stages: readonly RowStage[],
  now: Date = new Date(),
): { dueDate: string | null; overdue: boolean } {
  let dueDate: string | null = null;
  let overdue = false;
  const today = startOfDay(now);
  for (const stage of stages) {
    if (stage.status === 'done' || !stage.dueDate) continue;
    const due = parseIsoDate(stage.dueDate);
    if (!due) continue;
    if (dueDate === null || stage.dueDate < dueDate) dueDate = stage.dueDate;
    if (due.getTime() < today.getTime()) overdue = true;
  }
  return { dueDate, overdue };
}

export interface RowProps {
  /** 状态分类色（注入状态点 + 进度已完成段） */
  statusColor: string;
  statusName: string;
  /** 是否处于进行中（状态点脉冲；通常由消费方告知） */
  statusActive?: boolean;
  title: string;
  company?: string | null;
  /** 可选次要说明行（日历侧用于展示「阶段 / 当前阶段 / 更新于」等上下文） */
  subtitle?: string | null;
  tags?: readonly string[];
  /** 阶段（按 order 升序传入）；图形化进度 = done/total */
  stages?: readonly RowStage[];
  /** 整行点击进入详情页的地址（/tasks/:id） */
  href: string;
  /** 行尾 ⋯ 菜单的「移动到…」目标；提供时渲染键盘可达替代路径 */
  moveTargets?: readonly RowMoveTarget[];
  onMoveTo?: (targetId: string) => void;
  /** 拖拽由消费方注入 */
  draggable?: boolean;
  onDragStart?: (e: DragEvent<HTMLLIElement>) => void;
  onDragEnd?: () => void;
  /** 固定时钟（测试 / 截图），缺省当前时间 */
  now?: Date;
}

/**
 * 任务行 —— 「每个任务用行展示」的唯一结构。
 * [状态点] [标题 15/500] [公司] [标签 chips] · [图形化进度 n/m] [截止，逾期标红] [⋯ →]
 */
export function Row({
  statusColor,
  statusName,
  statusActive = false,
  title,
  company,
  subtitle,
  tags,
  stages,
  href,
  moveTargets,
  onMoveTo,
  draggable = false,
  onDragStart,
  onDragEnd,
  now,
}: RowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const effectiveNow = now ?? new Date();
  // 阶段按 order 升序由消费方传入，这里保持原序即可。
  const sorted = stages ?? [];
  const total = sorted.length;
  const done = sorted.filter((s) => s.status === 'done').length;
  const due = rowDeadline(sorted, effectiveNow);

  const accentStyle = { '--row-status': statusColor } as CSSProperties;

  const handleMoveMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') setMenuOpen(false);
  };

  return (
    <li
      className="ui-row"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      data-testid="row"
    >
      <Link to={href} className="ui-row-link" aria-label={`${rowCopy.detailLabel}：${title}`}>
        <StatusDot
          color={statusColor}
          label={statusName}
          status={statusActive ? 'in_progress' : 'pending'}
        />

        <div className="ui-row-main">
          <span className="ui-row-title">{title}</span>
          {company ? <span className="ui-row-company">{company}</span> : null}
          {subtitle ? <span className="ui-row-subtitle">{subtitle}</span> : null}
        </div>

        {tags && tags.length > 0 ? (
          <span className="ui-row-tags">
            {tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </span>
        ) : null}

        <div className="ui-row-progress">
          {total > 0 ? (
            <span
              className="ui-row-progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={done}
              aria-label={`${rowCopy.progressLabel} ${done}/${total}`}
              style={accentStyle}
            >
              {sorted.map((stage) => (
                <span
                  key={stage.id}
                  className={`ui-row-progress-seg ${
                    stage.status === 'done' ? 'ui-row-progress-seg--done' : ''
                  } ${
                    stage.status === 'in_progress' ? 'ui-row-progress-seg--current' : ''
                  }`}
                  data-testid="row-stage-segment"
                  data-status={stage.status}
                />
              ))}
            </span>
          ) : (
            <span className="ui-row-progress-empty">—</span>
          )}
          <span className="ui-row-progress-count">
            {done}/{total}
          </span>
        </div>

        <span
          className={due.overdue ? 'ui-row-due ui-row-due--overdue' : 'ui-row-due'}
        >
          {due.dueDate ? (
            <>
              {due.dueDate}
              {due.overdue ? ` · ${rowCopy.overdueSuffix}` : ''}
            </>
          ) : (
            '—'
          )}
        </span>

        <span className="ui-row-chevron" aria-hidden="true">
          →
        </span>
      </Link>

      {moveTargets && moveTargets.length > 0 ? (
        <div className="ui-row-actions" onKeyDown={handleMoveMenuKeyDown}>
          <button
            type="button"
            className="ui-row-move"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={rowCopy.moveLabel}
            title={rowCopy.moveLabel}
            onClick={() => setMenuOpen((open) => !open)}
          >
            ⋯
          </button>
          {menuOpen ? (
            <ul className="ui-row-menu" role="menu" aria-label={rowCopy.moveMenuLabel}>
              {moveTargets.map((t) => (
                <li key={t.id} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="ui-row-menu-item"
                    onClick={() => {
                      setMenuOpen(false);
                      onMoveTo?.(t.id);
                    }}
                  >
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}