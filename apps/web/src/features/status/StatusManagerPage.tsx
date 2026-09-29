import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent, FormEvent, MouseEvent as ReactMouseEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { StatusCategory, UpdateStatusInput } from '@task-list/shared';
import { ApiError } from '../../api/client';
import { statusKeys } from '../../api/query-keys';
import {
  useCreateStatus,
  useDeleteStatus,
  useStatuses,
  useUpdateStatus,
} from '../../api/statuses';
import { useTasks } from '../../api/tasks';
import { readableTextColor } from '../task/task-utils';
import { buildReorderPlan, moveItem, moveItemTo, STATUS_DRAG_TYPE } from './status-order';
import './status.css';

/** 统一从后端错误中取可读 message，非 ApiError 时退回兜底文案。 */
function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.message) return err.message;
  return fallback;
}

/** 是否为内部状态行拖拽（而非外部文件/文本拖入）。 */
function hasStatusDrag(e: DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes(STATUS_DRAG_TYPE);
}

/** 从 dataTransfer 中取被拖拽的分类 id（私有 MIME 优先，text/plain 兜底）。 */
function readStatusDragId(e: DragEvent): string | null {
  return (
    e.dataTransfer.getData(STATUS_DRAG_TYPE) || e.dataTransfer.getData('text/plain') || null
  );
}

/**
 * 依据光标在目标行内的纵向位置决定插入槽位：上半段 = 插到本行之前，下半段 = 插到本行之后。
 * 由此天然覆盖边界：首行上半段 → 置顶，末行下半段 → 置底。
 */
function insertSlotFor(e: DragEvent, rowIndex: number): number {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const after = e.clientY > rect.top + rect.height / 2;
  return after ? rowIndex + 1 : rowIndex;
}

interface StatusRowProps {
  category: StatusCategory;
  count: number;
  index: number;
  total: number;
  /** 任一调序请求进行中时禁用整表 ↑/↓ 与拖拽，防连点产生交错请求。 */
  reorderDisabled: boolean;
  /** 父级写入的行内错误（删除 409 / 调序失败）。 */
  rowError: string | null;
  /** 该行是否为当前拖拽源。 */
  isDragging: boolean;
  /** 该行是否为当前悬停的拖放目标。 */
  isDropTarget: boolean;
  onMove: (offset: 1 | -1) => void;
  onDelete: () => void;
  /** 显式保存：返回 Promise 供行内 await，成功给轻提示、失败展示后端 message。 */
  onSave: (input: UpdateStatusInput) => Promise<unknown>;
  onRowDragStart: (id: string) => void;
  onRowDragEnd: () => void;
  onRowDragEnter: (id: string) => void;
  onRowDragLeave: (id: string) => void;
  onRowDrop: (id: string, e: DragEvent<HTMLLIElement>) => void;
}

/** 单行状态分类：改名/改色走显式保存（Enter 提交、Esc 取消），保存/取消按需出现。 */
function StatusRow({
  category,
  count,
  index,
  total,
  reorderDisabled,
  rowError,
  isDragging,
  isDropTarget,
  onMove,
  onDelete,
  onSave,
  onRowDragStart,
  onRowDragEnd,
  onRowDragEnter,
  onRowDragLeave,
  onRowDrop,
}: StatusRowProps) {
  const [draftName, setDraftName] = useState(category.name);
  const [draftColor, setDraftColor] = useState(category.color);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // 拖放目标高亮靠 dragenter/dragleave 深度计数，避免在子元素间移动时闪烁。
  const dragDepthRef = useRef(0);
  // 拖拽结束后抑制紧随的一次 click，避免误触发保存/删除等按钮。
  const suppressClickRef = useRef(false);

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

  function handleDragStart(e: DragEvent<HTMLLIElement>) {
    e.dataTransfer.setData('text/plain', category.id);
    e.dataTransfer.setData(STATUS_DRAG_TYPE, category.id);
    e.dataTransfer.effectAllowed = 'move';
    onRowDragStart(category.id);
  }

  function handleDragEnd() {
    dragDepthRef.current = 0;
    onRowDragEnd();
    // 拖拽结束后浏览器/测试可能补发一次 click，抑制它避免误触发按钮。
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  function handleDragEnter(e: DragEvent<HTMLLIElement>) {
    if (!hasStatusDrag(e)) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    onRowDragEnter(category.id);
  }

  function handleDragOver(e: DragEvent<HTMLLIElement>) {
    if (!hasStatusDrag(e)) return;
    // preventDefault 是「允许 drop」的前提。
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDragLeave(e: DragEvent<HTMLLIElement>) {
    if (!hasStatusDrag(e)) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) onRowDragLeave(category.id);
  }

  function handleDrop(e: DragEvent<HTMLLIElement>) {
    if (!hasStatusDrag(e)) return;
    e.preventDefault();
    // 阻止冒泡，避免触发列表容器的 drop 处理。
    e.stopPropagation();
    dragDepthRef.current = 0;
    onRowDrop(category.id, e);
  }

  function handleClickCapture(e: ReactMouseEvent<HTMLLIElement>) {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
    }
  }

  const textColor = readableTextColor(category.color);
  const error = rowError ?? saveError;

  const rowClass = ['status-row'];
  if (isDragging) rowClass.push('is-dragging');
  if (isDropTarget) rowClass.push('is-drop-target');

  return (
    <li
      className={rowClass.join(' ')}
      draggable={!reorderDisabled}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClickCapture={handleClickCapture}
      data-testid="status-row"
      data-status-id={category.id}
      data-dragging={isDragging || undefined}
      data-drop-target={isDropTarget || undefined}
    >
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

/** 状态分类管理页（/statuses）：表头列表 + 显式保存 + 原子调序（↑/↓ 与拖拽）+ 行内 409 提示。 */
export function StatusManagerPage() {
  const queryClient = useQueryClient();
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

  // 拖拽交互状态：源行、悬停的目标行、列表容器空白区（置底）与 aria-live 播报文本。
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropToEnd, setDropToEnd] = useState(false);
  const [liveMessage, setLiveMessage] = useState('');
  const containerDepthRef = useRef(0);

  const statuses = useMemo(
    () => [...(statusesQuery.data ?? [])].sort((a, b) => a.order - b.order),
    [statusesQuery.data],
  );

  const statusById = useMemo(() => {
    const map = new Map<string, StatusCategory>();
    for (const s of statuses) map.set(s.id, s);
    return map;
  }, [statuses]);

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
   * 原子调序：拿到新顺序后，乐观刷新列表缓存，再按新顺序从首到尾依次 PATCH
   * 所有 order 发生变化的分类（`buildReorderPlan` 的产出顺序即新下标升序）。
   * 后端对 order 无唯一约束，中间过程可能出现短暂重复 order 但不影响最终结果；
   * 进行中禁用全部 ↑/↓ 与拖拽，失败则回滚缓存 + 行内提示 + 重新拉取回到服务端真实状态。
   */
  async function performReorder(next: StatusCategory[], errorId: string) {
    const plan = buildReorderPlan(statuses, next);
    if (plan.length === 0) return;
    // 乐观更新：order 归一化为新下标，保证「按 order 排序」渲染的列表立即反映新顺序。
    const normalized = next.map((item, index) => ({ ...item, order: index }));
    const previous = statuses;

    queryClient.setQueryData(statusKeys.lists(), normalized);
    setReordering(true);
    setRowError(errorId, null);
    try {
      for (const item of plan) {
        await updateStatus.mutateAsync({ id: item.id, input: { order: item.order } });
      }
    } catch (err) {
      queryClient.setQueryData(statusKeys.lists(), previous);
      setRowError(errorId, errorMessage(err, '调序失败，请稍后重试'));
      await statusesQuery.refetch();
    } finally {
      setReordering(false);
    }
  }

  async function handleMove(category: StatusCategory, offset: 1 | -1) {
    if (reordering) return;
    const index = statuses.findIndex((c) => c.id === category.id);
    if (index === -1) return;
    const next = moveItem(statuses, index, offset);
    if (next === statuses) return;
    await performReorder(next, category.id);
  }

  function clearDragState() {
    setDragSourceId(null);
    setDropTargetId(null);
    setDropToEnd(false);
    setLiveMessage('');
    containerDepthRef.current = 0;
  }

  function handleRowDragStart(id: string) {
    if (reordering) return;
    setDragSourceId(id);
    const source = statusById.get(id);
    if (source) setLiveMessage(`开始拖动「${source.name}」`);
  }

  function handleRowDragEnd() {
    clearDragState();
  }

  function handleRowDragEnter(id: string) {
    setDropTargetId(id);
    setDropToEnd(false);
    const source = statusById.get(dragSourceId ?? '');
    const target = statusById.get(id);
    if (source && target) {
      setLiveMessage(`将「${source.name}」移动到「${target.name}」位置`);
    }
  }

  function handleRowDragLeave(id: string) {
    setDropTargetId((prev) => (prev === id ? null : prev));
  }

  function handleRowDrop(targetId: string, e: DragEvent<HTMLLIElement>) {
    const draggedId = readStatusDragId(e);
    const fromIndex = statuses.findIndex((c) => c.id === draggedId);
    const toIndex = statuses.findIndex((c) => c.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const insertIndex = insertSlotFor(e, toIndex);
    const next = moveItemTo(statuses, fromIndex, insertIndex);
    if (next === statuses) {
      clearDragState();
      return;
    }
    clearDragState();
    void performReorder(next, draggedId ?? targetId);
  }

  function handleContainerDragEnter(e: DragEvent<HTMLUListElement>) {
    if (!hasStatusDrag(e)) return;
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    containerDepthRef.current += 1;
    setDropTargetId(null);
    setDropToEnd(true);
    const source = statusById.get(dragSourceId ?? '');
    if (source) setLiveMessage(`将「${source.name}」移动到最后`);
  }

  function handleContainerDragOver(e: DragEvent<HTMLUListElement>) {
    if (!hasStatusDrag(e)) return;
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleContainerDragLeave(e: DragEvent<HTMLUListElement>) {
    if (!hasStatusDrag(e)) return;
    if (e.target !== e.currentTarget) return;
    containerDepthRef.current = Math.max(0, containerDepthRef.current - 1);
    if (containerDepthRef.current === 0) setDropToEnd(false);
  }

  function handleContainerDrop(e: DragEvent<HTMLUListElement>) {
    if (!hasStatusDrag(e)) return;
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    const draggedId = readStatusDragId(e);
    if (!draggedId) return;
    const fromIndex = statuses.findIndex((c) => c.id === draggedId);
    if (fromIndex === -1) return;
    // 列表容器空白处：上半段 = 置顶，下半段（含末行之后）= 置底。
    const rect = e.currentTarget.getBoundingClientRect();
    const toIndex = e.clientY < rect.top + rect.height / 2 ? 0 : statuses.length;
    const next = moveItemTo(statuses, fromIndex, toIndex);
    clearDragState();
    if (next === statuses) return;
    void performReorder(next, draggedId);
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
        <ul
          className={dropToEnd ? 'status-table-body is-drop-to-end' : 'status-table-body'}
          data-testid="status-list"
          onDragEnter={handleContainerDragEnter}
          onDragOver={handleContainerDragOver}
          onDragLeave={handleContainerDragLeave}
          onDrop={handleContainerDrop}
        >
          {statuses.map((category, index) => (
            <StatusRow
              key={category.id}
              category={category}
              count={taskCounts.get(category.id) ?? 0}
              index={index}
              total={statuses.length}
              reorderDisabled={reordering}
              rowError={rowErrors[category.id] ?? null}
              isDragging={dragSourceId === category.id}
              isDropTarget={dropTargetId === category.id}
              onMove={(offset) => void handleMove(category, offset)}
              onDelete={() => handleDelete(category)}
              onSave={(input) => handleSave(category, input)}
              onRowDragStart={handleRowDragStart}
              onRowDragEnd={handleRowDragEnd}
              onRowDragEnter={handleRowDragEnter}
              onRowDragLeave={handleRowDragLeave}
              onRowDrop={handleRowDrop}
            />
          ))}
        </ul>
      </div>

      <span className="status-visually-hidden" role="status" aria-live="polite">
        {liveMessage}
      </span>
    </section>
  );
}