import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { StatusCategory, UpdateStatusInput } from '@task-list/shared';
import { ApiError } from '../../api/client';
import {
  useCreateStatus,
  useDeleteStatus,
  useStatuses,
  useUpdateStatus,
} from '../../api/statuses';
import { useTasks } from '../../api/tasks';
import { readableTextColor } from '../task/task-utils';
import { buildReorderPlan, moveItem } from './status-order';
import './status.css';

/** 统一从后端错误中取可读 message，非 ApiError 时退回兜底文案。 */
function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.message) return err.message;
  return fallback;
}

interface StatusRowProps {
  category: StatusCategory;
  count: number;
  index: number;
  total: number;
  /** 任一调序请求进行中时禁用整表 ↑/↓，防连点产生交错请求。 */
  reorderDisabled: boolean;
  /** 父级写入的行内错误（删除 409 / 调序失败）。 */
  rowError: string | null;
  onMove: (offset: 1 | -1) => void;
  onDelete: () => void;
  /** 显式保存：返回 Promise 供行内 await，成功给轻提示、失败展示后端 message。 */
  onSave: (input: UpdateStatusInput) => Promise<unknown>;
}

/** 单行状态分类：改名/改色走显式保存（Enter 提交、Esc 取消），保存/取消按需出现。 */
function StatusRow({
  category,
  count,
  index,
  total,
  reorderDisabled,
  rowError,
  onMove,
  onDelete,
  onSave,
}: StatusRowProps) {
  const [draftName, setDraftName] = useState(category.name);
  const [draftColor, setDraftColor] = useState(category.color);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = draftName.trim() !== category.name || draftColor !== category.color;

  // 服务端数据回填后同步草稿（仅在用户未进行未保存编辑时）。
  useEffect(() => {
    if (!dirty) {
      setDraftName(category.name);
      setDraftColor(category.color);
    }
  }, [category.name, category.color, dirty]);

  async function handleSave() {
    const trimmed = draftName.trim();
    if (trimmed.length === 0) {
      setSaveError('名称不能为空');
      return;
    }
    const input: UpdateStatusInput = {};
    if (trimmed !== category.name) input.name = trimmed;
    if (draftColor !== category.color) input.color = draftColor;
    if (Object.keys(input).length === 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      await onSave(input);
      setDraftName(trimmed);
      setDraftColor(draftColor);
      setSaved(true);
    } catch (err) {
      setSaveError(errorMessage(err, '保存失败，请稍后重试'));
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraftName(category.name);
    setDraftColor(category.color);
    setSaveError(null);
    setSaved(false);
  }

  const textColor = readableTextColor(category.color);
  const error = rowError ?? saveError;

  return (
    <li className="status-row">
      <span
        className="status-swatch"
        style={{ backgroundColor: category.color, color: textColor }}
        title={category.name}
      >
        {category.name}
      </span>
      <input
        className="status-name-input"
        value={draftName}
        aria-label={`重命名 ${index + 1}`}
        onChange={(e) => {
          setDraftName(e.target.value);
          setSaveError(null);
          setSaved(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void handleSave();
          } else if (e.key === 'Escape') {
            handleCancel();
          }
        }}
      />
      <input
        className="status-color-input"
        type="color"
        value={draftColor}
        aria-label={`颜色 ${index + 1}`}
        onChange={(e) => {
          setDraftColor(e.target.value);
          setSaveError(null);
          setSaved(false);
        }}
      />
      <span className="status-count">{count} 个任务</span>
      <span className="status-order">
        <span className="status-order-num">{category.order}</span>
        <button
          type="button"
          className="status-move-btn"
          onClick={() => onMove(-1)}
          disabled={reorderDisabled || index === 0}
          aria-label={`上移 ${index + 1}`}
        >
          ↑
        </button>
        <button
          type="button"
          className="status-move-btn"
          onClick={() => onMove(1)}
          disabled={reorderDisabled || index === total - 1}
          aria-label={`下移 ${index + 1}`}
        >
          ↓
        </button>
      </span>
      <span className="status-actions">
        {dirty && (
          <>
            <button
              type="button"
              className="status-save-btn"
              onClick={() => void handleSave()}
              disabled={saving || draftName.trim().length === 0}
            >
              保存
            </button>
            <button
              type="button"
              className="status-cancel-btn"
              onClick={handleCancel}
              disabled={saving}
            >
              取消
            </button>
          </>
        )}
        {saved && !dirty && <span className="status-saved">已保存</span>}
        <button
          type="button"
          className="status-delete-btn"
          onClick={onDelete}
          aria-label={`删除 ${index + 1}`}
        >
          删除
        </button>
      </span>
      {error && (
        <span className="status-row-error" role="alert">
          {error}
        </span>
      )}
    </li>
  );
}

/** 状态分类管理页（/statuses）：表头列表 + 显式保存 + 原子调序 + 行内 409 提示。 */
export function StatusManagerPage() {
  const statusesQuery = useStatuses();
  const tasksQuery = useTasks();
  const createStatus = useCreateStatus();
  const updateStatus = useUpdateStatus();
  const deleteStatus = useDeleteStatus();

  const [name, setName] = useState('');
  const [color, setColor] = useState('#1976d2');
  const [error, setError] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const statuses = useMemo(
    () => [...(statusesQuery.data ?? [])].sort((a, b) => a.order - b.order),
    [statusesQuery.data],
  );

  const taskCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasksQuery.data ?? []) {
      counts.set(task.statusId, (counts.get(task.statusId) ?? 0) + 1);
    }
    return counts;
  }, [tasksQuery.data]);

  function setRowError(id: string, message: string | null) {
    setRowErrors((prev) => {
      const next = { ...prev };
      if (message === null) delete next[id];
      else next[id] = message;
      return next;
    });
  }

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    createStatus.mutate(
      { name: trimmed, color },
      {
        onSuccess: () => setName(''),
        onError: (err) => setError(errorMessage(err, '新增失败，请稍后重试')),
      },
    );
  }

  /**
   * 原子调序：点击 ↑/↓ 后按新顺序一次性 PATCH 所有 order 发生变化的分类。
   * 写入策略：按新顺序从首到尾依次 PATCH（`buildReorderPlan` 的产出顺序即新下标升序），
   * 后端对 order 无唯一约束，中间过程可能出现短暂重复 order 但不影响最终结果；
   * 进行中禁用全部 ↑/↓，失败则行内提示 + 重新拉取回到服务端真实状态。
   */
  async function handleMove(category: StatusCategory, offset: 1 | -1) {
    if (reordering) return;
    const index = statuses.findIndex((c) => c.id === category.id);
    if (index === -1) return;
    const next = moveItem(statuses, index, offset);
    if (next === statuses) return;
    const plan = buildReorderPlan(statuses, next);
    if (plan.length === 0) return;

    setReordering(true);
    setRowError(category.id, null);
    try {
      for (const item of plan) {
        await updateStatus.mutateAsync({ id: item.id, input: { order: item.order } });
      }
    } catch (err) {
      setRowError(category.id, errorMessage(err, '调序失败，请稍后重试'));
      await statusesQuery.refetch();
    } finally {
      setReordering(false);
    }
  }

  function handleDelete(category: StatusCategory) {
    setRowError(category.id, null);
    deleteStatus.mutate(category.id, {
      onError: (err) => setRowError(category.id, errorMessage(err, '删除失败，请稍后重试')),
      onSuccess: () => setRowError(category.id, null),
    });
  }

  function handleSave(category: StatusCategory, input: UpdateStatusInput) {
    return updateStatus.mutateAsync({ id: category.id, input });
  }

  return (
    <section className="status-manager">
      <h1>状态分类管理</h1>

      <form className="status-create" onSubmit={handleCreate} noValidate>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="新分类名称"
          aria-label="分类名称"
        />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          aria-label="分类颜色"
        />
        <button type="submit" disabled={name.trim().length === 0}>
          新增
        </button>
      </form>

      {error && (
        <p className="status-error" role="alert">
          {error}
        </p>
      )}

      <div className="status-table">
        <div className="status-table-header">
          <span>分类</span>
          <span>名称</span>
          <span>颜色</span>
          <span>任务数</span>
          <span>顺序</span>
          <span>操作</span>
        </div>
        <ul className="status-table-body">
          {statuses.map((category, index) => (
            <StatusRow
              key={category.id}
              category={category}
              count={taskCounts.get(category.id) ?? 0}
              index={index}
              total={statuses.length}
              reorderDisabled={reordering}
              rowError={rowErrors[category.id] ?? null}
              onMove={(offset) => void handleMove(category, offset)}
              onDelete={() => handleDelete(category)}
              onSave={(input) => handleSave(category, input)}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}