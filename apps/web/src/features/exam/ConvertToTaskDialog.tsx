import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ExamInfo, StatusCategory, Task } from '@task-list/shared';
import { useConvertExamToTask } from '../../api/exams';
import { useStatuses } from '../../api/statuses';
import { ApiError } from '../../api/client';

export interface ConvertToTaskDialogProps {
  exam: ExamInfo | null;
  open: boolean;
  onClose: () => void;
  onConverted: (task: Task) => void;
}

interface StageField {
  name: string;
  dueDate: string;
}

export function ConvertToTaskDialog({ exam, open, onClose, onConverted }: ConvertToTaskDialogProps) {
  const { data: statuses = [] } = useStatuses();
  const convertMutation = useConvertExamToTask(exam?.id ?? '');

  const [statusId, setStatusId] = useState('');
  const [stages, setStages] = useState<StageField[]>([{ name: '准备', dueDate: '' }]);
  const [error, setError] = useState('');
  const [convertedTask, setConvertedTask] = useState<Task | null>(null);

  useEffect(() => {
    if (open && exam) {
      setStatusId('');
      setStages([{ name: '准备', dueDate: '' }]);
      setError('');
      setConvertedTask(null);
    }
  }, [open, exam]);

  if (!open || !exam) {
    return null;
  }

  const defaultStatusId = statuses.length > 0 ? statuses[0].id : '';
  const effectiveStatusId = statusId || defaultStatusId;

  const updateStage = (index: number, patch: Partial<StageField>) =>
    setStages((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const addStage = () => setStages((prev) => [...prev, { name: '', dueDate: '' }]);
  const removeStage = (index: number) =>
    setStages((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    setError('');
    const stageInputs = stages
      .filter((stage) => stage.name.trim() !== '')
      .map((stage) => ({ name: stage.name.trim(), dueDate: stage.dueDate || null }));

    try {
      const res = await convertMutation.mutateAsync({
        statusId: effectiveStatusId || undefined,
        stages: stageInputs,
      });
      setConvertedTask(res.task);
      onConverted(res.task);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('该考试/面试信息已转为任务，请勿重复操作。');
      } else {
        setError(err instanceof Error ? err.message : '转任务失败');
      }
    }
  };

  if (convertedTask) {
    return (
      <div role="dialog" aria-modal="true" aria-label="转任务成功">
        <h2>已转为任务</h2>
        <p>新任务「{convertedTask.title}」已创建。</p>
        <Link to={`/tasks/${convertedTask.id}`}>查看任务</Link>{' '}
        <button type="button" onClick={onClose}>
          关闭
        </button>
      </div>
    );
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="转为任务">
      <h2>转为任务</h2>
      <p>标题：{exam.title}</p>
      <p>公司：{exam.company ?? '—'}</p>

      <p>
        <label>
          目标状态分类
          <select value={effectiveStatusId} onChange={(e) => setStatusId(e.target.value)}>
            {statuses.map((status: StatusCategory) => (
              <option key={status.id} value={status.id}>
                {status.name}
              </option>
            ))}
          </select>
        </label>
      </p>

      <div>
        <p>初始阶段</p>
        {stages.map((stage, index) => (
          <div key={index} style={{ marginBottom: 4 }}>
            <input
              aria-label={`阶段 ${index + 1} 名称`}
              placeholder="阶段名称"
              value={stage.name}
              onChange={(e) => updateStage(index, { name: e.target.value })}
            />{' '}
            <input
              aria-label={`阶段 ${index + 1} 截止时间`}
              type="date"
              value={stage.dueDate}
              onChange={(e) => updateStage(index, { dueDate: e.target.value })}
            />{' '}
            <button type="button" onClick={() => removeStage(index)}>
              删除
            </button>
          </div>
        ))}
        <button type="button" onClick={addStage}>
          添加阶段
        </button>
      </div>

      {error ? <p role="alert">{error}</p> : null}

      <div style={{ marginTop: 12 }}>
        <button type="button" onClick={handleSubmit} disabled={convertMutation.isPending}>
          {convertMutation.isPending ? '提交中…' : '确认转任务'}
        </button>{' '}
        <button type="button" onClick={onClose}>
          取消
        </button>
      </div>
    </div>
  );
}