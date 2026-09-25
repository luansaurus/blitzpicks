"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../utils/supabase/client";

interface LeagueLeadersViewerProps {
  teamsDataMap: Record<string, any>;
}

type FullViewCategory = 'pass' | 'rush' | 'rec' | 'sack' | 'int' | 'teamOffense' | 'teamDefense' | 'teamSacks' | 'teamTurnovers' | null;

export default function LeagueLeadersViewer({ teamsDataMap }: LeagueLeadersViewerProps) {
  const [loading, setLoading] = useState(true);
  const [leaders, setLeaders] = useState<any>(null);
  
  // Estado para controlar a visão expandida ("Complete Leaders")
  const [fullViewCategory, setFullViewCategory] = useState<FullViewCategory>(null);

  useEffect(() => {
    async function fetchAndCalculateLeagueLeaders() {
      const supabase = createClient();
      
      const { data: games } = await supabase
        .from('games')
        .select('home_team_id, away_team_id, meta_data')
        .eq('status', 'finished');

      if (!games) return;

      const players = { 
        pass: {} as Record<string, any>, 
        rush: {} as Record<string, any>, 
        rec: {} as Record<string, any>, 
        sack: {} as Record<string, any>, 
        int: {} as Record<string, any> 
      };
      
      const teams = {} as Record<string, { games: number, passYds: number, rushYds: number, ydsAllowed: number, sacks: number, takeaways: number, giveaways: number }>;

      games.forEach(g => {
        const homeId = g.home_team_id.toString();
        const awayId = g.away_team_id.toString();

        if (!teams[homeId]) teams[homeId] = { games: 0, passYds: 0, rushYds: 0, ydsAllowed: 0, sacks: 0, takeaways: 0, giveaways: 0 };
        if (!teams[awayId]) teams[awayId] = { games: 0, passYds: 0, rushYds: 0, ydsAllowed: 0, sacks: 0, takeaways: 0, giveaways: 0 };

        teams[homeId].games += 1;
        teams[awayId].games += 1;

        const processLeaders = (teamLeaders: any[], teamId: string, oppId: string) => {
          let gamePassYds = 0;
          let gameRushYds = 0;

          teamLeaders.forEach(l => {
            const cat = l.category?.toUpperCase() || '';
            const stat = (l.stat || '').toUpperCase();
            
            let yds = 0, td = 0, ints = 0, sacks = 0, fums = 0;
            stat.split(',').forEach((p: string) => {
              const clean = p.trim();
              if (clean.includes('YDS')) yds += parseFloat(clean) || 0;
              if (clean.includes('TD')) td += parseFloat(clean) || 0;
              if (clean.includes('INT')) ints += parseFloat(clean) || 0;
              if (clean.includes('SACK')) sacks += parseFloat(clean) || 0;
              if (clean.includes('FUM')) fums += parseFloat(clean) || 0;
            });
            const rawNum = parseFloat(stat);

            if (cat === 'TEAM_DEF') {
              teams[teamId].sacks += sacks;
              teams[teamId].takeaways += (ints + fums);
              teams[oppId].giveaways += (ints + fums);
            } else if (cat.includes('PASS') && !cat.includes('TEAM')) {
              if (!players.pass[l.name]) players.pass[l.name] = { teamId, yds: 0, td: 0, int: 0 };
              players.pass[l.name].yds += yds;
              players.pass[l.name].td += td;
              players.pass[l.name].int += ints;
              gamePassYds += yds;
            } else if (cat.includes('RUSH') && !cat.includes('TEAM')) {
              if (!players.rush[l.name]) players.rush[l.name] = { teamId, yds: 0, td: 0 };
              players.rush[l.name].yds += yds;
              players.rush[l.name].td += td;
              gameRushYds += yds;
            } else if (cat.includes('REC') && !cat.includes('TEAM')) {
              if (!players.rec[l.name]) players.rec[l.name] = { teamId, yds: 0, td: 0 };
              players.rec[l.name].yds += yds;
              players.rec[l.name].td += td;
            } else {
              // Defesa: Captura Sacks
              if (cat.includes('SACK') || stat.includes('SACK')) {
                if (!players.sack[l.name]) players.sack[l.name] = { teamId, val: 0 };
                players.sack[l.name].val += sacks || (!isNaN(rawNum) ? rawNum : 0);
              }
              // Defesa: Captura Interceptações
              if (cat === 'INTERCEPTIONS' || cat === 'INT' || stat.includes('INT')) {
                if (!players.int[l.name]) players.int[l.name] = { teamId, val: 0 };
                players.int[l.name].val += ints || (!isNaN(rawNum) ? rawNum : 0);
              }
            }
          });

          teams[teamId].passYds += gamePassYds;
          teams[teamId].rushYds += gameRushYds;
          teams[oppId].ydsAllowed += (gamePassYds + gameRushYds);
        };

        processLeaders(g.meta_data?.leaders?.home || [], homeId, awayId);
        processLeaders(g.meta_data?.leaders?.away || [], awayId, homeId);
      });

      // Ordenação das Listas Completas
      const sortPlayers = (dict: Record<string, any>, key: string) => {
        return Object.entries(dict)
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b[key] - a[key]);
      };

      const fullPass = sortPlayers(players.pass, 'yds');
      const fullRush = sortPlayers(players.rush, 'yds');
      const fullRec = sortPlayers(players.rec, 'yds');
      const fullSacks = sortPlayers(players.sack, 'val');
      const fullInts = sortPlayers(players.int, 'val');

      const teamList = Object.entries(teams).map(([id, d]) => ({
        id,
        totalYds: (d.passYds + d.rushYds) / (d.games || 1),
        ydsAllowed: d.ydsAllowed / (d.games || 1),
        sacks: d.sacks,
        diff: d.takeaways - d.giveaways
      }));

      const fullTeamOffense = [...teamList].sort((a, b) => b.totalYds - a.totalYds);
      const fullTeamDefense = [...teamList].sort((a, b) => a.ydsAllowed - b.ydsAllowed);
      const fullTeamSacks = [...teamList].sort((a, b) => b.sacks - a.sacks);
      const fullTeamTurnovers = [...teamList].sort((a, b) => b.diff - a.diff);

      setLeaders({
        fullPlayers: { pass: fullPass, rush: fullRush, rec: fullRec, sack: fullSacks, int: fullInts },
        players: { 
          pass: fullPass.slice(0, 5), 
          rush: fullRush.slice(0, 5), 
          rec: fullRec.slice(0, 5), 
          sack: fullSacks.slice(0, 5), 
          int: fullInts.slice(0, 5) 
        },
        fullTeams: {
          teamOffense: fullTeamOffense,
          teamDefense: fullTeamDefense,
          teamSacks: fullTeamSacks,
          teamTurnovers: fullTeamTurnovers
        },
        teams: {
          teamOffense: fullTeamOffense.slice(0, 5),
          teamDefense: fullTeamDefense.slice(0, 5),
          teamSacks: fullTeamSacks.slice(0, 5),
          teamTurnovers: fullTeamTurnovers.slice(0, 5),
        }
      });
      setLoading(false);
    }

    fetchAndCalculateLeagueLeaders();
  }, []);

  if (loading || !leaders) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex items-center justify-center animate-pulse h-64 mt-6">
         <span className="text-gray-500 font-bold uppercase tracking-widest text-xs">Compiling NFL Data...</span>
      </div>
    );
  }

  // ==========================================
  // COMPONENTE: VISÃO EXPANDIDA (COMPLETE LEADERS)
  // ==========================================
  if (fullViewCategory) {
    const isPlayer = ['pass', 'rush', 'rec', 'sack', 'int'].includes(fullViewCategory);
    const isOffense = ['pass', 'rush', 'rec'].includes(fullViewCategory);
    const dataList = isPlayer ? leaders.fullPlayers[fullViewCategory] : leaders.fullTeams[fullViewCategory];

    return (
      <div className="space-y-6 mt-6 animate-fadeIn bg-neutral-900 border border-white/10 rounded-xl p-4 sm:p-8">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-4">
          <h2 className="text-2xl font-black italic uppercase tracking-wider text-white">Complete Leaders</h2>
          <button 
            onClick={() => setFullViewCategory(null)}
            className="text-[10px] font-black uppercase tracking-widest text-gray-400 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg transition-colors border border-white/10"
          >
            ← Back to Overview
          </button>
        </div>

        {/* SUB-NAVEGAÇÃO COM ABAS */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-4 sm:gap-8 border-b border-white/5 pb-4">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Player Offense</span>
            <div className="flex bg-black/40 rounded-lg p-1 border border-white/5 w-fit">
              <button onClick={() => setFullViewCategory('pass')} className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${fullViewCategory === 'pass' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>Passing</button>
              <button onClick={() => setFullViewCategory('rush')} className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${fullViewCategory === 'rush' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>Rushing</button>
              <button onClick={() => setFullViewCategory('rec')} className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${fullViewCategory === 'rec' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>Receiving</button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Player Defense</span>
            <div className="flex bg-black/40 rounded-lg p-1 border border-white/5 w-fit">
              <button onClick={() => setFullViewCategory('sack')} className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${fullViewCategory === 'sack' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>Sacks</button>
              <button onClick={() => setFullViewCategory('int')} className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${fullViewCategory === 'int' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>Interceptions</button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Team Statistics</span>
            <div className="flex bg-black/40 rounded-lg p-1 border border-white/5 w-fit">
              <button onClick={() => setFullViewCategory('teamOffense')} className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${fullViewCategory === 'teamOffense' ? 'bg-amber-500/20 text-amber-500' : 'text-gray-500 hover:text-white'}`}>Offense</button>
              <button onClick={() => setFullViewCategory('teamDefense')} className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${fullViewCategory === 'teamDefense' ? 'bg-amber-500/20 text-amber-500' : 'text-gray-500 hover:text-white'}`}>Defense</button>
              <button onClick={() => setFullViewCategory('teamSacks')} className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${fullViewCategory === 'teamSacks' ? 'bg-amber-500/20 text-amber-500' : 'text-gray-500 hover:text-white'}`}>Sacks</button>
              <button onClick={() => setFullViewCategory('teamTurnovers')} className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${fullViewCategory === 'teamTurnovers' ? 'bg-amber-500/20 text-amber-500' : 'text-gray-500 hover:text-white'}`}>Turnovers</button>
            </div>
          </div>
        </div>

        {/* TABELA COMPLETA (DINÂMICA PARA JOGADOR OU TIME) */}
        <div className="bg-black/20 border border-white/5 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap min-w-[500px]">
            <thead>
              <tr className="text-[10px] text-gray-500 uppercase tracking-widest border-b border-white/10 bg-black/40">
                <th className="px-4 py-3 font-black w-12 text-center">RK</th>
                {isPlayer ? (
                  <>
                    <th className="px-4 py-3 font-black">Name</th>
                    <th className="px-4 py-3 font-black text-center">Team</th>
                    {isOffense ? (
                      <>
                        <th className="px-4 py-3 font-black text-right">YDS</th>
                        <th className="px-4 py-3 font-black text-center">TD</th>
                        {fullViewCategory === 'pass' && <th className="px-4 py-3 font-black text-center">INT</th>}
                      </>
                    ) : (
                      <th className="px-4 py-3 font-black text-right">{fullViewCategory === 'sack' ? 'SACKS' : 'INTS'}</th>
                    )}
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 font-black">Team</th>
                    <th className="px-4 py-3 font-black text-right">
                      {fullViewCategory === 'teamOffense' ? 'YDS/G' : 
                       fullViewCategory === 'teamDefense' ? 'YDS ALW/G' : 
                       fullViewCategory === 'teamSacks' ? 'SACKS' : 'DIFF'}
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {dataList.map((row: any, i: number) => {
                
                // Renderização para a tabela de JOGADOR
                if (isPlayer) {
                  const team = teamsDataMap[row.teamId] || {};
                  return (
                    <tr key={i} className="hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3 text-center text-gray-600 font-black">{i + 1}</td>
                      <td className="px-4 py-3 text-white font-bold">{row.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          {team.logo && <img src={team.logo} alt={team.abbr} className="w-5 h-5 object-contain" />}
                          <span className="text-[10px] font-black text-gray-400 uppercase">{team.abbr}</span>
                        </div>
                      </td>
                      {isOffense ? (
                        <>
                          <td className="px-4 py-3 text-right font-black text-amber-500">{row.yds}</td>
                          <td className="px-4 py-3 text-center font-bold text-gray-300">{row.td}</td>
                          {fullViewCategory === 'pass' && <td className="px-4 py-3 text-center font-bold text-gray-500">{row.int}</td>}
                        </>
                      ) : (
                        <td className="px-4 py-3 text-right font-black text-amber-500">{row.val}</td>
                      )}
                    </tr>
                  );
                } 
                
                // Renderização para a tabela de TIME
                else {
                  const team = teamsDataMap[row.id] || {};
                  let val = 0;
                  if (fullViewCategory === 'teamOffense') val = row.totalYds;
                  if (fullViewCategory === 'teamDefense') val = row.ydsAllowed;
                  if (fullViewCategory === 'teamSacks') val = row.sacks;
                  if (fullViewCategory === 'teamTurnovers') val = row.diff;

                  const isDecimal = ['teamOffense', 'teamDefense'].includes(fullViewCategory);
                  const displayVal = isDecimal ? val.toFixed(1) : val;

                  return (
                    <tr key={i} className="hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3 text-center text-gray-600 font-black">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {team.logo && <img src={team.logo} alt={team.abbr} className="w-6 h-6 object-contain" />}
                          <span className="text-white font-bold uppercase">{team.name}</span>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right font-black ${fullViewCategory === 'teamTurnovers' ? (val > 0 ? 'text-green-400' : val < 0 ? 'text-red-400' : 'text-gray-400') : 'text-amber-500'}`}>
                        {fullViewCategory === 'teamTurnovers' && val > 0 ? '+' : ''}{displayVal}
                      </td>
                    </tr>
                  );
                }
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ==========================================
  // COMPONENTES: MINI-TABELAS (OVERVIEW)
  // ==========================================
  const PlayerTable = ({ title, statLabel, data, viewCategory }: any) => (
    <div className="bg-neutral-900 border border-white/5 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center px-4 py-3 bg-black/40 border-b border-white/5">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{title}</span>
        <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">{statLabel}</span>
      </div>
      <div className="flex flex-col p-2 gap-1 grow">
        {data.map((p: any, i: number) => {
          const team = teamsDataMap[p.teamId] || {};
          const val = p.yds !== undefined ? p.yds : p.val;
          return (
            <div key={i} className="flex items-center justify-between p-2 rounded hover:bg-white/5 transition group">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-gray-600 font-bold text-xs w-3 text-center shrink-0">{i + 1}</span>
                {team.logo ? (
                  <img src={team.logo} alt={team.abbr} className="w-6 h-6 object-contain drop-shadow-md shrink-0" />
                ) : (
                  <div className="w-6 h-6 bg-white/10 rounded-full shrink-0" />
                )}
                <div className="flex flex-col truncate">
                  <span className="text-white font-bold text-xs truncate">{p.name} <span className="text-gray-500 text-[9px] font-medium ml-1">{team.abbr}</span></span>
                </div>
              </div>
              <span className="text-white font-black text-xs shrink-0 pl-2">{val}</span>
            </div>
          );
        })}
      </div>
      <button 
        onClick={() => setFullViewCategory(viewCategory)}
        className="w-full py-2.5 bg-black/30 border-t border-white/5 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
      >
        Complete Leaders
      </button>
    </div>
  );

  const TeamTable = ({ title, statLabel, data, statKey, isDecimal, viewCategory }: any) => (
    <div className="bg-neutral-900 border border-white/5 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center px-4 py-3 bg-black/40 border-b border-white/5">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{title}</span>
        <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">{statLabel}</span>
      </div>
      <div className="flex flex-col p-2 gap-1 grow">
        {data.map((t: any, i: number) => {
          const team = teamsDataMap[t.id] || {};
          const val = t[statKey];
          return (
            <div key={i} className="flex items-center justify-between p-2 rounded hover:bg-white/5 transition group">
              <div className="flex items-center gap-3">
                <span className="text-gray-600 font-bold text-xs w-3 text-center shrink-0">{i + 1}</span>
                {team.logo ? (
                  <img src={team.logo} alt={team.abbr} className="w-6 h-6 object-contain drop-shadow-md shrink-0" />
                ) : (
                  <div className="w-6 h-6 bg-white/10 rounded-full shrink-0" />
                )}
                <span className="text-white font-bold text-xs leading-none truncate">{team.name}</span>
              </div>
              <span className={`font-black text-xs shrink-0 pl-2 ${statKey === 'diff' ? (val > 0 ? 'text-green-400' : val < 0 ? 'text-red-400' : 'text-gray-400') : 'text-white'}`}>
                {statKey === 'diff' && val > 0 ? '+' : ''}{isDecimal ? val.toFixed(1) : val}
              </span>
            </div>
          );
        })}
      </div>
      <button 
        onClick={() => setFullViewCategory(viewCategory)}
        className="w-full py-2.5 bg-black/30 border-t border-white/5 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
      >
        Complete Leaders
      </button>
    </div>
  );

  return (
    <div className="space-y-8 mt-6 animate-fadeIn">
      
      {/* SEÇÃO JOGADORES (OVERVIEW) */}
      <div className="space-y-4">
        <h2 className="text-xl font-black italic uppercase tracking-wider text-white border-b border-white/10 pb-2">Player Leaders</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
          <PlayerTable title="Passing" statLabel="YDS" data={leaders.players.pass} viewCategory="pass" />
          <PlayerTable title="Rushing" statLabel="YDS" data={leaders.players.rush} viewCategory="rush" />
          <PlayerTable title="Receiving" statLabel="YDS" data={leaders.players.rec} viewCategory="rec" />
          <PlayerTable title="Sacks" statLabel="SACK" data={leaders.players.sack} viewCategory="sack" />
          <PlayerTable title="Interceptions" statLabel="INT" data={leaders.players.int} viewCategory="int" />
        </div>
      </div>

      {/* SEÇÃO TIMES (OVERVIEW) */}
      <div className="space-y-4">
        <h2 className="text-xl font-black italic uppercase tracking-wider text-white border-b border-white/10 pb-2">Team Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
          <TeamTable title="Total Offense" statLabel="YDS/G" data={leaders.teams.teamOffense} statKey="totalYds" isDecimal={true} viewCategory="teamOffense" />
          <TeamTable title="Total Defense" statLabel="YDS ALW/G" data={leaders.teams.teamDefense} statKey="ydsAllowed" isDecimal={true} viewCategory="teamDefense" />
          <TeamTable title="Team Sacks" statLabel="SACKS" data={leaders.teams.teamSacks} statKey="sacks" isDecimal={false} viewCategory="teamSacks" />
          <TeamTable title="Turnover Diff" statLabel="DIFF" data={leaders.teams.teamTurnovers} statKey="diff" isDecimal={false} viewCategory="teamTurnovers" />
        </div>
      </div>

    </div>
  );
}