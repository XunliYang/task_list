import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { Task } from '@task-list/shared';
import { taskKeys } from '../../api/query-keys';
import { useStatuses } from '../../api/statuses';
import { useTasks, useUpdateTask } from '../../api/tasks';
import type { TaskListFilters } from '../../api/tasks';
import { boardCopy } from './board-copy';
import { resolveDrop } from './column-drop';
import { FilterBar } from './FilterBar';
import { StatusColumn } from './StatusColumn';
import { filterTasks, useBoardFilters } from './useBoardFilters';
import { TaskCreateDialog } from '../task/TaskCreateDialog';
import { SuccessMorphButton } from '../../ui';
import './board.css';

export interface BoardPageProps {
  /** 固定时钟注入（测试 / 截图避免依赖真实时间），缺省为当前时间 */
  now?: Date;
}

interface PendingDrop {
  taskId: string;
  fromStatusId: string;
  toStatusId: string;
}

/** 把（若有）任务列表中的指定任务改到目标列，返回新数组（保持原引用避免多余重渲染）。 */
function moveTaskInList(tasks: Task[] | undefined, taskId: string, statusId: string): Task[] | undefined {
  if (!tasks) return tasks;
  let changed = false;
  const next = tasks.map((t) => {
    if (t.id === taskId && t.statusId !== statusId) {
      changed = true;
      return { ...t, statusId };
    }
    return t;
  });
  return changed ? next : tasks;
}

/**
 * 看板页：按可编辑的状态分类分列，每张任务卡用图形化方式表达阶段进度，
 * 并支持多条件筛选（关键词 / 状态分类 / 阶段状态 / 截止时间）。
 * 本页只做「看 + 筛」；编辑与阶段流转走 `/tasks/:id`（LEOY-86）。
 *
 * 快捷新建（LEOY-104）：标题区主按钮 + 每个列头「＋」，统一打开 `TaskCreateDialog`；
 * 亦支持 URL 驱动开窗 `/board?new=1[&statusId=id]`（供首页概览等外部入口复用）。
 *
 * 拖拽改状态（LEOY-103）：drop → `useUpdateTask(taskId).mutate({ statusId })`，
 * 乐观更新把任务先挪到新列，失败回滚旧列并顶部提示，成功后 invalidate 回落服务端数据。
 */
export function BoardPage({ now }: BoardPageProps = {}) {
  const queryClient = useQueryClient();
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

  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

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

  // 待变更的任务 id → 决定 useUpdateTask(id) 打哪个接口。
  const updateTask = useUpdateTask(pendingDrop?.taskId ?? '');

  const filteredTasks = useMemo(
    () => filterTasks(tasksQuery.data ?? [], filters, effectiveNow),
    [tasksQuery.data, filters, effectiveNow],
  );

  const handleTaskDrop = useCallback(
    (taskId: string, toStatusId: string) => {
      const task = tasksQuery.data?.find((t) => t.id === taskId);
      if (!task) return;
      const { shouldMutate, nextStatusId } = resolveDrop({
        taskId,
        fromStatusId: task.statusId,
        toStatusId,
      });
      if (!shouldMutate || !nextStatusId) return;
      setMoveError(null);
      setPendingDrop({ taskId, fromStatusId: task.statusId, toStatusId: nextStatusId });
    },
    [tasksQuery.data],
  );

  useEffect(() => {
    if (!pendingDrop) return;
    const { taskId, fromStatusId, toStatusId } = pendingDrop;

    // 乐观更新：先把任务从旧列移到新列。
    queryClient.setQueriesData<Task[]>(
      { queryKey: taskKeys.lists() },
      (old) => moveTaskInList(old, taskId, toStatusId),
    );

    updateTask.mutate(
      { statusId: toStatusId },
      {
        onError: () => {
          // 回滚：任务回到旧列 + 顶部可见错误提示。
          queryClient.setQueriesData<Task[]>(
            { queryKey: taskKeys.lists() },
            (old) => moveTaskInList(old, taskId, fromStatusId),
          );
          setMoveError(boardCopy.moveError);
        },
        onSettled: () => {
          void queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
          setPendingDrop(null);
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDrop]);

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
        <SuccessMorphButton
          variant="primary"
          successLabel="已打开"
          onAction={() => {
            setCreateStatusId(null);
            setCreateOpen(true);
          }}
        >
          ＋ 新建任务
        </SuccessMorphButton>
      </div>

      {moveError ? (
        <p className="board-move-error" role="alert">
          {moveError}
        </p>
      ) : null}

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
                categories={statuses}
                tasks={filteredTasks.filter((t) => t.statusId === category.id)}
                onTaskDrop={handleTaskDrop}
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