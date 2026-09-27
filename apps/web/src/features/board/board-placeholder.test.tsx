import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BoardPage } from './BoardPage';

describe('BoardPage 占位页', () => {
  it('渲染看板占位页不报错', () => {
    render(<BoardPage />);
    expect(screen.getByRole('heading', { name: '看板' })).toBeInTheDocument();
  });
});
