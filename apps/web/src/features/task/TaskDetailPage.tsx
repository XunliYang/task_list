import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStatuses } from '../../api/statuses';
import { useDeleteTask, useTask, useTaskProgress } from '../../api/tasks';
import { ProgressComposer } from './ProgressComposer';
import { ProgressTimeline } from './ProgressTimeline';
import { StageEditorDialog } from './StageEditorDialog';
import { StageFlowPanel } from './StageFlowPanel';
import { TaskEditDialog } from './TaskEditDialog';
import { formatDateTime } from './task-utils';
import './task.css';

/** 任务详情页（/tasks/:id）：详情 + 编辑 + 阶段流转 + 进展记录。 */
export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const taskQuery = useTask(id);
  const progressQuery = useTaskProgress(id);
  const statusesQuery = useStatuses();
  const deleteTask = useDeleteTask(id ?? '');

  const [editOpen, setEditOpen] = useState(false);
  const [stagesOpen, setStagesOpen] = useState(false);

  if (taskQuery.isLoading) {
    return <p>加载中…</p>;
  }

  if (taskQuery.isError || !taskQuery.data) {
    return (
      <div className="not-found" role="alert">
        <h1>任务不存在</h1>
        <p>该任务可能已被删除，或链接有误。</p>
        <Link to="/board">返回看板</Link>
      </div>
    );
  }

  const task = taskQuery.data;
  const status = statusesQuery.data?.find((s) => s.id === task.statusId);

  function handleDelete() {
    if (!window.confirm('确定删除该任务？此操作不可撤销。')) return;
    deleteTask.mutate(undefined, { onSuccess: () => navigate('/board') });
  }

  return (
    <article className="task-detail">
      <header className="task-detail-header">
        <h1>{task.title}</h1>
        <div className="actions">
          <button type="button" onClick={() => setEditOpen(true)}>
            编辑
          </button>
          <button type="button" className="danger" onClick={handleDelete}>
            删除
          </button>
        </div>
      </header>

      <dl className="task-meta">
        <dt>公司</dt>
        <dd>{task.company ?? '—'}</dd>
        <dt>状态分类</dt>
        <dd>
          {status ? (
            <span
              className="status-pill"
              style={{ backgroundColor: status.color, color: '#ffffff' }}
            >
              {status.name}
            </span>
          ) : (
            '—'
          )}
        </dd>
        <dt>标签</dt>
        <dd>{task.tags.length > 0 ? task.tags.join('、') : '—'}</dd>
        <dt>创建时间</dt>
        <dd>{formatDateTime(task.createdAt)}</dd>
        <dt>更新时间</dt>
        <dd>{formatDateTime(task.updatedAt)}</dd>
        <dt>备注</dt>
        <dd>{task.notes || '—'}</dd>
      </dl>

      <section className="task-section">
        <h2>阶段流转</h2>
        <StageFlowPanel task={task} />
        <button type="button" onClick={() => setStagesOpen(true)}>
          编辑阶段与截止时间
        </button>
      </section>

      <section className="task-section">
        <h2>新增进展</h2>
        <ProgressComposer task={task} />
      </section>

      <section className="task-section">
        <h2>进展时间线</h2>
        <ProgressTimeline entries={progressQuery.data ?? []} stages={task.stages} />
      </section>

      <StageEditorDialog task={task} open={stagesOpen} onClose={() => setStagesOpen(false)} />
      <TaskEditDialog task={task} open={editOpen} onClose={() => setEditOpen(false)} />
    </article>
  );
}