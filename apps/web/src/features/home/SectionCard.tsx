import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface SectionCardProps {
  /** 卡片标题。 */
  title: string;
  /** 主数值 / 主内容（大号展示，可空）。 */
  value?: ReactNode;
  /** 可选跳转链接：有值时整卡渲染为可点击的 Link。 */
  to?: string;
  /** 强调样式（用于「新建任务」CTA）。 */
  accent?: boolean;
  /** 可选正文 / 脚注。 */
  children?: ReactNode;
}

/** 概览卡片外壳：标题 + 数值 + 可选链接。 */
export function SectionCard({ title, value, to, accent, children }: SectionCardProps) {
  const classes = [
    'section-card',
    to ? 'section-card--link' : '',
    accent ? 'section-card--accent' : '',
    value !== undefined ? 'section-card--metric' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const body = (
    <>
      <h3 className="section-card__title">{title}</h3>
      {value !== undefined ? <div className="section-card__value">{value}</div> : null}
      {children !== undefined ? <div className="section-card__body">{children}</div> : null}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes}>
        {body}
      </Link>
    );
  }

  return <article className={classes}>{body}</article>;
}
