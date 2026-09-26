/**
 * Replaces every `{key}` placeholder in a message template with its value.
 * Keys absent from `values` are left as-is so a missing value is visible
 * rather than silently blank.
 */
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    key in values ? String(values[key]) : placeholder,
  );
}
