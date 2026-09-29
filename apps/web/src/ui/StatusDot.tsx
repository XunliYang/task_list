import type { CSSProperties } from 'react';
import './StatusDot.css';

export type StatusDotStatus = 'pending' | 'in_progress' | 'done';

export interface StatusDotProps {
  /** 状态分类色（消费方从 status.category.color 注入） */
  color: string;
  /** 无障碍标签（如状态分类名） */
  label: string;
  /** 可选状态语义：in_progress 显示脉冲 */
  status?: StatusDotStatus;
}

/** 状态点：圆点 + 可选脉冲，配合 title 提供文字通道（不只靠颜色）。 */
export function StatusDot({ color, label, status = 'pending' }: StatusDotProps) {
  const style = { '--dot-color': color } as CSSProperties;
  return (
    <span
      className={`ui-dot ui-dot--${status}`}
      style={style}
      role="img"
      aria-label={label}
      title={label}
      data-status={status}
    />
  );
}
