import type { ReactNode } from 'react';
import './Badge.css';

export type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'error';

export interface BadgeProps {
  children: ReactNode;
  /** 语义变体；默认 neutral（标签 chip） */
  variant?: BadgeVariant;
}

/** 标签 chip（任务标签 / 语义标记），面值与文字值已按对比度配对。 */
export function Badge({ children, variant = 'neutral' }: BadgeProps) {
  return <span className={`ui-badge ui-badge--${variant}`}>{children}</span>;
}
