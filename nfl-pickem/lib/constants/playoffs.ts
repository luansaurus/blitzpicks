export const PLAYOFF_ORDER = ['WC', 'DR', 'CC', 'SB'];

export const PLAYOFF_NAMES: Record<string, string> = {
  'WC': 'Wild Card',
  'DR': 'Divisional Round',
  'CC': 'Conference Championship',
  'SB': 'Super Bowl'
};

export const PLAYOFF_WEEKS_ALL = ['WC', 'DR', 'CC', 'SB', 'AFCC', 'NFCC'];

export function isPlayoffWeek(week: string | number | null | undefined): boolean {
  if (!week) return false;
  return PLAYOFF_WEEKS_ALL.includes(String(week).toUpperCase());
}