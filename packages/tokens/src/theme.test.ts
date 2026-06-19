import { describe, it, expect } from 'vitest';
import { lightTheme, darkTheme, defaultTheme, createTheme, themeToCssVars } from './index';

describe('@car-rental/tokens', () => {
  it('light is the default and carries the Sunset Drive brand', () => {
    expect(defaultTheme).toBe(lightTheme);
    expect(lightTheme.color.primary).toBe('#F97316');
    expect(lightTheme.color.background).toBe('#FFF8F3');
    expect(darkTheme.color.background).toBe('#0B1220');
  });
  it('shares brand + status hues across schemes, flips only neutrals', () => {
    expect(darkTheme.color.primary).toBe(lightTheme.color.primary);
    expect(darkTheme.color.success).toBe(lightTheme.color.success);
    expect(darkTheme.color.text).not.toBe(lightTheme.color.text);
  });
  it('white-labels primary and derives gradient + glow', () => {
    const t = createTheme('light', { primary: '#2563EB', primaryDark: '#1D4ED8' });
    expect(t.color.primary).toBe('#2563EB');
    expect(t.color.gradientPrimary).toEqual(['#2563EB', '#1D4ED8']);
    expect(t.color.glow).toContain('37, 99, 235'); // primary @ 0.35 as rgba
  });
  it('static layout tokens are identical across schemes', () => {
    expect(lightTheme.spacing.md).toBe(16);
    expect(darkTheme.spacing.md).toBe(16);
    expect(lightTheme.radius.card).toBe(18);
  });
  it('emits CSS custom properties for the web', () => {
    const vars = themeToCssVars(lightTheme);
    expect(vars['--color-primary']).toBe('#F97316');
    expect(vars['--space-md']).toBe('16px');
    expect(vars['--radius-card']).toBe('18px');
  });
});
