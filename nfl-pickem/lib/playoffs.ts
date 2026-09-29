import { ESPN_STANDINGS_URL } from '@/lib/config';

export async function getPlayoffSeeds(teams: any[], standings: any[]) {
  const seeds: { AFC: Record<number, any>; NFC: Record<number, any> } = {
    AFC: {}, NFC: {}
  };

  try {
    const res = await fetch(ESPN_STANDINGS_URL, { 
      next: { revalidate: 3600 } 
    });
    
    if (res.ok) {
      const espnData = await res.json();
      let espnTeamsFound = 0;

      const entries: any[] = [];
      const traverse = (node: any) => {
        if (node.standings && node.standings.entries) entries.push(...node.standings.entries);
        if (node.children) node.children.forEach(traverse);
      };
      traverse(espnData);

      entries.forEach(entry => {
        const espnAbbr = entry.team?.abbreviation;
        const seedStat = entry.stats?.find((s: any) => s.name === 'playoffSeed');
        const seedValue = seedStat ? parseInt(seedStat.value) : null;

        if (espnAbbr && seedValue && seedValue > 0 && seedValue <= 7) {
          const myTeam = teams.find(t => t.abbreviation === espnAbbr);
          if (myTeam && (myTeam.conference === 'AFC' || myTeam.conference === 'NFC')) {
            seeds[myTeam.conference as 'AFC' | 'NFC'][seedValue] = { ...myTeam, seed: seedValue };
            espnTeamsFound++;
          }
        }
      });

      if (espnTeamsFound === 14) {
        return seeds;
      }
    }
  } catch (err) {
    console.warn("[WARN] ESPN API indisponível. Utilizando cálculo local de Seeds.");
  }
  
  (['AFC', 'NFC'] as const).forEach(conf => {
    const confTeams = teams
      .filter(t => t.conference === conf)
      .map(t => {
        const record = standings.find(s => s.team_id?.toString() === t.id.toString()) || { wins: 0, losses: 0, ties: 0 };
        const totalGames = record.wins + record.losses + record.ties;
        const pct = totalGames === 0 ? 0 : (record.wins + (record.ties * 0.5)) / totalGames;
        return { ...t, ...record, pct };
      });

    const divisions = ['North', 'South', 'East', 'West'];
    let divisionWinners: any[] = [];
    let remainingTeams: any[] = [...confTeams];

    divisions.forEach(div => {
      const divTeams = remainingTeams.filter(t => t.division === div);
      if (divTeams.length > 0) {
        divTeams.sort((a, b) => b.pct !== a.pct ? b.pct - a.pct : (b.wins || 0) - (a.wins || 0));
        const winner = divTeams[0];
        divisionWinners.push(winner);
        remainingTeams = remainingTeams.filter(t => t.id !== winner.id);
      }
    });

    divisionWinners.sort((a, b) => b.pct !== a.pct ? b.pct - a.pct : (b.wins || 0) - (a.wins || 0));
    divisionWinners.forEach((team, index) => { seeds[conf][index + 1] = { ...team, seed: index + 1 }; });

    remainingTeams.sort((a, b) => b.pct !== a.pct ? b.pct - a.pct : (b.wins || 0) - (a.wins || 0));
    const wildCards = remainingTeams.slice(0, 3);
    wildCards.forEach((team, index) => { seeds[conf][index + 5] = { ...team, seed: index + 5 }; });
  });

  return seeds;
}