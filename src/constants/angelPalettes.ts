export type AngelPalette = {
  name: string;
  primary: string;
  secondary: string;
  blush: string;
  gold: string;
  ink: string;
};

export const ANGEL_PALETTES: AngelPalette[] = [
  {
    name: 'Blush Angel',
    primary: '#C96F8D',
    secondary: '#7B3F54',
    blush: '#F1C2D2',
    gold: '#E7BB8D',
    ink: '#26121D',
  },
  {
    name: 'Rose Champagne',
    primary: '#D99A9A',
    secondary: '#8C5967',
    blush: '#F2D1D1',
    gold: '#D9B27F',
    ink: '#2B1B20',
  },
  {
    name: 'Nude Couture',
    primary: '#B98778',
    secondary: '#5F3E46',
    blush: '#E8C9BE',
    gold: '#D5A86F',
    ink: '#24191A',
  },
];

export const DEFAULT_ANGEL_PALETTE = ANGEL_PALETTES[0];
export const ANGEL_PALETTE_STORAGE_KEY = 'angel-nails-selected-palette';

export function findAngelPalette(primary?: string | null, secondary?: string | null) {
  const normalizedPrimary = primary?.toUpperCase();
  const normalizedSecondary = secondary?.toUpperCase();
  return ANGEL_PALETTES.find((palette) =>
    palette.primary === normalizedPrimary && palette.secondary === normalizedSecondary,
  ) || DEFAULT_ANGEL_PALETTE;
}
