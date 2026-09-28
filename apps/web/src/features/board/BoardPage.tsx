import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStatuses } from '../../api/statuses';
import { useTasks } from '../../api/tasks';
import type { TaskListFilters } from '../../api/tasks';
import { boardCopy } from './board-copy';
import { FilterBar } from './FilterBar';
import { StatusColumn } from './StatusColumn';
import { filterTasks, useBoardFilters } from './useBoardFilters';
import { TaskCreateDialog } from '../task/TaskCreateDialog';
import './board.css';

export interface BoardPageProps {
  /** 固定时钟注入（测试 / 截图避免依赖真实时间），缺省为当前时间 */
  now?: Date;
}

/**
 * 看板页：按可编辑的状态分类分列，每张任务卡用图形化方式表达阶段进度，
 * 并支持多条件筛选（关键词 / 状态分类 / 阶段状态 / 截止时间）。
 * 本页只做「看 + 筛」；编辑与阶段流转走 `/tasks/:id`（LEOY-86）。
 *
 * 快捷新建（LEOY-104）：标题区主按钮 + 每个列头「＋」，统一打开 `TaskCreateDialog`；
 * 亦支持 URL 驱动开窗 `/board?new=1[&statusId=id]`（供首页概览等外部入口复用）。
 */
export function BoardPage({ now }: BoardPageProps = {}) {
  const statusesQuery = useStatuses();
  const [searchParams, setSearchParams] = useSearchParams();

  const [createOpen, setCreateOpen] = useState(false);
  const [createStatusId, setCreateStatusId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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

  // URL 驱动开窗：/board?new=1 自动打开创建弹窗，可选 statusId 预选分类；
  // 打开后从 URL 清除 new，避免刷新重复弹窗。
  const newParam = searchParams.get('new');
  useEffect(() => {
    if (newParam !== '1') return;
    setCreateStatusId(searchParams.get('statusId'));
    setCreateOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    setSearchParams(next, { replace: true });
  }, [newParam, searchParams, setSearchParams]);

  // 「已创建」轻提示自动消失。
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(id);
  }, [toast]);

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
      <div className="board-title-row">
        <h1 className="board-title">{boardCopy.pageTitle}</h1>
        <button
          type="button"
          className="board-add-primary"
          onClick={() => {
            setCreateStatusId(null);
            setCreateOpen(true);
          }}
        >
          ＋ 新建任务
        </button>
      </div>

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
                onAddTask={() => {
                  setCreateStatusId(category.id);
                  setCreateOpen(true);
                }}
              />
            ))}
          </div>
        </>
      )}

      <TaskCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        initialStatusId={createStatusId}
        onCreated={(task) => setToast(`已创建「${task.title}」`)}
      />

      {toast && (
        <div className="board-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}