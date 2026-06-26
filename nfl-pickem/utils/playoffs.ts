export async function getPlayoffSeeds(teams: any[], standings: any[]) {
  const seeds: { AFC: Record<number, any>; NFC: Record<number, any> } = {
    AFC: {},
    NFC: {}
  };

  try {
    // 1. TENTA BUSCAR OS SEEDS OFICIAIS DA ESPN
    const res = await fetch('https://site.api.espn.com/apis/v2/sports/football/nfl/standings', { 
      next: { revalidate: 3600 } // Cache de 1 hora para não sobrecarregar a API
    });
    
    if (res.ok) {
      const espnData = await res.json();
      let espnTeamsFound = 0;

      // Função recursiva para varrer a árvore complexa da ESPN e achar os times
      const entries: any[] = [];
      const traverse = (node: any) => {
        if (node.standings && node.standings.entries) {
          entries.push(...node.standings.entries);
        }
        if (node.children) {
          node.children.forEach(traverse);
        }
      };
      traverse(espnData);

      // Cruza os dados da ESPN com o nosso banco de dados
      entries.forEach(entry => {
        const espnAbbr = entry.team?.abbreviation;
        const seedStat = entry.stats?.find((s: any) => s.name === 'playoffSeed');
        const seedValue = seedStat ? parseInt(seedStat.value) : null;

        // Filtra apenas os times que estão dentro da zona de classificação (Seeds 1 ao 7)
        if (espnAbbr && seedValue && seedValue > 0 && seedValue <= 7) {
          // Acha nosso time correspondente no banco
          const myTeam = teams.find(t => t.abbreviation === espnAbbr);
          if (myTeam && (myTeam.conference === 'AFC' || myTeam.conference === 'NFC')) {
            // Garante que o TypeScript entenda que a conferência é válida
            seeds[myTeam.conference as 'AFC' | 'NFC'][seedValue] = { ...myTeam, seed: seedValue };
            espnTeamsFound++;
          }
        }
      });

      // Se achou todos os 14 times classificados, retorna os dados da ESPN!
      if (espnTeamsFound === 14) {
        console.log("🏆 Playoff Seeds carregados com sucesso da ESPN!");
        return seeds;
      }
    }
  } catch (err) {
    console.warn("⚠️ ESPN API indisponível. Caindo para o cálculo local de Seeds.");
  }

  // ==========================================
  // FALLBACK: MOTOR LOCAL MVP
  // (Caso a API falhe ou a temporada ainda não tenha gerado seeds)
  // ==========================================
  
  console.log("⚙️ Gerando Seeds através do cálculo local (PCT).");
  
  // O 'as const' AQUI É O QUE RESOLVE O ERRO DE TIPAGEM DO TYPESCRIPT
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
    divisionWinners.forEach((team, index) => {
      seeds[conf][index + 1] = { ...team, seed: index + 1 };
    });

    remainingTeams.sort((a, b) => b.pct !== a.pct ? b.pct - a.pct : (b.wins || 0) - (a.wins || 0));
    const wildCards = remainingTeams.slice(0, 3);
    wildCards.forEach((team, index) => {
      seeds[conf][index + 5] = { ...team, seed: index + 5 };
    });
  });

  return seeds;
}