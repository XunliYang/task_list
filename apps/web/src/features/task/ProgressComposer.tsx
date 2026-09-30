import { useState } from 'react';
import type { Task } from '@task-list/shared';
import { useAddProgress } from '../../api/tasks';
import { SuccessMorphButton } from '../../ui';

export interface ProgressComposerProps {
  task: Task;
}

/** 新增当前进展：文本域 + 可选绑定当前阶段（默认勾选）。 */
export function ProgressComposer({ task }: ProgressComposerProps) {
  const addProgress = useAddProgress(task.id);
  const [summary, setSummary] = useState('');
  const [bindStage, setBindStage] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const trimmed = summary.trim();
  const canSubmit = trimmed.length > 0 && !addProgress.isPending;

  // 返回真实请求 Promise：失败 rethrow 让 SuccessMorphButton 进入 error 态并保留行内提示。
  async function submitProgress(): Promise<void> {
    if (!canSubmit) return;
    const stageId = bindStage ? task.currentStageId : null;
    setError(null);
    try {
      await addProgress.mutateAsync({ summary: trimmed, stageId });
      setSummary('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '记录进展失败，请稍后重试');
      throw err;
    }
  }

  return (
    <form className="progress-composer" noValidate onSubmit={(e) => e.preventDefault()}>
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
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <SuccessMorphButton
        variant="primary"
        successLabel="已记录"
        onAction={submitProgress}
        disabled={!canSubmit}
      >
        记录进展
      </SuccessMorphButton>
    </form>
  );
}