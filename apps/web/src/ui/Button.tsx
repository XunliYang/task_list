import type { ButtonHTMLAttributes } from 'react';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 视觉变体；默认 secondary（中性，适合筛选/视图切换等非一次性动作） */
  variant?: ButtonVariant;
}

/**
 * 通用按钮：用于导航、筛选、视图切换等「非一次性提交」类控件。
 * 一次性提交动作（保存/新建/推进/转任务/导入/删除确认）请改用 SuccessMorphButton。
 */
export function Button({ variant = 'secondary', type = 'button', className, ...rest }: ButtonProps) {
  const cls = ['ui-button', `ui-button--${variant}`];
  if (className) cls.push(className);
  return <button type={type} className={cls.join(' ')} {...rest} />;
}
