export function getPickResult(game: any, guess: any, customRules?: { exact: number | null, diff: number | null, winner: number | null }) {
  if (!game || !guess || game.home_score === null || game.away_score === null) {
    return { points: 0, isProjected: false, colorClass: 'bg-transparent', textClass: 'text-gray-500' };
  }

  // Se não passar regras customizadas (Global), assume a regra Oficial (7/5/3)
  const rules = customRules || { exact: 7, diff: 5, winner: 3 };

  const isLive = game.status === 'in_progress';
  const realDiff = game.home_score - game.away_score;
  const predDiff = guess.home_guess - guess.away_guess;
  const realWinner = realDiff > 0 ? 'home' : realDiff < 0 ? 'away' : 'tie';
  const predWinner = predDiff > 0 ? 'home' : predDiff < 0 ? 'away' : 'tie';

  const isExact = game.home_score === guess.home_guess && game.away_score === guess.away_guess;
  const isDiff = realWinner === predWinner && realDiff === predDiff && realWinner !== 'tie';
  const isWinner = realWinner === predWinner && realWinner !== 'tie';

  let points = 0;

  // Efeito Cascata Inteligente
  if (isExact && rules.exact !== null && rules.exact !== undefined) {
    points = rules.exact;
  } else if (isDiff && rules.diff !== null && rules.diff !== undefined) {
    points = rules.diff;
  } else if (isWinner && rules.winner !== null && rules.winner !== undefined) {
    points = rules.winner;
  }

  let colorClass = '';
  let textClass = '';

  if (points === 0) {
    // Errado (Vermelho) - Bordas fortalecidas para não sumirem
    colorClass = isLive ? 'bg-red-500/5 border border-red-500/30' : 'bg-[#1A0505] border-2 border-red-500/40 shadow-[inset_0_0_15px_rgba(239,68,68,0.1)]';
    textClass = 'text-red-500';
  } else {
    // Pegamos todas as pontuações válidas da liga e ordenamos da maior pra menor
    const availablePoints = [rules.exact, rules.diff, rules.winner]
      .filter((v): v is number => v !== null && v !== undefined)
      .sort((a, b) => b - a);
    
    const uniquePoints = Array.from(new Set(availablePoints)); // Remove duplicatas
    const rank = uniquePoints.indexOf(points); // 0 = Maior, 1 = Segunda maior, 2 = Terceira maior

    if (rank === 0) {
      // Maior Pontuação (Verde)
      colorClass = isLive ? 'bg-green-500/10 border border-green-500/30' : 'bg-[#0A1A0F] border-2 border-green-500/40 shadow-[inset_0_0_20px_rgba(34,197,94,0.1)]';
      textClass = 'text-green-400';
    } else if (rank === 1) {
      // Segunda Maior (Azul)
      colorClass = isLive ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-[#0A1220] border-2 border-blue-500/40 shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]';
      textClass = 'text-blue-400';
    } else {
      // Terceira Maior (Âmbar)
      colorClass = isLive ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-[#1A1205] border-2 border-amber-500/40 shadow-[inset_0_0_20px_rgba(245,158,11,0.1)]';
      textClass = 'text-amber-400';
    }
  }

  return { points, isProjected: isLive, colorClass, textClass };
}