import { useMemo } from 'react';
import { useStatuses } from '../../api/statuses';
import { useTasks } from '../../api/tasks';
import type { TaskListFilters } from '../../api/tasks';
import { boardCopy } from './board-copy';
import { FilterBar } from './FilterBar';
import { StatusColumn } from './StatusColumn';
import { filterTasks, useBoardFilters } from './useBoardFilters';
import './board.css';

export interface BoardPageProps {
  /** 固定时钟注入（测试 / 截图避免依赖真实时间），缺省为当前时间 */
  now?: Date;
}

/**
 * 看板页：按可编辑的状态分类分列，每张任务卡用图形化方式表达阶段进度，
 * 并支持多条件筛选（关键词 / 状态分类 / 阶段状态 / 截止时间）。
 * 本页只做「看 + 筛」；编辑与阶段流转走 `/tasks/:id`（LEOY-86）。
 */
export function BoardPage({ now }: BoardPageProps = {}) {
  const statusesQuery = useStatuses();
  const {
    filters,
    setKeyword,
    setSelectedStatusIds,
    setStageStatus,
    setDueRange,
    resetFilters,
  } = useBoardFilters();

  const statuses = useMemo(
    () => [...(statusesQuery.data ?? [])].sort((a, b) => a.order - b.order),
    [statusesQuery.data],
  );

  const effectiveNow = now ?? new Date();

  const noStatusSelected =
    filters.selectedStatusIds !== null && filters.selectedStatusIds.length === 0;

  // statusId / q / stageStatus 交给服务端 `GET /api/tasks`（以服务端筛选为准）。
  const serverFilters: TaskListFilters = useMemo(() => {
    const f: TaskListFilters = {};
    if (!noStatusSelected && filters.selectedStatusIds && filters.selectedStatusIds.length > 0) {
      f.statusIds = filters.selectedStatusIds;
    }
    const q = filters.q.trim();
    if (q) f.q = q;
    if (filters.stageStatus !== 'all') f.stageStatus = filters.stageStatus;
    return f;
  }, [filters.selectedStatusIds, filters.q, filters.stageStatus, noStatusSelected]);

  const tasksQuery = useTasks(serverFilters);

  const filteredTasks = useMemo(
    () => filterTasks(tasksQuery.data ?? [], filters, effectiveNow),
    [tasksQuery.data, filters, effectiveNow],
  );

  if (statusesQuery.isLoading || tasksQuery.isLoading) {
    return (
      <p className="board-state" role="status">
        {boardCopy.loading}
      </p>
    );
  }

  if (statusesQuery.isError || tasksQuery.isError) {
    const retry = () => {
      statusesQuery.refetch();
      tasksQuery.refetch();
    };
    return (
      <div className="board-state" role="alert">
        <p>{boardCopy.loadError}</p>
        <button type="button" onClick={retry}>
          {boardCopy.retry}
        </button>
      </div>
    );
  }

  return (
    <div className="board-page">
      <h1 className="board-title">{boardCopy.pageTitle}</h1>

      <FilterBar
        statuses={statuses}
        filters={filters}
        onKeywordChange={setKeyword}
        onSelectedStatusIdsChange={setSelectedStatusIds}
        onStageStatusChange={setStageStatus}
        onDueRangeChange={setDueRange}
        onReset={resetFilters}
      />

      {statuses.length === 0 ? (
        <p className="board-state">{boardCopy.noStatuses}</p>
      ) : (
        <>
          {filteredTasks.length === 0 ? (
            <p className="board-state">{boardCopy.noTasks}</p>
          ) : null}
          <div className="board-columns">
            {statuses.map((category) => (
              <StatusColumn
                key={category.id}
                category={category}
                tasks={filteredTasks.filter((t) => t.statusId === category.id)}
                now={effectiveNow}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
