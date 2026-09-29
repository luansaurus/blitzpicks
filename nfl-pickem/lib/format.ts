export function calculatePct(wins: number, losses: number, ties: number): number {
  const totalGames = wins + losses + ties;
  return totalGames === 0 ? 0 : (wins + (ties * 0.5)) / totalGames;
}

export function formatRecord(wins: number, losses: number, ties: number): string {
  return `${wins}-${losses}${ties > 0 ? `-${ties}` : ''}`;
}