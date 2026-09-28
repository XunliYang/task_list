import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Task } from '@task-list/shared';
import { useAddProgress } from '../../api/tasks';

export interface ProgressComposerProps {
  task: Task;
}

/** 新增当前进展：文本域 + 可选绑定当前阶段（默认勾选）。 */
export function ProgressComposer({ task }: ProgressComposerProps) {
  const addProgress = useAddProgress(task.id);
  const [summary, setSummary] = useState('');
  const [bindStage, setBindStage] = useState(true);

  const trimmed = summary.trim();
  const canSubmit = trimmed.length > 0 && !addProgress.isPending;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const stageId = bindStage ? task.currentStageId : null;
    addProgress.mutate(
      { summary: trimmed, stageId },
      { onSuccess: () => setSummary('') },
    );
  }

  return (
    <form className="progress-composer" onSubmit={handleSubmit} noValidate>
      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="记录当前进展…"
        aria-label="进展内容"
        rows={3}
      />
      <label>
        <input
          type="checkbox"
          checked={bindStage}
          onChange={(e) => setBindStage(e.target.checked)}
        />
        绑定当前阶段
      </label>
      <button type="submit" disabled={!canSubmit}>
        记录进展
      </button>
    </form>
  );
}