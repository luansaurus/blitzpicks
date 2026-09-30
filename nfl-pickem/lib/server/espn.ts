export interface ESPNTeam {
  id: string;
  abbreviation?: string;
  name?: string;
  displayName?: string;
}

export interface ESPNAthleteStat {
  athlete?: { shortName?: string; displayName?: string };
  stats?: string[];
}

export interface ESPNStatBlock {
  name: string;
  labels?: string[];
  athletes?: ESPNAthleteStat[];
}

export function findTeam(espnTeam: ESPNTeam, dbTeams: any[]) {
  if (!espnTeam || !dbTeams) return null;
  const espnAbbr = espnTeam.abbreviation?.toUpperCase() || '';
  const espnName = espnTeam.name?.toLowerCase() || ''; 
  const espnDisplayName = espnTeam.displayName?.toLowerCase() || ''; 

  const abbrCorrectionMap: Record<string, string> = { 'WAS': 'WSH', 'LA': 'LAR', 'LVR': 'LV', 'NEP': 'NE' };
  const targetAbbr = abbrCorrectionMap[espnAbbr] || espnAbbr;

  return dbTeams.find(t => {
    const dbAbbr = t.abbreviation?.toUpperCase() || '';
    const dbName = t.name?.toLowerCase() || '';
    const dbFullName = `${t.city} ${t.name}`.toLowerCase();
    return (dbAbbr === targetAbbr || dbName === espnName || dbFullName === espnDisplayName);
  });
}

export function getTeamStat(espnTeamId: string, statName: string, summaryData: any): string {
  const teamBox = summaryData?.boxscore?.teams?.find((t: any) => t.team?.id === espnTeamId);
  return teamBox?.statistics?.find((s: any) => s.name === statName)?.displayValue || "0";
}

export function getKicks(espnTeamId: string, type: string, summaryData: any): string {
  const players = summaryData?.boxscore?.players?.find((p: any) => p.team?.id === espnTeamId);
  if (!players) return "0/0";
  const kickStats = players.statistics?.find((s: any) => s.name === "kicking");
  if (!kickStats) return "0/0";
  const idx = kickStats.labels?.indexOf(type);
  if (idx === -1 || idx === undefined) return "0/0";
  
  let makes = 0, attempts = 0;
  kickStats.athletes?.forEach((a: any) => {
    const val = a.stats?.[idx] || "";
    const parts = val.split(/\/|-/);
    if(parts.length === 2) {
      makes += parseInt(parts[0]) || 0;
      attempts += parseInt(parts[1]) || 0;
    }
  });
  return `${makes}/${attempts}`;
}

export function getPunts(espnTeamId: string, summaryData: any): number {
  const players = summaryData?.boxscore?.players?.find((p: any) => p.team?.id === espnTeamId);
  if (!players) return 0;
  const puntStats = players.statistics?.find((s: any) => s.name === "punting");
  if (!puntStats) return 0;
  const idx = puntStats.labels?.indexOf("NO");
  if (idx === -1 || idx === undefined) return 0;
  return puntStats.athletes?.reduce((acc: number, a: any) => acc + (parseInt(a.stats?.[idx]) || 0), 0) || 0;
}

export function extractFullRoster(espnTeamId: string, summaryData: any) {
  const playersData = summaryData?.boxscore?.players?.find((p: any) => p.team?.id === espnTeamId);
  if (!playersData || !playersData.statistics) return [];

  const passers: any[] = [];
  const rushers: any[] = [];
  const receivers: any[] = [];
  const defenders: any[] = [];

  playersData.statistics.forEach((statBlock: ESPNStatBlock) => {
    const catName = statBlock.name;
    const labels = statBlock.labels || [];

    if (catName === 'passing') {
      const cAttIdx = labels.indexOf('C/ATT');
      const ydsIdx = labels.indexOf('YDS');
      const tdIdx = labels.indexOf('TD');
      const intIdx = labels.indexOf('INT');
      statBlock.athletes?.forEach(a => {
        const cAtt = a.stats?.[cAttIdx] || '0/0';
        const yds = parseFloat(a.stats?.[ydsIdx] as string) || 0;
        const td = parseFloat(a.stats?.[tdIdx] as string) || 0;
        const int = parseFloat(a.stats?.[intIdx] as string) || 0;
        const name = a.athlete?.shortName || a.athlete?.displayName || 'N/A';
        if (yds !== 0 || td !== 0 || int !== 0) {
          passers.push({ category: 'PASSING', name, stat: `${cAtt}, ${yds} YDS, ${td} TD, ${int} INT`, sortYds: yds });
        }
      });
    } else if (catName === 'rushing') {
      const carIdx = labels.indexOf('CAR');
      const ydsIdx = labels.indexOf('YDS');
      const tdIdx = labels.indexOf('TD');
      statBlock.athletes?.forEach(a => {
        const car = a.stats?.[carIdx] || '0';
        const yds = parseFloat(a.stats?.[ydsIdx] as string) || 0;
        const td = parseFloat(a.stats?.[tdIdx] as string) || 0;
        const name = a.athlete?.shortName || a.athlete?.displayName || 'N/A';
        if (yds !== 0 || td !== 0) {
          rushers.push({ category: 'RUSHING', name, stat: `${car} CAR, ${yds} YDS, ${td} TD`, sortYds: yds });
        }
      });
    } else if (catName === 'receiving') {
      const recIdx = labels.indexOf('REC');
      const ydsIdx = labels.indexOf('YDS');
      const tdIdx = labels.indexOf('TD');
      statBlock.athletes?.forEach(a => {
        const rec = a.stats?.[recIdx] || '0';
        const yds = parseFloat(a.stats?.[ydsIdx] as string) || 0;
        const td = parseFloat(a.stats?.[tdIdx] as string) || 0;
        const name = a.athlete?.shortName || a.athlete?.displayName || 'N/A';
        if (yds !== 0 || td !== 0) {
          receivers.push({ category: 'RECEIVING', name, stat: `${rec} REC, ${yds} YDS, ${td} TD`, sortYds: yds });
        }
      });
    } else if (catName === 'defensive') {
      const sackIdx = labels.indexOf('SACKS');
      const intIdx = labels.indexOf('INT');
      statBlock.athletes?.forEach(a => {
        const sacks = parseFloat(a.stats?.[sackIdx] as string) || 0;
        const ints = parseFloat(a.stats?.[intIdx] as string) || 0;
        const name = a.athlete?.shortName || a.athlete?.displayName || 'N/A';
        if (sacks > 0) defenders.push({ category: 'SACKS', name, stat: sacks.toString() });
        if (ints > 0) defenders.push({ category: 'INTERCEPTIONS', name, stat: ints.toString() });
      });
    }
  });

  passers.sort((a, b) => b.sortYds - a.sortYds);
  rushers.sort((a, b) => b.sortYds - a.sortYds);
  receivers.sort((a, b) => b.sortYds - a.sortYds);

  const finalList: any[] = [];
  if (passers.length > 0) finalList.push(passers.shift());
  if (rushers.length > 0) finalList.push(rushers.shift());
  if (receivers.length > 0) finalList.push(receivers.shift());

  finalList.push(...passers, ...rushers, ...receivers, ...defenders);
  return finalList.map(({ sortYds, ...rest }) => rest);
}