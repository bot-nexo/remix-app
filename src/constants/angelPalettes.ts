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
    name: 'Beige Lino',
    primary: '#CBB295',
    secondary: '#8E6C4C',
    blush: '#F8F3ED',
    gold: '#DFCBB5',
    ink: '#2B231B',
  },
  {
    name: 'Duna Trigo',
    primary: '#B7895A',
    secondary: '#774F2A',
    blush: '#F4ECE2',
    gold: '#D9B382',
    ink: '#221A13',
  },
  {
    name: 'Mocca Arena',
    primary: '#96724E',
    secondary: '#573B23',
    blush: '#ECE2D8',
    gold: '#C4A27B',
    ink: '#1A120C',
  },
];

export const DEFAULT_ANGEL_PALETTE = ANGEL_PALETTES[0];
export const ANGEL_PALETTE_STORAGE_KEY = 'angel-nails-selected-palette';

export function findAngelPalette(primary?: string | null, secondary?: string | null): AngelPalette {
  if (!primary) return DEFAULT_ANGEL_PALETTE;

  const normalizedPrimary = primary.toUpperCase();
  const normalizedSecondary = secondary?.toUpperCase();

  const exactMatch = ANGEL_PALETTES.find((palette) =>
    palette.primary.toUpperCase() === normalizedPrimary &&
    (!normalizedSecondary || palette.secondary.toUpperCase() === normalizedSecondary)
  );
  if (exactMatch) return exactMatch;

  const primaryMatch = ANGEL_PALETTES.find((palette) =>
    palette.primary.toUpperCase() === normalizedPrimary
  );
  if (primaryMatch) return primaryMatch;

  return {
    name: 'Personalizada',
    primary: primary,
    secondary: secondary || '#8D6343',
    blush: '#F7EFE7',
    gold: '#DFB15B',
    ink: '#2A1E17',
  };
}

