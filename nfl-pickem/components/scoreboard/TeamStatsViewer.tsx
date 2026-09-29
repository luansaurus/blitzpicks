"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../utils/supabase/client";
import { User, Activity, ArrowLeft, ChevronRight, ArrowUpDown, ChevronDown, ChevronUp, Calendar, Circle } from "lucide-react";
import GameCard from "./GameCard";

interface TeamStatsViewerProps {
  teamId: string;
  teamInfo: any;
  userColor?: string;
}

type FullViewCategory = 'pass' | 'rush' | 'rec' | 'sack' | 'kick' | null;

const getLuminance = (hex: string) => {
  if (!hex) return 0;
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(x => x + x).join('');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  return ((r * 299) + (g * 587) + (b * 114)) / 1000;
};

const getBestColor = (pri: string, sec: string) => {
  const p = pri || '#111111';
  const s = sec || '#ff2a2a';
  return getLuminance(p) > getLuminance(s) ? p : s;
};

export default function TeamStatsViewer({ teamId, teamInfo, userColor }: TeamStatsViewerProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'players' | 'team' | 'games'>('players');
  const [fullViewCategory, setFullViewCategory] = useState<FullViewCategory>(null);
  
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    setSortConfig(null);
  }, [fullViewCategory]);

  useEffect(() => {
    async function fetchTeamStats() {
      if (!teamId) return;
      setLoading(true);
      const supabase = createClient();
      
      const [{ data: teamGames }, { data: allTeams }, { data: seasonGames }] = await Promise.all([
        supabase
          .from('games')
          .select('home_team_id, away_team_id, home_score, away_score, meta_data')
          .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
          .eq('status', 'finished'),
        supabase.from('teams').select('*'),
        supabase
          .from('games')
          .select('*, stadium(name, city)')
          .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
          .order('game_time', { ascending: true })
      ]);

      const tMap: Record<string, any> = {};
      allTeams?.forEach(t => {
        tMap[t.id.toString()] = { name: t.name, abbr: t.abbreviation, logo: t.logo_url, color: getBestColor(t.primary_color, t.secondary_color) };
      });

      const players = { pass: {}, rush: {}, rec: {}, def: {}, kick: {} } as any;

      const tStats = { games: 0, pts: 0, passYds: 0, rushYds: 0, passTds: 0, rushTds: 0, defTds: 0, sacks: 0, turnovers: 0 };
      const oStats = { pts: 0, passYds: 0, rushYds: 0, passTds: 0, rushTds: 0, defTds: 0, sacks: 0, turnovers: 0 };

      let totalDefSacks = 0;
      let totalDefInts = 0;
      let totalDefFums = 0;

      (teamGames || []).forEach(game => {
        tStats.games += 1;
        const isHome = game.home_team_id.toString() === teamId.toString();
        
        tStats.pts += (isHome ? game.home_score : game.away_score) || 0;
        oStats.pts += (isHome ? game.away_score : game.home_score) || 0;

        const myLeaders = isHome ? game.meta_data?.leaders?.home : game.meta_data?.leaders?.away;
        const teamDef = myLeaders?.find((l: any) => l.category === 'TEAM_DEF');
        if (teamDef) {
            const matchSacks = teamDef.stat.match(/(\d+(?:\.\d+)?)\s*Sack/i);
            const matchInts = teamDef.stat.match(/(\d+)\s*INT/i);
            const matchFums = teamDef.stat.match(/(\d+)\s*Fum/i);
            if (matchSacks) totalDefSacks += parseFloat(matchSacks[1]);
            if (matchInts) totalDefInts += parseInt(matchInts[1]);
            if (matchFums) totalDefFums += parseInt(matchFums[1]);
        }

        const raw = game.meta_data?.raw_boxscore;
        
        if (raw && raw.teams && raw.players) {
            const myName = teamInfo.name?.toLowerCase() || '';
            const isT0Mine = raw.teams[0]?.team?.name?.toLowerCase().includes(myName) || raw.teams[0]?.team?.displayName?.toLowerCase().includes(myName);
            
            const myTeamBox = isT0Mine ? raw.teams[0] : raw.teams[1];
            const oppTeamBox = isT0Mine ? raw.teams[1] : raw.teams[0];

            const getTeamVal = (box: any, statName: string) => parseFloat(box?.statistics?.find((s: any) => s.name === statName)?.displayValue?.split('-')[0]) || 0;

            tStats.passYds += getTeamVal(myTeamBox, 'netPassingYards');
            oStats.passYds += getTeamVal(oppTeamBox, 'netPassingYards');
            
            tStats.rushYds += getTeamVal(myTeamBox, 'rushingYards');
            oStats.rushYds += getTeamVal(oppTeamBox, 'rushingYards');
            
            tStats.turnovers += getTeamVal(myTeamBox, 'turnovers'); 
            oStats.turnovers += getTeamVal(oppTeamBox, 'turnovers'); 

            tStats.sacks += getTeamVal(oppTeamBox, 'sacksYardsLost'); 
            oStats.sacks += getTeamVal(myTeamBox, 'sacksYardsLost');

            tStats.defTds += getTeamVal(myTeamBox, 'defensiveTouchdowns');
            oStats.defTds += getTeamVal(oppTeamBox, 'defensiveTouchdowns');

            const myPlayersTds: any = {};
            const oppPlayersTds: any = {};

            const processPlayers = (teamBlock: any, isMyTeam: boolean) => {
                teamBlock?.forEach((statBlock: any) => {
                    const cat = statBlock.name?.toLowerCase();
                    const labels = statBlock.labels || [];
                    
                    const getPStat = (a: any, labelStr: string) => {
                        const idx = labels.findIndex((l:string) => l === labelStr || l === `${labelStr}S`);
                        return idx >= 0 ? (parseFloat(a.stats[idx]) || 0) : 0;
                    };
                    const getPStr = (a: any, labelStr: string) => {
                        const idx = labels.findIndex((l:string) => l === labelStr);
                        return idx >= 0 ? a.stats[idx] : null;
                    };

                    statBlock.athletes?.forEach((a: any) => {
                        const name = a.athlete?.shortName || a.athlete?.displayName;
                        if (!name) return;

                        const tdsMap = isMyTeam ? myPlayersTds : oppPlayersTds;
                        if (!tdsMap[name]) tdsMap[name] = { pass: 0, rush: 0 };

                        if (cat === 'passing') {
                            const yds = getPStat(a, 'YDS'), td = getPStat(a, 'TD'), int = getPStat(a, 'INT');
                            tdsMap[name].pass = Math.max(tdsMap[name].pass, td);
                            if (isMyTeam) {
                                if(!players.pass[name]) players.pass[name] = {yds:0, td:0, int:0};
                                players.pass[name].yds += yds; players.pass[name].td += td; players.pass[name].int += int;
                            }
                        } 
                        else if (cat === 'rushing') {
                            const yds = getPStat(a, 'YDS'), td = getPStat(a, 'TD');
                            tdsMap[name].rush = Math.max(tdsMap[name].rush, td);
                            if (isMyTeam) {
                                if(!players.rush[name]) players.rush[name] = {yds:0, td:0};
                                players.rush[name].yds += yds; players.rush[name].td += td;
                            }
                        } 
                        else if (cat === 'receiving') {
                            const yds = getPStat(a, 'YDS'), td = getPStat(a, 'TD'), rec = getPStat(a, 'REC');
                            if (isMyTeam) {
                                if(!players.rec[name]) players.rec[name] = {yds:0, td:0, rec:0};
                                players.rec[name].yds += yds; players.rec[name].td += td; players.rec[name].rec += rec;
                            }
                        } 
                        else if (cat === 'defensive' || cat === 'interceptions' || cat === 'fumbles') {
                            const sack = getPStat(a, 'SACK');
                            if (isMyTeam && cat === 'defensive') {
                                if(!players.def[name]) players.def[name] = {sack:0};
                                players.def[name].sack += sack;
                            }
                        }
                        else if (cat === 'kicking') {
                            const pts = getPStat(a, 'PTS');
                            const fgRaw = getPStr(a, 'FG') || '0/0';
                            const xpRaw = getPStr(a, 'XP') || '0/0';
                            const fgM = parseInt(fgRaw.split('/')[0]) || 0;
                            const fgA = parseInt(fgRaw.split('/')[1]) || 0;
                            const xpM = parseInt(xpRaw.split('/')[0]) || 0;
                            const xpA = parseInt(xpRaw.split('/')[1]) || 0;

                            if (isMyTeam) {
                                if(!players.kick[name]) players.kick[name] = {fgM:0, fgA:0, xpM:0, xpA:0, pts:0};
                                players.kick[name].fgM += fgM; players.kick[name].fgA += fgA;
                                players.kick[name].xpM += xpM; players.kick[name].xpA += xpA;
                                players.kick[name].pts += pts;
                            }
                        }
                    });
                });
            };

            const myPlayersBlock = raw.players?.find((p: any) => p.team?.id === myTeamBox?.team?.id)?.statistics || [];
            const oppPlayersBlock = raw.players?.find((p: any) => p.team?.id === oppTeamBox?.team?.id)?.statistics || [];

            processPlayers(myPlayersBlock, true);
            processPlayers(oppPlayersBlock, false);

            let myPassTds = 0, myRushTds = 0;
            Object.values(myPlayersTds).forEach((p: any) => { myPassTds += p.pass; myRushTds += p.rush; });
            tStats.passTds += myPassTds;
            tStats.rushTds += myRushTds;

            let oppPassTds = 0, oppRushTds = 0;
            Object.values(oppPlayersTds).forEach((p: any) => { oppPassTds += p.pass; oppRushTds += p.rush; });
            oStats.passTds += oppPassTds;
            oStats.rushTds += oppRushTds;
        }
      });

      const sortPlayers = (dict: Record<string, any>, key: string) => {
        return Object.entries(dict).map(([name, data]) => ({ name, ...data as any })).sort((a, b) => b[key] - a[key]);
      };

      setStats({
        fullPlayers: {
          pass: sortPlayers(players.pass, 'yds').filter(p => p.yds > 0),
          rush: sortPlayers(players.rush, 'yds').filter(p => p.yds > 0),
          rec: sortPlayers(players.rec, 'yds').filter(p => p.yds > 0),
          sack: sortPlayers(players.def, 'sack').filter(p => p.sack > 0),
          kick: sortPlayers(players.kick, 'pts').filter(p => p.pts > 0)
        },
        tStats, oStats, 
        teamDefTotals: { sacks: totalDefSacks, ints: totalDefInts, fums: totalDefFums },
        seasonGames: seasonGames || [],
        teamsMap: tMap
      });
      setLoading(false);
    }
    
    fetchTeamStats();
  }, [teamId, teamInfo]);

  const handleSort = (key: string) => {
    let direction: 'desc' | 'asc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown size={10} className="opacity-30" />;
    return sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-white drop-shadow-md" /> : <ChevronDown size={12} className="text-white drop-shadow-md" />;
  };

  if (loading || !stats) {
    return (
      <div className="bg-[#050505]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center animate-pulse h-64 shadow-2xl">
         <div className="w-12 h-12 border-4 border-gray-800 border-t-white rounded-full animate-spin mb-4"></div>
         <span className="text-gray-500 font-sans font-black uppercase tracking-widest text-xs">Loading Playbooks...</span>
      </div>
    );
  }

  const { tStats, oStats, fullPlayers, teamDefTotals, seasonGames, teamsMap } = stats;
  
  const teamPri = teamInfo?.primary_color || '#111111';
  const teamSec = teamInfo?.secondary_color || '#ff2a2a';
  const tColor = getLuminance(teamPri) > getLuminance(teamSec) ? teamPri : teamSec;
  
  const G = tStats.games || 1;

  if (fullViewCategory) {
    const isOffense = ['pass', 'rush', 'rec'].includes(fullViewCategory);
    const dataList = fullPlayers[fullViewCategory] || [];
    
    const sortedDataList = [...dataList].sort((a, b) => {
      if (!sortConfig) return 0;
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      
      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      }
      return sortConfig.direction === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
    });

    const categoryTitles: Record<string, string> = {
      pass: 'Passing Leaders', rush: 'Rushing Leaders', rec: 'Receiving Leaders',
      sack: 'Sack Leaders', kick: 'Special Teams (Kickers)'
    };

    return (
      <div className="bg-[#050505]/95 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col animate-fadeIn overflow-hidden shadow-2xl relative">
        <div 
          className="absolute inset-0 z-0 pointer-events-none opacity-10"
          style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 8px)' }}
        />
        
        <div className="p-3 sm:p-5 border-b border-white/10 bg-black/60 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3 sm:gap-4">
            <button 
              onClick={() => setFullViewCategory(null)} 
              className="p-1.5 sm:p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all hover:scale-105"
            >
              <ArrowLeft size={18} />
            </button>
            <h3 className="font-sport text-base sm:text-xl font-bold uppercase tracking-widest text-white">{categoryTitles[fullViewCategory]}</h3>
          </div>
          {teamInfo?.logo_url && <img src={teamInfo.logo_url} className="w-6 h-6 sm:w-8 sm:h-8 object-contain opacity-40 drop-shadow-lg" alt="" />}
        </div>
        
        <div className="overflow-x-auto relative z-10 custom-scrollbar">
          <table className="w-full text-left whitespace-nowrap min-w-[300px] sm:min-w-[450px]">
            <thead>
              <tr className="font-sans text-[8px] sm:text-[9px] text-gray-500 uppercase tracking-widest border-b border-white/5 bg-black/80">
                <th className="sticky left-0 z-20 bg-[#0a0a0a] px-3 py-2 sm:px-4 sm:py-3 font-black cursor-pointer shadow-[4px_0_12px_rgba(0,0,0,0.6)] border-r border-white/5" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-1.5">RK / Player {renderSortIcon('name')}</div>
                </th>
                {isOffense && (
                  <>
                    <th className="px-3 py-2 sm:px-4 sm:py-3 font-black text-right cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('yds')}>
                      <div className="flex items-center justify-end gap-1.5">YDS {renderSortIcon('yds')}</div>
                    </th>
                    <th className="px-3 py-2 sm:px-4 sm:py-3 font-black text-center cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('td')}>
                      <div className="flex items-center justify-center gap-1.5">TD {renderSortIcon('td')}</div>
                    </th>
                    {fullViewCategory === 'pass' && (
                      <th className="px-3 py-2 sm:px-4 sm:py-3 font-black text-center cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('int')}>
                        <div className="flex items-center justify-center gap-1.5">INT {renderSortIcon('int')}</div>
                      </th>
                    )}
                    {fullViewCategory === 'rec' && (
                      <th className="px-3 py-2 sm:px-4 sm:py-3 font-black text-center cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('rec')}>
                        <div className="flex items-center justify-center gap-1.5">REC {renderSortIcon('rec')}</div>
                      </th>
                    )}
                  </>
                )}
                {fullViewCategory === 'sack' && (
                  <th className="px-3 py-2 sm:px-4 sm:py-3 font-black text-right cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('sack')}>
                    <div className="flex items-center justify-end gap-1.5">SACKS {renderSortIcon('sack')}</div>
                  </th>
                )}
                {fullViewCategory === 'kick' && (
                   <>
                     <th className="px-3 py-2 sm:px-4 sm:py-3 font-black text-center cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('fgM')}>
                       <div className="flex items-center justify-center gap-1.5">FG {renderSortIcon('fgM')}</div>
                     </th>
                     <th className="px-3 py-2 sm:px-4 sm:py-3 font-black text-center cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('xpM')}>
                       <div className="flex items-center justify-center gap-1.5">XP {renderSortIcon('xpM')}</div>
                     </th>
                     <th className="px-3 py-2 sm:px-4 sm:py-3 font-black text-right cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleSort('pts')}>
                       <div className="flex items-center justify-end gap-1.5">PTS {renderSortIcon('pts')}</div>
                     </th>
                   </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-black/20">
              {sortedDataList.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500 font-sans text-[10px] sm:text-xs uppercase tracking-widest font-bold">No stats recorded</td></tr>
              ) : (
                sortedDataList.map((p: any, i: number) => (
                  <tr key={i} className="hover:bg-white/[0.04] transition-colors group">
                    <td className="sticky left-0 z-10 bg-[#0a0a0a] group-hover:bg-[#141414] px-3 py-2 sm:px-4 sm:py-3 shadow-[4px_0_12px_rgba(0,0,0,0.6)] border-r border-white/5 transition-colors">
                      <div className="flex items-center gap-2 sm:gap-3 w-28 sm:w-40">
                        <span className="font-sport text-gray-500 text-[9px] sm:text-[10px] w-3 sm:w-4 text-center shrink-0">{i + 1}</span>
                        <span className="text-white font-bold font-sport uppercase tracking-wider text-[9px] sm:text-[10px] truncate leading-tight">{p.name}</span>
                      </div>
                    </td>
                    
                    {isOffense && (
                      <>
                        <td className="px-3 py-2 sm:px-4 sm:py-3 text-right font-jersey text-base sm:text-lg" style={{ color: tColor, textShadow: `0 0 10px ${tColor}40` }}>{p.yds}</td>
                        <td className="px-3 py-2 sm:px-4 sm:py-3 text-center font-jersey text-base sm:text-lg text-gray-300">{p.td}</td>
                        {fullViewCategory === 'pass' && <td className="px-3 py-2 sm:px-4 sm:py-3 text-center font-jersey text-base sm:text-lg text-red-500/80">{p.int}</td>}
                        {fullViewCategory === 'rec' && <td className="px-3 py-2 sm:px-4 sm:py-3 text-center font-jersey text-base sm:text-lg text-gray-500">{p.rec}</td>}
                      </>
                    )}
                    
                    {fullViewCategory === 'sack' && <td className="px-3 py-2 sm:px-4 sm:py-3 text-right font-jersey text-base sm:text-lg" style={{ color: tColor, textShadow: `0 0 10px ${tColor}40` }}>{p.sack}</td>}
                    {fullViewCategory === 'kick' && (
                       <>
                         <td className="px-3 py-2 sm:px-4 sm:py-3 text-center font-jersey text-base sm:text-lg text-gray-300">{p.fgM}/{p.fgA}</td>
                         <td className="px-3 py-2 sm:px-4 sm:py-3 text-center font-jersey text-base sm:text-lg text-gray-300">{p.xpM}/{p.xpA}</td>
                         <td className="px-3 py-2 sm:px-4 sm:py-3 text-right font-jersey text-base sm:text-lg" style={{ color: tColor, textShadow: `0 0 10px ${tColor}40` }}>{p.pts}</td>
                       </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const PlayerMiniCard = ({ title, data, viewCategory, statKey, statLabel }: any) => {
    const topPlayer = data[0];
    const renderSubText = (cat: string, p: any) => {
      if (cat === 'pass') return <span className="text-gray-400 font-sport uppercase tracking-widest">{p.td} TD <span className="text-gray-600 px-1">|</span> <span className="text-red-500">{p.int} INT</span></span>;
      if (cat === 'rush') return <span className="text-gray-400 font-sport uppercase tracking-widest">{p.td} TD</span>;
      if (cat === 'rec') return <span className="text-gray-400 font-sport uppercase tracking-widest">{p.rec} REC <span className="text-gray-600 px-1">|</span> {p.td} TD</span>;
      if (cat === 'kick') return <span className="text-gray-400 font-sport uppercase tracking-widest">{p.fgM}/{p.fgA} FG <span className="text-gray-600 px-1">|</span> {p.xpM}/{p.xpA} XP</span>;
      return <span className="text-gray-500">-</span>;
    };

    return (
      <div className="bg-black/60 border border-white/10 rounded-xl overflow-hidden flex flex-col transition-all group shadow-lg hover:shadow-[0_8px_30px_rgba(0,0,0,0.8)] relative">
        <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        <div className="px-3 py-2 bg-black/80 border-b border-white/5 flex justify-between items-center relative z-10">
          <span className="font-sans text-[9px] font-black uppercase tracking-widest text-gray-400">{title}</span>
        </div>
        <div className="p-4 flex-1 flex flex-col relative z-10">
          {topPlayer ? (
            <>
              <span className="text-white font-sport font-bold text-sm sm:text-base uppercase tracking-wider truncate w-full block mb-2" title={topPlayer.name}>
                {topPlayer.name}
              </span>
              <div className="flex justify-between items-end border-t border-white/5 pt-2 mt-auto">
                <div className="flex items-baseline gap-1.5 shrink-0">
                  <span className="font-jersey text-2xl sm:text-2xl leading-none" style={{ color: tColor, textShadow: `0 0 10px ${tColor}60` }}>{topPlayer[statKey]}</span>
                  <span className="font-sans text-[9px] text-gray-500 font-black uppercase tracking-widest">{statLabel}</span>
                </div>
                <div className="text-[10px] sm:text-xs text-right pb-0.5">
                  {renderSubText(viewCategory, topPlayer)}
                </div>
              </div>
            </>
          ) : (
             <span className="font-sans text-[10px] text-gray-600 font-black uppercase tracking-widest text-center py-4 my-auto">No Data</span>
          )}
        </div>
        <button onClick={() => setFullViewCategory(viewCategory)} className="w-full py-2.5 bg-white/[0.02] hover:bg-white/10 border-t border-white/5 font-sans text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-1 mt-auto relative z-10">
          View All <ChevronRight size={12} />
        </button>
      </div>
    );
  };

  const TeamStatMiniCard = ({ title, totalVal, statLabel, viewCategory }: any) => (
    <div className="bg-black/60 border border-white/10 rounded-xl overflow-hidden flex flex-col transition-all group shadow-lg hover:shadow-[0_8px_30px_rgba(0,0,0,0.8)] relative">
      <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      <div className="px-3 py-2 bg-black/80 border-b border-white/5 flex justify-between items-center relative z-10">
        <span className="font-sans text-[9px] font-black uppercase tracking-widest text-gray-400">{title}</span>
      </div>
      <div className="p-4 flex-1 flex flex-col justify-center items-center gap-1 relative z-10">
        <div className="flex items-baseline gap-1.5">
          <span className="font-jersey text-2xl sm:text-5xl" style={{ color: tColor, textShadow: `0 0 10px ${tColor}60` }}>{totalVal || 0}</span>
          <span className="font-sans text-[9px] text-gray-500 font-black uppercase tracking-widest">{statLabel}</span>
        </div>
      </div>
      <button onClick={() => setFullViewCategory(viewCategory)} className="w-full py-2.5 bg-white/[0.02] hover:bg-white/10 border-t border-white/5 font-sans text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-1 mt-auto relative z-10">
        View All <ChevronRight size={12} />
      </button>
    </div>
  );

  const StaticStatMiniCard = ({ title, totalVal, statLabel }: any) => (
    <div className="bg-black/60 border border-white/10 rounded-xl overflow-hidden flex flex-col shadow-lg relative">
      <div className="px-3 py-2 bg-black/80 border-b border-white/5 flex justify-between items-center relative z-10">
        <span className="font-sans text-[9px] font-black uppercase tracking-widest text-gray-400">{title}</span>
      </div>
      <div className="p-4 flex-1 flex flex-col justify-center items-center gap-1 relative z-10">
        <div className="flex items-baseline gap-1.5">
          <span className="font-jersey text-2xl sm:text-5xl text-white drop-shadow-md">{totalVal || 0}</span>
          <span className="font-sans text-[9px] text-gray-500 font-black uppercase tracking-widest">{statLabel}</span>
        </div>
      </div>
      <div className="w-full py-2.5 bg-white/[0.02] border-t border-white/5 mt-auto relative z-10">
        <span className="font-sans text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 opacity-0 pointer-events-none">
          View All <ChevronRight size={12} />
        </span>
      </div>
    </div>
  );

  const CompareRow = ({ label, teamVal, oppVal, isGoodIfHigher = true }: any) => {
      const tNum = parseFloat(teamVal);
      const oNum = parseFloat(oppVal);
      let tClass = "text-white";
      let oClass = "text-gray-500";
      
      if (!isNaN(tNum) && !isNaN(oNum) && tNum !== oNum) {
          if ((isGoodIfHigher && tNum > oNum) || (!isGoodIfHigher && tNum < oNum)) {
              tClass = "text-green-400 drop-shadow-[0_0_12px_rgba(74,222,128,0.6)]";
              oClass = "text-gray-600";
          } else {
              tClass = "text-gray-600";
              oClass = "text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]";
          }
      }

      return (
          <div className="flex items-center justify-between py-4 border-b border-white/5 last:border-0 hover:bg-white/[0.03] px-3 sm:px-4 rounded-lg transition-colors">
              <span className="font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-400 w-1/3 truncate">{label}</span>
              <div className="flex gap-2 sm:gap-4 w-2/3 justify-end items-center">
                  <span className={`w-16 sm:w-20 text-right font-jersey text-xl sm:text-2xl leading-none ${tClass}`}>{teamVal || 0}</span>
                  <span className="text-gray-700 font-black text-xs sm:text-sm mx-1 sm:mx-2 shrink-0">VS</span>
                  <span className={`w-16 sm:w-20 text-right font-jersey text-xl sm:text-2xl leading-none ${oClass}`}>{oppVal || 0}</span>
              </div>
          </div>
      );
  };

  return (
    <div className="bg-[#050505]/90 backdrop-blur-2xl border border-white/10 rounded-3xl flex flex-col overflow-hidden relative shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20 mix-blend-overlay" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 8px)' }} />
      <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none z-0">
        {teamInfo?.logo_url && <img src={teamInfo.logo_url} className="w-56 h-56 object-contain" alt="" />}
      </div>
      
      <div className="flex border-b border-white/10 bg-black/60 relative z-10 shadow-inner">
        <button onClick={() => setActiveTab('players')} className={`flex-1 py-4 font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'players' ? 'text-white bg-white/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'}`} style={activeTab === 'players' ? { borderBottom: `2px solid ${tColor}`, boxShadow: `inset 0 -10px 20px -10px ${tColor}40` } : {}}>
          <User size={16} /> Player Stats
        </button>
        <button onClick={() => setActiveTab('team')} className={`flex-1 py-4 font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'team' ? 'text-white bg-white/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'}`} style={activeTab === 'team' ? { borderBottom: `2px solid ${tColor}`, boxShadow: `inset 0 -10px 20px -10px ${tColor}40` } : {}}>
          <Activity size={16} /> Team Matchup
        </button>
        <button onClick={() => setActiveTab('games')} className={`flex-1 py-4 font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'games' ? 'text-white bg-white/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'}`} style={activeTab === 'games' ? { borderBottom: `2px solid ${tColor}`, boxShadow: `inset 0 -10px 20px -10px ${tColor}40` } : {}}>
          <Calendar size={16} /> Season Games
        </button>
      </div>

      <div className="p-4 sm:p-6 relative z-10 bg-black/20">
        {activeTab === 'players' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fadeIn">
            <PlayerMiniCard title="Passing" data={fullPlayers.pass} viewCategory="pass" statKey="yds" statLabel="YDS" />
            <PlayerMiniCard title="Rushing" data={fullPlayers.rush} viewCategory="rush" statKey="yds" statLabel="YDS" />
            <PlayerMiniCard title="Receiving" data={fullPlayers.rec} viewCategory="rec" statKey="yds" statLabel="YDS" />
            <PlayerMiniCard title="Kickers (ST)" data={fullPlayers.kick} viewCategory="kick" statKey="pts" statLabel="PTS" />
            
            <TeamStatMiniCard title="Team Sacks" totalVal={teamDefTotals.sacks} statLabel="SCK" viewCategory="sack" />
            <StaticStatMiniCard title="Team Interceptions" totalVal={teamDefTotals.ints} statLabel="INT" />
            <StaticStatMiniCard title="Fumbles Rec." totalVal={teamDefTotals.fums} statLabel="FUM" />
          </div>
        )}

        {activeTab === 'team' && (
          <div className="bg-black/60 border border-white/10 rounded-2xl p-4 sm:p-8 flex flex-col animate-fadeIn shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: tColor }}></div>
            <div className="flex justify-between items-center font-sans text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-white/10 pb-4 mb-3 pl-4 sm:pl-2 px-2">
               <span className="w-1/3">Matchup Metric</span>
               <div className="flex gap-2 sm:gap-4 w-2/3 justify-end items-center">
                  <span className="w-16 sm:w-20 text-right font-sport text-xs sm:text-sm tracking-wider truncate" style={{ color: tColor }}>{teamInfo.abbreviation}</span>
                  <span className="text-gray-700/0 mx-1 sm:mx-2 shrink-0">VS</span>
                  <span className="w-16 sm:w-20 text-right font-sport text-xs sm:text-sm tracking-wider text-gray-400">OPP</span>
               </div>
            </div>
            
            <div className="pl-4 sm:pl-2">
              <CompareRow label="Total YDS/G" teamVal={((tStats.passYds + tStats.rushYds)/G).toFixed(1)} oppVal={((oStats.passYds + oStats.rushYds)/G).toFixed(1)} />
              <CompareRow label="Pass YDS/G" teamVal={(tStats.passYds / G).toFixed(1)} oppVal={(oStats.passYds / G).toFixed(1)} />
              <CompareRow label="Rush YDS/G" teamVal={(tStats.rushYds / G).toFixed(1)} oppVal={(oStats.rushYds / G).toFixed(1)} />
              <CompareRow label="Pass TDs" teamVal={tStats.passTds} oppVal={oStats.passTds} />
              <CompareRow label="Rush TDs" teamVal={tStats.rushTds} oppVal={oStats.rushTds} />
              <CompareRow label="Defensive/ST TDs" teamVal={tStats.defTds} oppVal={oStats.defTds} />
              <CompareRow label="Takeaways (Def)" teamVal={oStats.turnovers} oppVal={tStats.turnovers} />
              <CompareRow label="Giveaways (Off)" teamVal={tStats.turnovers} oppVal={oStats.turnovers} isGoodIfHigher={false} />
              <CompareRow label="Sacks" teamVal={tStats.sacks} oppVal={oStats.sacks} />
              <CompareRow label="Points/G" teamVal={(tStats.pts / G).toFixed(1)} oppVal={(oStats.pts / G).toFixed(1)} />
            </div>
          </div>
        )}

        {activeTab === 'games' && (
          <div className="space-y-4 animate-fadeIn">
            {seasonGames.length === 0 ? (
              <div className="bg-black/60 border border-white/5 rounded-2xl p-10 text-center font-sans text-xs text-gray-500 font-black uppercase tracking-widest">
                No games recorded for this team.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-6 gap-4">
                {seasonGames.map((game: any) => {
                  const homeTeam = teamsMap[game.home_team_id?.toString()] || { name: 'Home', abbr: 'HOME', color: '#171717' };
                  const awayTeam = teamsMap[game.away_team_id?.toString()] || { name: 'Away', abbr: 'AWAY', color: '#171717' };

                  return (
                    <div key={game.id} className="transform transition-transform hover:scale-[1.02]">
                      <GameCard 
                        game={game} 
                        userTeamColor={tColor} 
                        homeTeam={homeTeam} 
                        awayTeam={awayTeam} 
                        hidePicks={true}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}