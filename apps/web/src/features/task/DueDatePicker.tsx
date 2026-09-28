export interface DueDatePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  'aria-label'?: string;
}

/** 原生 date 输入的轻量封装，支持清除（不引 UI 库）。 */
export function DueDatePicker({ value, onChange, 'aria-label': ariaLabel }: DueDatePickerProps) {
  return (
    <span className="due-date-picker">
      <input
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
        aria-label={ariaLabel}
      />
      {value !== null && (
        <button type="button" onClick={() => onChange(null)} aria-label="清除截止时间">
          ✕
        </button>
      )}
    </span>
  );
}