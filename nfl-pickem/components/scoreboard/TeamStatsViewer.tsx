"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../utils/supabase/client";
import { User, Shield, ArrowLeft, ChevronRight, Activity } from "lucide-react";

interface TeamStatsViewerProps {
  teamId: string;
  teamInfo: any;
}

type FullViewCategory = 'pass' | 'rush' | 'rec' | 'sack' | 'kick' | null;

const getSafeColor = (hex: string) => {
  if (!hex) return '#f59e0b';
  let r = parseInt(hex.substring(1, 3), 16) / 255;
  let g = parseInt(hex.substring(3, 5), 16) / 255;
  let b = parseInt(hex.substring(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  if (l < 0.45) { l = 0.55; s = Math.max(s, 0.90); }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  r = hue2rgb(p, q, h + 1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1/3);
  const toHex = (x: number) => {
    const hexStr = Math.round(x * 255).toString(16);
    return hexStr.length === 1 ? '0' + hexStr : hexStr;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export default function TeamStatsViewer({ teamId, teamInfo }: TeamStatsViewerProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'players' | 'team'>('players');
  const [fullViewCategory, setFullViewCategory] = useState<FullViewCategory>(null);

  useEffect(() => {
    async function fetchTeamStats() {
      if (!teamId) return;
      setLoading(true);
      const supabase = createClient();
      
      const { data: teamGames } = await supabase
        .from('games')
        .select('home_team_id, away_team_id, home_score, away_score, meta_data')
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .eq('status', 'finished');

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
        teamDefTotals: { sacks: totalDefSacks, ints: totalDefInts, fums: totalDefFums }
      });
      setLoading(false);
    }
    
    fetchTeamStats();
  }, [teamId]);

  if (loading || !stats) {
    return (
      <div className="bg-neutral-900 border border-white/5 rounded-xl p-6 flex flex-col items-center justify-center animate-pulse h-64">
         <div className="w-10 h-10 border-2 border-gray-600 border-t-white rounded-full animate-spin mb-3"></div>
         <span className="text-gray-500 font-bold uppercase tracking-widest text-xs">Loading Playbooks...</span>
      </div>
    );
  }

  const { tStats, oStats, fullPlayers, teamDefTotals } = stats;
  const tColor = getSafeColor(teamInfo?.primary_color);
  const G = tStats.games || 1;

  if (fullViewCategory) {
    const isOffense = ['pass', 'rush', 'rec'].includes(fullViewCategory);
    const dataList = fullPlayers[fullViewCategory] || [];
    
    const categoryTitles: Record<string, string> = {
      pass: 'Passing Leaders', rush: 'Rushing Leaders', rec: 'Receiving Leaders',
      sack: 'Sack Leaders', kick: 'Special Teams (Kickers)'
    };

    return (
      <div className="bg-neutral-900 border border-white/5 rounded-xl flex flex-col animate-fadeIn overflow-hidden shadow-lg">
        <div className="p-4 sm:p-5 border-b border-white/5 bg-black/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setFullViewCategory(null)} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition">
              <ArrowLeft size={18} />
            </button>
            <h3 className="text-sm font-black uppercase tracking-widest text-white">{categoryTitles[fullViewCategory]}</h3>
          </div>
          {teamInfo?.logo_url && <img src={teamInfo.logo_url} className="w-6 h-6 object-contain opacity-50" alt="" />}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap min-w-[400px]">
            <thead>
              <tr className="text-[10px] text-gray-500 uppercase tracking-widest border-b border-white/5 bg-black/20">
                <th className="px-4 py-3 font-black w-10 text-center">RK</th>
                <th className="px-4 py-3 font-black">Player</th>
                {isOffense && (
                  <>
                    <th className="px-4 py-3 font-black text-right">YDS</th>
                    <th className="px-4 py-3 font-black text-center">TD</th>
                    {fullViewCategory === 'pass' && <th className="px-4 py-3 font-black text-center">INT</th>}
                    {fullViewCategory === 'rec' && <th className="px-4 py-3 font-black text-center">REC</th>}
                  </>
                )}
                {fullViewCategory === 'sack' && <th className="px-4 py-3 font-black text-right">SACKS</th>}
                {fullViewCategory === 'kick' && (
                   <>
                     <th className="px-4 py-3 font-black text-center">FG</th>
                     <th className="px-4 py-3 font-black text-center">XP</th>
                     <th className="px-4 py-3 font-black text-right">PTS</th>
                   </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {dataList.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-gray-500 text-xs uppercase tracking-widest font-bold">No stats recorded</td></tr>
              ) : (
                dataList.map((p: any, i: number) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3 text-center text-gray-600 font-black">{i + 1}</td>
                    <td className="px-4 py-3 text-white font-bold">{p.name}</td>
                    
                    {isOffense && (
                      <>
                        <td className="px-4 py-3 text-right font-black" style={{ color: tColor }}>{p.yds}</td>
                        <td className="px-4 py-3 text-center font-bold text-gray-300">{p.td}</td>
                        {fullViewCategory === 'pass' && <td className="px-4 py-3 text-center font-bold text-red-400">{p.int}</td>}
                        {fullViewCategory === 'rec' && <td className="px-4 py-3 text-center font-bold text-gray-500">{p.rec}</td>}
                      </>
                    )}
                    
                    {fullViewCategory === 'sack' && <td className="px-4 py-3 text-right font-black" style={{ color: tColor }}>{p.sack}</td>}
                    {fullViewCategory === 'kick' && (
                       <>
                         <td className="px-4 py-3 text-center font-bold text-gray-300">{p.fgM}/{p.fgA}</td>
                         <td className="px-4 py-3 text-center font-bold text-gray-300">{p.xpM}/{p.xpA}</td>
                         <td className="px-4 py-3 text-right font-black" style={{ color: tColor }}>{p.pts}</td>
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
      if (cat === 'pass') return <span className="text-gray-400">{p.td} TD <span className="text-gray-600 px-1">|</span> <span className="text-red-400/80">{p.int} INT</span></span>;
      if (cat === 'rush') return <span className="text-gray-400">{p.td} TD</span>;
      if (cat === 'rec') return <span className="text-gray-400">{p.rec} REC <span className="text-gray-600 px-1">|</span> {p.td} TD</span>;
      if (cat === 'kick') return <span className="text-gray-400">{p.fgM}/{p.fgA} FG <span className="text-gray-600 px-1">|</span> {p.xpM}/{p.xpA} XP</span>;
      return <span className="text-gray-500">-</span>;
    };

    return (
      <div className="bg-black/30 border border-white/5 rounded-xl overflow-hidden flex flex-col hover:border-white/10 transition-colors shadow-lg h-full">
        <div className="px-3 py-2 bg-black/40 border-b border-white/5 flex justify-between items-center">
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">{title}</span>
        </div>
        <div className="p-3 flex-1 flex flex-col justify-center gap-1">
          {topPlayer ? (
            <>
              <div className="flex justify-between items-center">
                <span className="text-white font-bold text-xs truncate pr-2">{topPlayer.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-sm font-black" style={{ color: tColor }}>{topPlayer[statKey]}</span>
                  <span className="text-[8px] text-gray-500 font-bold uppercase">{statLabel}</span>
                </div>
              </div>
              <div className="text-[9px] font-bold text-right tracking-wide">
                {renderSubText(viewCategory, topPlayer)}
              </div>
            </>
          ) : (
             <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">No Data</span>
          )}
        </div>
        <button 
          onClick={() => setFullViewCategory(viewCategory)}
          className="w-full py-2 bg-white/[0.02] hover:bg-white/5 border-t border-white/5 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-1 mt-auto"
        >
          View All <ChevronRight size={10} />
        </button>
      </div>
    );
  };

  const TeamStatMiniCard = ({ title, totalVal, statLabel, viewCategory }: any) => (
    <div className="bg-black/30 border border-white/5 rounded-xl overflow-hidden flex flex-col hover:border-white/10 transition-colors shadow-lg h-full">
      <div className="px-3 py-2 bg-black/40 border-b border-white/5 flex justify-between items-center">
        <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">{title}</span>
      </div>
      <div className="p-3 flex-1 flex flex-col justify-center items-center gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-3xl font-black" style={{ color: tColor }}>{totalVal || 0}</span>
          <span className="text-[10px] text-gray-500 font-bold uppercase">{statLabel}</span>
        </div>
      </div>
      <button 
        onClick={() => setFullViewCategory(viewCategory)}
        className="w-full py-2 bg-white/[0.02] hover:bg-white/5 border-t border-white/5 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-1 mt-auto"
      >
        View All <ChevronRight size={10} />
      </button>
    </div>
  );

  const StaticStatMiniCard = ({ title, totalVal, statLabel }: any) => (
    <div className="bg-black/30 border border-white/5 rounded-xl overflow-hidden flex flex-col shadow-lg h-full">
      <div className="px-3 py-2 bg-black/40 border-b border-white/5 flex justify-between items-center">
        <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">{title}</span>
      </div>
      <div className="p-3 flex-1 flex flex-col justify-center items-center gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-3xl font-black text-white">{totalVal || 0}</span>
          <span className="text-[10px] text-gray-500 font-bold uppercase">{statLabel}</span>
        </div>
      </div>
      <div className="w-full py-2 bg-white/[0.02] border-t border-white/5 mt-auto">
        <span className="text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 opacity-0 pointer-events-none">
          View All <ChevronRight size={10} />
        </span>
      </div>
    </div>
  );

  const CompareRow = ({ label, teamVal, oppVal, isGoodIfHigher = true }: any) => {
      const tNum = parseFloat(teamVal);
      const oNum = parseFloat(oppVal);
      
      let tClass = "text-white";
      let oClass = "text-gray-400";
      
      if (!isNaN(tNum) && !isNaN(oNum) && tNum !== oNum) {
          if ((isGoodIfHigher && tNum > oNum) || (!isGoodIfHigher && tNum < oNum)) {
              tClass = "text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.2)]";
              oClass = "text-gray-500";
          } else {
              tClass = "text-gray-500";
              oClass = "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.2)]";
          }
      }

      return (
          <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] px-2 rounded transition-colors">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-1/3 truncate">{label}</span>
              <div className="flex gap-4 sm:gap-6 w-2/3 justify-end text-sm sm:text-base font-black items-center">
                  <span className={`w-12 text-right ${tClass}`}>{teamVal || 0}</span>
                  <span className="text-gray-600 font-normal text-xs">|</span>
                  <span className={`w-12 text-right ${oClass}`}>{oppVal || 0}</span>
              </div>
          </div>
      );
  };

  return (
    <div className="bg-neutral-900 border border-white/5 rounded-2xl flex flex-col overflow-hidden relative shadow-2xl">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        {teamInfo?.logo_url && <img src={teamInfo.logo_url} className="w-48 h-48 object-contain" alt="" />}
      </div>
      
      <div className="flex border-b border-white/5 bg-black/40 relative z-10">
        <button 
          onClick={() => setActiveTab('players')} 
          className={`flex-1 py-3.5 text-[10px] sm:text-xs font-black uppercase tracking-widest transition flex items-center justify-center gap-2 ${activeTab === 'players' ? 'text-white bg-white/5' : 'text-gray-500 hover:text-gray-300'}`}
          style={activeTab === 'players' ? { borderBottom: `2px solid ${tColor}` } : {}}
        >
          <User size={14} /> Player Stats
        </button>
        <button 
          onClick={() => setActiveTab('team')} 
          className={`flex-1 py-3.5 text-[10px] sm:text-xs font-black uppercase tracking-widest transition flex items-center justify-center gap-2 ${activeTab === 'team' ? 'text-white bg-white/5' : 'text-gray-500 hover:text-gray-300'}`}
          style={activeTab === 'team' ? { borderBottom: `2px solid ${tColor}` } : {}}
        >
          <Activity size={14} /> Team Matchup
        </button>
      </div>

      <div className="p-4 sm:p-5 relative z-10">
        
        {activeTab === 'players' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-fadeIn">
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
          <div className="bg-black/30 border border-white/5 rounded-xl p-4 sm:p-6 flex flex-col animate-fadeIn shadow-inner">
            
            <div className="flex justify-between items-center text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-white/10 pb-3 mb-2 px-2">
               <span className="w-1/3">Matchup Metric</span>
               <div className="flex gap-4 sm:gap-6 w-2/3 justify-end items-center">
                  <span className="w-12 text-right" style={{ color: tColor }}>{teamInfo.abbreviation}</span>
                  <span className="text-gray-600/0">|</span>
                  <span className="w-12 text-right text-gray-400">OPP</span>
               </div>
            </div>
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
        )}
        
      </div>
    </div>
  );
}