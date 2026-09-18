export type BirthdayPickerProps = {
  // Local date the user picked, or null until they pick one.
  value: Date | null;
  onChange: (date: Date | null) => void;
  // Where the picker opens; not a selection.
  initialDate: Date;
  minimumDate: Date;
  maximumDate: Date;
};

// Pickers return local-time dates; the API wants the calendar day as
// YYYY-MM-DD, so format from local components (not toISOString, which is UTC
// and can shift the day).
export function toIsoDate(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Device language/region formatting, e.g. "June 1, 1995" or "1 June 1995".
export function formatBirthday(date: Date): string {
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function yearsAgo(years: number, from = new Date()): Date {
  return new Date(from.getFullYear() - years, from.getMonth(), from.getDate());
}
