"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../utils/supabase/client";

interface UserTeamHeroProps {
  teamId: string | number | null;
  score: number;
  lastGame?: any;
  nextGame?: any;
  teamsDataMap?: Record<string, any>;
}

const calculatePct = (w = 0, l = 0, t = 0) => {
  const total = w + l + t;
  if (total === 0) return ".000";
  const pct = (w + (t * 0.5)) / total;
  return pct === 1 ? "1.000" : pct.toFixed(3).replace("0.", ".");
};

const formatRecord = (recordStr?: string) => {
  if (!recordStr) return "";
  const parts = recordStr.split('-');
  if (parts.length === 3 && parts[2] === '0') {
    return `${parts[0]}-${parts[1]}`;
  }
  return recordStr;
};

export default function UserTeamHero({ teamId, score, lastGame, nextGame, teamsDataMap }: UserTeamHeroProps) {
  const [teamInfo, setTeamInfo] = useState<any>(null);
  const [fullStandings, setFullStandings] = useState<any>(null); 
  
  const [divisionStandings, setDivisionStandings] = useState<any[]>([]);
  const [loadingStandings, setLoadingStandings] = useState<boolean>(true);
  
  const [seasonLeaders, setSeasonLeaders] = useState<any[]>([]);
  const [loadingLeaders, setLoadingLeaders] = useState<boolean>(true);
  
  const [activeTab, setActiveTab] = useState<'profile' | 'lastMatch' | 'nextMatch' | null>(null);

  useEffect(() => {
    async function fetchTeamAndStandings() {
      if (!teamId) return;
      const supabase = createClient();
      
      const { data: teamData } = await supabase.from('teams').select('*').eq('id', teamId).single();
      if (teamData) setTeamInfo(teamData);

      if (teamData && teamData.abbreviation !== 'NFL') {
        try {
          const { data: divTeams } = await supabase.from('teams').select('id, name, abbreviation, logo_url').eq('conference', teamData.conference).eq('division', teamData.division);

          if (divTeams && divTeams.length > 0) {
            const divTeamIds = divTeams.map(t => t.id);
            const { data: divStd } = await supabase.from('standings').select('*').in('team_id', divTeamIds);

            let merged = divTeams.map(t => {
              const std = divStd?.find(s => s.team_id === t.id) || {};
              return { ...t, ...std };
            });

            merged.sort((a, b) => {
              const getPctVal = (w=0, l=0, t=0) => (w+l+t === 0 ? 0 : (w + t*0.5)/(w+l+t));
              const pctA = getPctVal(a.wins, a.losses, a.ties);
              const pctB = getPctVal(b.wins, b.losses, b.ties);
              if (pctB !== pctA) return pctB - pctA;
              return (b.wins || 0) - (a.wins || 0);
            });

            setDivisionStandings(merged);
            const myStd = merged.find(m => m.id.toString() === teamId.toString());
            if (myStd) setFullStandings(myStd);
          }
        } catch (e) {
          console.error("Erro ao buscar a classificação", e);
        } finally {
          setLoadingStandings(false);
        }

        try {
          const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamData.abbreviation.toLowerCase()}`);
          if (res.ok) {
            const espnData = await res.json();
            const stats = espnData?.team?.record?.items?.[0]?.stats;
            if (stats && Array.isArray(stats) && stats.length > 0) {
              const passing = stats.find((s: any) => s.name === 'passingYards');
              const rushing = stats.find((s: any) => s.name === 'rushingYards');
              const receiving = stats.find((s: any) => s.name === 'receivingYards');

              setSeasonLeaders([
                { category: 'Passing', name: 'Total', stat: `${passing?.value || 0} PASS YDS` },
                { category: 'Rushing', name: 'Total', stat: `${rushing?.value || 0} RUSH YDS` },
                { category: 'Receiving', name: 'Total', stat: `${receiving?.value || 0} REC YDS` },
              ]);
            } else {
              setSeasonLeaders([
                { category: 'Passing', name: 'Preseason', stat: '0 PASS YDS' },
                { category: 'Rushing', name: 'Preseason', stat: '0 RUSH YDS' },
                { category: 'Receiving', name: 'Preseason', stat: '0 REC YDS' },
              ]);
            }
          }
        } catch (error) {
          setSeasonLeaders([
            { category: 'Passing', name: 'Offline', stat: '- PASS YDS' },
            { category: 'Rushing', name: 'Offline', stat: '- RUSH YDS' },
            { category: 'Receiving', name: 'Offline', stat: '- REC YDS' },
          ]);
        } finally {
          setLoadingLeaders(false);
        }
      } else {
          setLoadingLeaders(false);
          setLoadingStandings(false);
      }
    }
    
    fetchTeamAndStandings();
  }, [teamId]);

  if (!teamInfo) {
    return (
      <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6 sm:p-10 text-center animate-pulse">
        <div className="w-16 h-16 bg-neutral-800 rounded-full mx-auto mb-4"></div>
        <div className="h-4 bg-neutral-800 w-32 mx-auto rounded"></div>
      </div>
    );
  }

  const isGenericNFL = teamInfo.abbreviation === 'NFL';
  const myRecordFromMap = teamsDataMap?.[teamId?.toString() || '']?.record;
  const formattedMyRecord = myRecordFromMap ? formatRecord(myRecordFromMap) : "0-0";

  let cityStr = "";
  let nameStr = "Locker Room";
  if (!isGenericNFL && teamInfo.name) {
    if (teamInfo.city || teamInfo.location) {
      cityStr = teamInfo.city || teamInfo.location;
      nameStr = teamInfo.name;
    } else {
      const parts = teamInfo.name.trim().split(' ');
      if (parts.length > 1) {
        nameStr = parts.pop();
        cityStr = parts.join(' ');
      } else {
        nameStr = teamInfo.name;
      }
    }
  }

  let wonLast = false;
  let lastOppAbbr = "OPP";
  let lastScoreDisplay = "";
  let isLastHome = false;
  if (lastGame && teamsDataMap) {
    isLastHome = lastGame.home_team_id?.toString() === teamId?.toString();
    const oppId = isLastHome ? lastGame.away_team_id : lastGame.home_team_id;
    lastOppAbbr = teamsDataMap[oppId?.toString()]?.abbr || "OPP";
    const myScore = isLastHome ? lastGame.home_score : lastGame.away_score;
    const oppScore = isLastHome ? lastGame.away_score : lastGame.home_score;
    wonLast = myScore > oppScore;
    lastScoreDisplay = `${myScore} - ${oppScore}`;
  }

  let nextOppAbbr = "BYE";
  let nextDateStr = "BYE WEEK";
  let isNextHome = false;
  let isNextLive = false;
  let nextScoreDisplay = "";
  let wonNextLive = false;

  if (nextGame && teamsDataMap) {
    isNextHome = nextGame.home_team_id?.toString() === teamId?.toString();
    const oppId = isNextHome ? nextGame.away_team_id : nextGame.home_team_id;
    nextOppAbbr = teamsDataMap[oppId?.toString()]?.abbr || "OPP";
    nextDateStr = new Date(nextGame.game_time).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    isNextLive = nextGame.status === 'in_progress';
    
    if (isNextLive) {
      const myLiveScore = isNextHome ? nextGame.home_score : nextGame.away_score;
      const oppLiveScore = isNextHome ? nextGame.away_score : nextGame.home_score;
      wonNextLive = (myLiveScore || 0) > (oppLiveScore || 0);
      nextScoreDisplay = `${myLiveScore || 0} - ${oppLiveScore || 0}`;
    }
  }

  const renderGameDetails = (gameToRender: any, titleStr: string) => {
    if (!gameToRender) return null;
    const isHome = gameToRender.home_team_id?.toString() === teamId?.toString();
    const oppId = isHome ? gameToRender.away_team_id : gameToRender.home_team_id;
    const oppAbbr = teamsDataMap?.[oppId?.toString()]?.abbr || "OPP";
    
    const homeAbbr = isHome ? teamInfo.abbreviation : oppAbbr;
    const awayAbbr = !isHome ? teamInfo.abbreviation : oppAbbr;

    const myLogo = teamInfo.logo_url;
    const oppLogo = teamsDataMap?.[oppId?.toString()]?.logo || teamsDataMap?.[oppId?.toString()]?.logo_url;

    const rawOppRecord = teamsDataMap?.[oppId?.toString()]?.record;
    const oppRecordStr = rawOppRecord ? formatRecord(rawOppRecord) : "";
    const myRecordStr = formattedMyRecord;

    const myScore = isHome ? gameToRender.home_score : gameToRender.away_score;
    const oppScore = isHome ? gameToRender.away_score : gameToRender.home_score;
    const wonMatch = (myScore || 0) > (oppScore || 0);
    const isTie = myScore !== null && myScore === oppScore;
    
    let homeLeaders: any[] = [];
    let awayLeaders: any[] = [];
    if (gameToRender.meta_data && gameToRender.meta_data.leaders) {
      homeLeaders = gameToRender.meta_data.leaders.home || [];
      awayLeaders = gameToRender.meta_data.leaders.away || [];
    }

    return (
      <div className={`border rounded-xl p-6 flex flex-col max-w-2xl mx-auto w-full shadow-lg ${gameToRender.status === 'in_progress' ? 'bg-red-950/20 border-red-500/30' : 'bg-white/5 border-white/10'}`}>
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
          <span className="text-xs font-black uppercase tracking-widest text-gray-400">
            {titleStr}
          </span>
          {gameToRender.clock && (
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${gameToRender.status === 'in_progress' ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-black/40 text-gray-400'}`}>
              {gameToRender.clock}
            </span>
          )}
        </div>
        
        <div className="flex justify-center items-center gap-4 sm:gap-8 mb-6 bg-black/40 py-6 px-4 rounded-xl border border-white/5">
            <div className="flex flex-col items-center flex-1">
              <span className="text-[10px] font-bold text-gray-500 mb-2">{isHome ? 'HOME' : 'AWAY'}</span>
              {myLogo && <img src={myLogo} alt="Home Team" className="w-12 h-12 sm:w-16 sm:h-16 object-contain mb-2 drop-shadow-lg" />}
              <div className="flex flex-col items-center">
                <span className="text-3xl sm:text-4xl font-black text-white leading-none mb-1">{teamInfo.abbreviation}</span>
                {myRecordStr && <span className="text-[10px] sm:text-xs font-bold text-gray-500 leading-none">{myRecordStr}</span>}
              </div>
            </div>
            
            <div className="flex items-center gap-3 sm:gap-5 pb-6">
              <span className={`text-4xl sm:text-6xl font-black ${wonMatch ? 'text-green-400' : isTie ? 'text-white' : 'text-gray-300'}`}>
                {myScore !== null ? myScore : '-'}
              </span>
              <span className="text-gray-600 font-black text-xl sm:text-2xl">-</span>
              <span className={`text-4xl sm:text-6xl font-black ${!wonMatch && !isTie && (myScore !== null) ? 'text-red-400' : isTie ? 'text-white' : 'text-gray-300'}`}>
                {oppScore !== null ? oppScore : '-'}
              </span>
            </div>
            
            <div className="flex flex-col items-center flex-1">
              <span className="text-[10px] font-bold text-gray-500 mb-2">{!isHome ? 'HOME' : 'AWAY'}</span>
              {oppLogo && <img src={oppLogo} alt="Away Team" className="w-12 h-12 sm:w-16 sm:h-16 object-contain mb-2 drop-shadow-lg" />}
              <div className="flex flex-col items-center">
                <span className="text-3xl sm:text-4xl font-black text-white leading-none mb-1">{oppAbbr}</span>
                {oppRecordStr && <span className="text-[10px] sm:text-xs font-bold text-gray-500 leading-none">{oppRecordStr}</span>}
              </div>
            </div>
        </div>

        {(homeLeaders.length > 0 || awayLeaders.length > 0) ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 block border-b border-white/5 pb-2">
                {awayAbbr} Leaders
              </span>
              <div className="flex flex-col gap-2">
                {awayLeaders.map((l: any, i: number) => {
                  const formattedStat = l.stat ? l.stat.replace('YDS', `${l.category.toUpperCase()} YDS`) : '-';
                  return (
                    <div key={i} className="flex flex-col bg-black/30 border border-white/5 rounded-lg p-2.5">
                      <span className="text-gray-400 text-[10px] font-bold truncate leading-tight mb-0.5">{l.name}</span>
                      <span className="text-white font-black text-xs leading-tight">{formattedStat}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 block border-b border-white/5 pb-2">
                {homeAbbr} Leaders
              </span>
              <div className="flex flex-col gap-2">
                {homeLeaders.map((l: any, i: number) => {
                  const formattedStat = l.stat ? l.stat.replace('YDS', `${l.category.toUpperCase()} YDS`) : '-';
                  return (
                    <div key={i} className="flex flex-col bg-black/30 border border-white/5 rounded-lg p-2.5">
                      <span className="text-gray-400 text-[10px] font-bold truncate leading-tight mb-0.5">{l.name}</span>
                      <span className="text-white font-black text-xs leading-tight">{formattedStat}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full flex items-center justify-center text-xs font-bold text-gray-600 uppercase tracking-widest py-4 bg-black/20 rounded-lg">
            Player stats not available
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl group flex flex-col bg-neutral-950 transition-all duration-500">
      
      <div 
        className="absolute inset-0 opacity-20 transition-all duration-700 group-hover:opacity-30 group-hover:scale-105 z-0"
        style={{ background: `linear-gradient(135deg, ${teamInfo.primary_color} 0%, transparent 100%)` }}
      />

      {teamInfo.logo_url && (
        <img 
          src={teamInfo.logo_url} 
          alt="" 
          className="absolute -top-10 -right-6 w-48 h-48 sm:w-64 sm:h-64 object-contain opacity-[0.06] sm:opacity-[0.08] rotate-12 pointer-events-none z-0 mix-blend-screen" 
        />
      )}
      
      <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between p-6 sm:p-10 pb-4 sm:pb-6">
        
        <div className="flex items-center gap-4 sm:gap-6 w-full md:w-auto">
          {teamInfo.logo_url ? (
            <div className="w-16 h-16 sm:w-28 sm:h-28 bg-black/40 p-3 sm:p-4 rounded-full border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-md shrink-0">
              <img src={teamInfo.logo_url} alt={teamInfo.name} className="w-full h-full object-contain drop-shadow-xl" />
            </div>
          ) : (
            <div className="w-16 h-16 sm:w-28 sm:h-28 bg-black/30 rounded-full border border-white/10 shrink-0" />
          )}
          
          <div className="flex flex-col">
            {!isGenericNFL && cityStr && (
              <span className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">
                {cityStr}
              </span>
            )}
            <h1 className="text-3xl sm:text-5xl font-black italic uppercase tracking-widest text-white drop-shadow-md leading-none mb-1">
              {nameStr}
            </h1>
            {!isGenericNFL ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] sm:text-xs font-black text-white bg-white/10 px-2 py-0.5 rounded tracking-widest leading-none">
                  {formattedMyRecord}
                </span>
              </div>
            ) : (
              <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest leading-none mt-1">
                Global Locker Room
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-start md:items-end w-full md:w-auto mt-2 md:mt-0 pt-4 md:pt-0 border-t border-white/10 md:border-t-0">
            <div className="flex flex-col items-start md:items-end">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-500">Total Points</span>
                <span 
                  key={score} // A MÁGICA VISUAL ACONTECE AQUI (força animação ao atualizar)
                  className="text-5xl sm:text-7xl font-black italic tracking-tighter text-white leading-none mt-1 animate-fadeIn" 
                  style={{ textShadow: `0 0 25px ${teamInfo.primary_color}` }}
                >
                {score}
                </span>
            </div>
        </div>
      </div>

      {!isGenericNFL && (
        <div className="relative z-10 w-full px-6 sm:px-10 pb-4">
          <button 
            onClick={() => setActiveTab(activeTab === 'profile' ? null : 'profile')}
            className={`w-full py-2 border rounded-lg text-[10px] font-bold uppercase tracking-widest transition flex justify-center items-center gap-2 backdrop-blur-sm ${activeTab === 'profile' ? 'bg-white/10 border-white/20 text-white' : 'border-white/10 bg-black/30 hover:bg-black/50 text-gray-400'}`}
          >
            {activeTab === 'profile' ? 'Hide Team Details ▲' : 'View Team Profile & Records ▼'}
          </button>
        </div>
      )}

      {activeTab !== null && !isGenericNFL && (
        <div className="relative z-10 bg-black/60 border-t border-white/5 animate-fadeIn p-6 sm:p-10 pt-4 sm:pt-6">
          
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col">
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Season Leaders</span>
                </div>
                
                {loadingLeaders ? (
                    <div className="animate-pulse space-y-3">
                          <div className="h-4 bg-white/5 rounded w-full"></div>
                          <div className="h-4 bg-white/5 rounded w-full"></div>
                          <div className="h-4 bg-white/5 rounded w-full"></div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2.5">
                        {seasonLeaders.map((leader, i) => (
                            <div key={i} className="flex justify-between items-center bg-black/30 p-2 rounded">
                                <div className="flex flex-col">
                                  <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest">{leader.category}</span>
                                  <span className="text-xs text-white font-medium">{leader.name}</span>
                                </div>
                                <span className="text-sm text-white font-black">{leader.stat}</span>
                            </div>
                        ))}
                    </div>
                )}
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col overflow-x-auto">
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    {teamInfo.conference} {teamInfo.division}
                  </span>
                </div>
                
                {loadingStandings ? (
                  <div className="animate-pulse space-y-3">
                     <div className="h-6 bg-white/5 rounded w-full"></div>
                     <div className="h-6 bg-white/5 rounded w-full"></div>
                     <div className="h-6 bg-white/5 rounded w-full"></div>
                  </div>
                ) : (
                  <table className="w-full text-left text-[9px] sm:text-[10px] whitespace-nowrap">
                    <thead>
                      <tr className="text-gray-500 border-b border-white/5">
                        <th className="pb-2 font-black uppercase tracking-widest">Team</th>
                        <th className="pb-2 text-center font-black uppercase tracking-widest w-6">W</th>
                        <th className="pb-2 text-center font-black uppercase tracking-widest w-6">L</th>
                        <th className="pb-2 text-center font-black uppercase tracking-widest w-6">T</th>
                        <th className="pb-2 text-center font-black uppercase tracking-widest w-10">PCT</th>
                        <th className="pb-2 text-center font-black uppercase tracking-widest hidden sm:table-cell">DIV</th>
                        <th className="pb-2 text-center font-black uppercase tracking-widest hidden sm:table-cell">CONF</th>
                        <th className="pb-2 text-center font-black uppercase tracking-widest hidden lg:table-cell">NON-CONF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {divisionStandings.map((row) => (
                        <tr key={row.id} className={row.id === teamId ? "bg-white/5" : ""}>
                          <td className="py-2.5 flex items-center gap-2 pr-2">
                            {row.logo_url && <img src={row.logo_url} className="w-4 h-4 sm:w-5 sm:h-5 object-contain" alt={row.abbreviation} />}
                            <span className="font-black text-white uppercase">{row.name?.split(' ').pop()}</span>
                          </td>
                          <td className="py-2.5 text-center text-white font-bold">{row.wins || 0}</td>
                          <td className="py-2.5 text-center text-white font-bold">{row.losses || 0}</td>
                          <td className="py-2.5 text-center text-white font-bold">{row.ties || 0}</td>
                          <td className="py-2.5 text-center text-amber-500 font-black">{calculatePct(row.wins, row.losses, row.ties)}</td>
                          <td className="py-2.5 text-center text-gray-400 font-bold hidden sm:table-cell">{row.division_record || "0-0"}</td>
                          <td className="py-2.5 text-center text-gray-400 font-bold hidden sm:table-cell">{row.conference_record || "0-0"}</td>
                          <td className="py-2.5 text-center text-gray-400 font-bold hidden lg:table-cell">{row.non_conference_record || "0-0"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === 'lastMatch' && lastGame && (
            <div className="w-full animate-fadeIn">
              {renderGameDetails(lastGame, "Last Match Box Score")}
            </div>
          )}

          {activeTab === 'nextMatch' && nextGame && (
            <div className="w-full animate-fadeIn">
              {renderGameDetails(nextGame, isNextLive ? "🔴 Live Match Box Score" : "Upcoming Match Preview")}
            </div>
          )}

        </div>
      )}

      {(!isGenericNFL) && (
        <div className="relative z-10 bg-black/50 border-t border-white/10 backdrop-blur-xl grid grid-cols-2 divide-x divide-white/10">
          
          <button 
            onClick={() => setActiveTab(activeTab === 'lastMatch' ? null : 'lastMatch')}
            disabled={!lastGame}
            className={`p-3 sm:p-4 flex flex-col justify-center items-center text-center transition-colors ${!lastGame ? 'opacity-50 cursor-not-allowed' : activeTab === 'lastMatch' ? 'bg-white/5' : 'hover:bg-white/5 cursor-pointer'}`}
          >
            <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mb-1 ${activeTab === 'lastMatch' ? 'text-white' : 'text-gray-400'}`}>Last Match</span>
            {lastGame ? (
              <div className="flex items-center gap-2 font-black text-sm sm:text-base">
                <span className={wonLast ? "text-green-500" : "text-gray-400"}>{lastScoreDisplay.split(' - ')[0]}</span>
                <span className="text-gray-500 text-xs font-bold px-1">{isLastHome ? "vs" : "@"} {lastOppAbbr}</span>
                <span className={!wonLast && parseInt(lastScoreDisplay.split(' - ')[0]) < parseInt(lastScoreDisplay.split(' - ')[1]) ? "text-red-500" : "text-gray-400"}>{lastScoreDisplay.split(' - ')[1]}</span>
              </div>
            ) : (
              <span className="text-xs text-gray-600 font-bold italic">-</span>
            )}
          </button>

          <button 
            onClick={() => { if(nextGame) setActiveTab(activeTab === 'nextMatch' ? null : 'nextMatch') }}
            disabled={!nextGame}
            className={`p-3 sm:p-4 flex flex-col justify-center items-center text-center transition-colors ${!nextGame ? 'cursor-default' : activeTab === 'nextMatch' ? 'bg-white/5' : 'hover:bg-white/5 cursor-pointer'}`}
          >
            <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mb-1 ${isNextLive ? 'text-red-500 animate-pulse' : activeTab === 'nextMatch' ? 'text-white' : 'text-gray-400'}`}>
              {isNextLive ? '🔴 Live Now' : 'Next Kickoff'}
            </span>
            {nextGame ? (
              <div className="font-black text-sm sm:text-base text-white">
                {isNextLive ? (
                  <div className="flex items-center justify-center gap-2">
                    <span className={wonNextLive ? "text-green-400" : "text-white"}>{nextScoreDisplay.split(' - ')[0]}</span>
                    <span className="text-gray-500 text-xs font-bold px-1">{isNextHome ? "vs" : "@"} {nextOppAbbr}</span>
                    <span className={!wonNextLive && parseInt(nextScoreDisplay.split(' - ')[0]) < parseInt(nextScoreDisplay.split(' - ')[1]) ? "text-red-400" : "text-white"}>{nextScoreDisplay.split(' - ')[1]}</span>
                  </div>
                ) : (
                  <>
                    {isNextHome ? "vs" : "@"} {nextOppAbbr}
                    <span className="block text-[9px] sm:text-[10px] text-gray-400 font-bold mt-0.5">
                      {nextDateStr}
                    </span>
                  </>
                )}
              </div>
            ) : (
              <span className="text-sm font-black text-gray-500 uppercase tracking-widest">BYE WEEK</span>
            )}
          </button>
          
        </div>
      )}
    </div>
  );
}