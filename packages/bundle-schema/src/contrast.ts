/** Minimum contrast for text on a theme color, per WCAG 2.x AA and design.md §6.1. */
export const MIN_TEXT_CONTRAST = 4.5;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** WCAG 2.x relative luminance of a #rrggbb color, in [0, 1]. */
export function relativeLuminance(hex: string): number {
  if (!HEX_COLOR.test(hex)) throw new Error(`not a #rrggbb color: ${hex}`);
  const channel = (offset: number): number => {
    const v = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio between two colors, from 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la >= lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}
