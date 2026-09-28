import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { StatusCategory } from '@task-list/shared';
import { ApiError } from '../../api/client';
import {
  useCreateStatus,
  useDeleteStatus,
  useStatuses,
  useUpdateStatus,
} from '../../api/statuses';
import { useTasks } from '../../api/tasks';
import { readableTextColor } from '../task/task-utils';
import './status.css';

/** 状态分类管理页（/statuses）：增删改 + 颜色 + 上下调序。 */
export function StatusManagerPage() {
  const statusesQuery = useStatuses();
  const tasksQuery = useTasks();
  const createStatus = useCreateStatus();
  const updateStatus = useUpdateStatus();
  const deleteStatus = useDeleteStatus();

  const [name, setName] = useState('');
  const [color, setColor] = useState('#1976d2');
  const [error, setError] = useState<string | null>(null);

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

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    createStatus.mutate({ name: trimmed, color }, { onSuccess: () => setName('') });
  }

  function handleRename(category: StatusCategory, next: string) {
    const trimmed = next.trim();
    if (trimmed.length === 0 || trimmed === category.name) return;
    updateStatus.mutate({ id: category.id, input: { name: trimmed } });
  }

  function handleColor(category: StatusCategory, next: string) {
    if (next === category.color) return;
    updateStatus.mutate({ id: category.id, input: { color: next } });
  }

  function handleDelete(category: StatusCategory) {
    setError(null);
    deleteStatus.mutate(category.id, {
      onError: (err) => {
        if (err instanceof ApiError && err.status === 409) {
          setError(err.message);
        } else {
          setError('删除失败，请稍后重试');
        }
      },
      onSuccess: () => setError(null),
    });
  }

  function move(category: StatusCategory, offset: -1 | 1) {
    const index = statuses.findIndex((c) => c.id === category.id);
    const target = statuses[index + offset];
    if (!target) return;
    updateStatus.mutate({ id: category.id, input: { order: target.order } });
    updateStatus.mutate({ id: target.id, input: { order: category.order } });
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

      <ul className="status-list">
        {statuses.map((category, index) => {
          const count = taskCounts.get(category.id) ?? 0;
          const textColor = readableTextColor(category.color);
          return (
            <li key={category.id}>
              <span
                className="status-swatch"
                style={{ backgroundColor: category.color, color: textColor }}
              >
                {category.name}
              </span>
              <input
                defaultValue={category.name}
                aria-label={`重命名 ${index + 1}`}
                onBlur={(e) => handleRename(category, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
              />
              <input
                type="color"
                value={category.color}
                aria-label={`颜色 ${index + 1}`}
                onChange={(e) => handleColor(category, e.target.value)}
              />
              <span className="status-count">{count} 个任务</span>
              <span className="status-order">顺序 {category.order}</span>
              <button
                type="button"
                onClick={() => move(category, -1)}
                disabled={index === 0}
                aria-label={`上移 ${index + 1}`}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(category, 1)}
                disabled={index === statuses.length - 1}
                aria-label={`下移 ${index + 1}`}
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => handleDelete(category)}
                aria-label={`删除 ${index + 1}`}
              >
                删除
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}