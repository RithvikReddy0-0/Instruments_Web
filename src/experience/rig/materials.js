/**
 * Shared palette + material helpers for the experience layer.
 *
 * Colors mirror the OPUS "Midnight Workstation" design tokens (black + brass +
 * one cool accent) so the 3D intro feels continuous with the application it
 * hands off to. Kept as numeric literals because Three.js needs numbers, not
 * CSS custom properties.
 */
export const PALETTE = {
  bg: 0x0b0b0d,
  brass: 0xc8a24b,
  brass2: 0xe2b567,
  ink: 0xf3efe6,
  cyan: 0x4fb8ff,
  rec: 0xff5247,
  mint: 0x5fe6b8
};
