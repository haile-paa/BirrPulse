export const colors = {
  primary: '#3A8D87',
  primaryDark: '#2B7A74',
  primaryDeep: '#1E5E59',
  primarySoft: '#E7F3F1',
  primaryTint: '#CFE7E3',
  bg: '#F5F8F7',
  card: '#FFFFFF',
  text: '#16302D',
  muted: '#8A9895',
  line: '#E4ECEA',
  income: '#2E9E6B',
  expense: '#EF5B5B',
  warn: '#F2A33A',
  white: '#FFFFFF',
};

export const radius = { sm: 10, md: 16, lg: 24, xl: 32, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const shadow = {
  card: {
    shadowColor: '#0E3B37',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  soft: {
    shadowColor: '#0E3B37',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
} as const;

export const font = {
  regular: { fontWeight: '400' as const },
  medium: { fontWeight: '500' as const },
  semibold: { fontWeight: '600' as const },
  bold: { fontWeight: '700' as const },
};
