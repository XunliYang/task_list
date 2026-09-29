import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './SuccessMorphButton.css';

export interface SuccessMorphButtonProps {
  /** 点击后执行；resolve = 成功，throw/reject = 失败 */
  onAction: () => Promise<void> | void;
  /** idle 文案 */
  children: ReactNode;
  /** 默认「处理中…」 */
  pendingLabel?: string;
  /** 默认「已完成」 */
  successLabel?: string;
  /** 默认「失败，重试」 */
  errorLabel?: string;
  /** 默认 2000，到时回到 idle */
  successDurationMs?: number;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  type?: 'button' | 'submit';
}

type MorphState = 'idle' | 'pending' | 'success' | 'error';

/**
 * 成功形变按钮 —— 全站唯一的「点击 → 成功形变」实现。
 *
 * 状态机 idle → pending → (success → 自动回 idle) | (error → 停留，再点重试)。
 * 只用于一次性提交动作，不得用于导航/筛选/视图切换。
 */
export function SuccessMorphButton({
  onAction,
  children,
  pendingLabel = '处理中…',
  successLabel = '已完成',
  errorLabel = '失败，重试',
  successDurationMs = 2000,
  variant = 'primary',
  disabled = false,
  type = 'button',
}: SuccessMorphButtonProps) {
  const [state, setState] = useState<MorphState>('idle');
  const mountedRef = useRef(true);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  async function handleClick() {
    if (state === 'pending') return; // pending 期间禁用重复点击
    setState('pending');
    try {
      await onAction();
      setState('success');
      resetTimerRef.current = window.setTimeout(() => {
        if (mountedRef.current) setState('idle');
      }, successDurationMs);
    } catch {
      setState('error');
    }
  }

  const busy = state === 'pending';
  const label =
    state === 'pending'
      ? pendingLabel
      : state === 'success'
        ? successLabel
        : state === 'error'
          ? errorLabel
          : children;

  return (
    <button
      type={type}
      className={`ui-morph ui-morph--${variant} ui-morph--${state}`}
      onClick={() => void handleClick()}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      aria-live="polite"
      data-state={state}
    >
      <span className="ui-morph-label">{label}</span>
    </button>
  );
}
