import type { Theme } from './theme';

export function themeToCssVars(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(theme.color)) {
    if (Array.isArray(v)) vars[`--gradient-${k}`] = v.join(', ');
    else vars[`--color-${k}`] = v as string;
  }
  for (const [k, v] of Object.entries(theme.spacing)) vars[`--space-${k}`] = `${v}px`;
  for (const [k, v] of Object.entries(theme.radius)) vars[`--radius-${k}`] = `${v}px`;
  return vars;
}

export function cssVarBlock(theme: Theme): string {
  return Object.entries(themeToCssVars(theme)).map(([k, v]) => `${k}: ${v};`).join(' ');
}
