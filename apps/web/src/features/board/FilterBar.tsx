import { useEffect, useState } from 'react';
import type { StatusCategory } from '@task-list/shared';
import { Button } from '../../ui';
import { boardCopy } from './board-copy';
import type { BoardFilterState, DueRangeFilter, StageStatusFilter } from './useBoardFilters';

interface FilterBarProps {
  statuses: StatusCategory[];
  filters: BoardFilterState;
  onKeywordChange: (q: string) => void;
  onSelectedStatusIdsChange: (next: string[] | null) => void;
  onStageStatusChange: (next: StageStatusFilter) => void;
  onDueRangeChange: (next: DueRangeFilter) => void;
  onReset: () => void;
}

/**
 * 筛选条：关键词（防抖 300ms）、状态分类多选（默认全选）、
 * 阶段状态、截止时间范围，以及「清除筛选」。
 * 读写一律通过 useBoardFilters 暴露的 setter，状态同步进 URL query。
 */
export function FilterBar(props: FilterBarProps) {
  const {
    statuses,
    filters,
    onKeywordChange,
    onSelectedStatusIdsChange,
    onStageStatusChange,
    onDueRangeChange,
    onReset,
  } = props;

  const [keyword, setKeyword] = useState(filters.q);

  // URL 被外部改动（如清除筛选 / 刷新恢复）时同步回输入框。
  useEffect(() => {
    setKeyword(filters.q);
  }, [filters.q]);

  // 关键词防抖 300ms。
  useEffect(() => {
    const timer = setTimeout(() => onKeywordChange(keyword), 300);
    return () => clearTimeout(timer);
  }, [keyword, onKeywordChange]);

  const allSelected = filters.selectedStatusIds === null;
  const selectedSet = allSelected
    ? new Set(statuses.map((s) => s.id))
    : new Set(filters.selectedStatusIds ?? []);

  function toggleStatus(id: string, checked: boolean) {
    if (checked) {
      if (allSelected) {
        // 全选态下勾选（实为取消单个之外的全选）→ 补成全选即可，此处保持全选。
        onSelectedStatusIdsChange(null);
      } else {
        onSelectedStatusIdsChange([...new Set([...(filters.selectedStatusIds ?? []), id])]);
      }
    } else if (allSelected) {
      onSelectedStatusIdsChange(statuses.filter((s) => s.id !== id).map((s) => s.id));
    } else {
      const next = (filters.selectedStatusIds ?? []).filter((x) => x !== id);
      onSelectedStatusIdsChange(next.length > 0 ? next : []);
    }
  }

  const hasActiveFilters =
    filters.q !== '' ||
    filters.selectedStatusIds !== null ||
    filters.stageStatus !== 'all' ||
    filters.dueRange !== 'all';

  return (
    <div className="board-filterbar">
      <label className="board-filter-keyword">
        <span className="board-filter-label">{boardCopy.keywordLabel}</span>
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={boardCopy.keywordPlaceholder}
          aria-label={boardCopy.keywordLabel}
        />
      </label>

      <fieldset className="board-filter-group">
        <legend>{boardCopy.statusFilterLabel}</legend>
        <div className="board-filter-status-actions">
          <Button variant="ghost" type="button" onClick={() => onSelectedStatusIdsChange(null)}>
            {boardCopy.statusAll}
          </Button>
          <Button variant="ghost" type="button" onClick={() => onSelectedStatusIdsChange([])}>
            {boardCopy.statusNone}
          </Button>
        </div>
        <div className="board-filter-status-list">
          {statuses.map((status) => (
            <label key={status.id} className="board-filter-status-item">
              <input
                type="checkbox"
                checked={selectedSet.has(status.id)}
                onChange={(e) => toggleStatus(status.id, e.target.checked)}
              />
              <span
                className="board-filter-status-swatch"
                style={{ backgroundColor: status.color }}
                aria-hidden="true"
              />
              {status.name}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="board-filter-group">
        <legend>{boardCopy.stageFilterLabel}</legend>
        {(
          [
            ['all', boardCopy.stageAll],
            ['pending', boardCopy.stagePending],
            ['done', boardCopy.stageDone],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="board-filter-radio">
            <input
              type="radio"
              name="board-stage-status"
              value={value}
              checked={filters.stageStatus === value}
              onChange={() => onStageStatusChange(value)}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <fieldset className="board-filter-group">
        <legend>{boardCopy.dueFilterLabel}</legend>
        {(
          [
            ['all', boardCopy.dueAll],
            ['this-week', boardCopy.dueThisWeek],
            ['overdue', boardCopy.dueOverdue],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="board-filter-radio">
            <input
              type="radio"
              name="board-due-range"
              value={value}
              checked={filters.dueRange === value}
              onChange={() => onDueRangeChange(value)}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <Button
        variant="secondary"
        type="button"
        className="board-filter-clear"
        onClick={onReset}
        disabled={!hasActiveFilters}
      >
        {boardCopy.clearFilters}
      </Button>
    </div>
  );
}
