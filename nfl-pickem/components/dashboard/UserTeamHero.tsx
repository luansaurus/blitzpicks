"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../utils/supabase/client";
import { Circle } from 'lucide-react';
import TeamStatsViewer from '@/components/scoreboard/TeamStatsViewer';
import { getSafeColor } from '@/lib/color';
import { calculatePct } from '@/lib/format';

interface UserTeamHeroProps {
  teamId: string | number | null;
  score: number;
  lastGame?: any;
  nextGame?: any;
  teamsDataMap?: Record<string, any>;
}

export default function UserTeamHero({ teamId, score, lastGame, nextGame, teamsDataMap }: UserTeamHeroProps) {
  const [teamInfo, setTeamInfo] = useState<any>(null);
  const [fullStandings, setFullStandings] = useState<any>(null); 
  
  const [divisionStandings, setDivisionStandings] = useState<any[]>([]);
  const [loadingStandings, setLoadingStandings] = useState<boolean>(true);
  
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
              const pctA = calculatePct(a.wins || 0, a.losses || 0, a.ties || 0);
              const pctB = calculatePct(b.wins || 0, b.losses || 0, b.ties || 0);
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

      } else {
          setLoadingStandings(false);
      }
    }
    
    fetchTeamAndStandings();
  }, [teamId]);

  if (!teamInfo) {
    return (
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 sm:p-10 text-center animate-pulse">
        <div className="w-20 h-20 bg-neutral-800 rounded-xl mx-auto mb-4"></div>
        <div className="h-4 bg-neutral-800 w-32 mx-auto rounded"></div>
      </div>
    );
  }

  const isGenericNFL = teamInfo.abbreviation === 'NFL';
  const myRecordFromMap = teamsDataMap?.[teamId?.toString() || '']?.record;
  const formattedMyRecord = myRecordFromMap || "0-0";

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

  // Define a cor de destaque usando utilitário seguro importado (agora vindo do lib/color.ts)
  const heroColor = teamInfo.primary_color ? getSafeColor(teamInfo.primary_color) : '#ff2a2a';

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
    const oppRecordStr = rawOppRecord || "0-0";
    const myRecordStr = formattedMyRecord;

    const myScore = isHome ? gameToRender.home_score : gameToRender.away_score;
    const oppScore = isHome ? gameToRender.away_score : gameToRender.home_score;
    const wonMatch = (myScore || 0) > (oppScore || 0);
    const isTie = myScore !== null && myScore === oppScore;
    
    const filterAndFormatLeaders = (leaders: any[]) => {
      const result: any[] = [];
      const offensiveCategories = ['PASS', 'RUSH', 'REC'];
      const offensive = leaders.filter(l => {
        const cat = l.category?.toUpperCase() || '';
        return offensiveCategories.some(a => cat.includes(a)) && cat !== 'TEAM_DEF' && cat !== 'TEAM_ST';
      }).map(l => {
        let badge = 'STAT';
        const cat = l.category?.toUpperCase() || '';
        if (cat.includes('PASS')) badge = 'PASS';
        else if (cat.includes('RUSH')) badge = 'RUSH';
        else if (cat.includes('REC')) badge = 'REC';

        let formattedStat = l.stat || '-';
        if (!isNaN(Number(formattedStat))) formattedStat = `${formattedStat} ${badge}`;
        else formattedStat = formattedStat.replace(/YARDS YDS/gi, 'YDS').replace(/YDS YDS/gi, 'YDS');

        return { ...l, badge, formattedStat };
      }).slice(0, 3);
      result.push(...offensive);

      const teamDef = leaders.find(l => l.category === 'TEAM_DEF');
      if (teamDef) {
        result.push({ ...teamDef, badge: 'DEF', formattedStat: teamDef.stat });
      } else {
        let totalSacks = 0, totalInts = 0, totalFumbles = 0;
        leaders.forEach(l => {
          const cat = l.category?.toUpperCase() || '';
          const statVal = parseFloat(l.stat) || 0;
          if (cat.includes('SACK')) totalSacks += statVal;
          if (cat.includes('INT') && !cat.includes('PASS')) totalInts += statVal;
          if (cat.includes('FUM') || cat.includes('RECOVER')) totalFumbles += statVal;
        });
        result.push({ name: 'Team Defense', badge: 'DEF', formattedStat: `${totalSacks} Sacks, ${totalInts} INT, ${totalFumbles} Fum. Rec.` });
      }

      const teamSt = leaders.find(l => l.category === 'TEAM_ST');
      if (teamSt) {
        result.push({ ...teamSt, badge: 'ST', formattedStat: teamSt.stat });
      } else {
        let stStats: string[] = [];
        leaders.forEach(l => {
          const cat = l.category?.toUpperCase() || '';
          const stat = l.stat || '';
          if (cat.includes('FG') || cat.includes('FIELD GOAL') || cat.includes('KICK')) stStats.push(`FG: ${stat}`);
          else if (cat.includes('XP') || cat.includes('EXTRA POINT')) stStats.push(`XP: ${stat}`);
          else if (cat.includes('PUNT')) stStats.push(`Punts: ${stat} (${l.name})`);
        });
        result.push({ name: 'Special Teams', badge: 'ST', formattedStat: stStats.length > 0 ? stStats.join(' | ') : '0/0 FG | 0/0 XP | 0 Punts' });
      }

      return result;
    };

    let homeLeaders: any[] = [];
    let awayLeaders: any[] = [];
    
    if (gameToRender.meta_data && gameToRender.meta_data.leaders) {
      homeLeaders = filterAndFormatLeaders(gameToRender.meta_data.leaders.home || []);
      awayLeaders = filterAndFormatLeaders(gameToRender.meta_data.leaders.away || []);
    }

    return (
      <div className={`border-t-4 rounded-xl p-6 flex flex-col max-w-2xl mx-auto w-full shadow-2xl relative overflow-hidden ${gameToRender.status === 'in_progress' ? 'bg-[#0f0505] border-red-500/50' : 'bg-[#0a0a0a] border-white/20'}`} style={gameToRender.status !== 'in_progress' ? { borderTopColor: heroColor } : {}}>
        
        <div 
          className="absolute inset-0 z-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 8px)'
          }}
        />

        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10 relative z-10">
          <span className="font-sans text-xs font-black uppercase tracking-widest text-gray-400">
            {titleStr}
          </span>
          {gameToRender.clock && (
            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-inner ${gameToRender.status === 'in_progress' ? 'bg-red-500 text-white animate-pulse' : 'bg-black text-gray-400 border border-white/10'}`}>
              {gameToRender.clock}
            </span>
          )}
        </div>
        
        <div className="flex justify-center items-center gap-4 sm:gap-8 mb-6 bg-black/60 py-6 px-4 rounded-xl border border-white/5 relative z-10 shadow-inner">
            <div className="flex flex-col items-center flex-1">
              <span className="text-[10px] font-black tracking-widest text-gray-500 mb-2">AWAY</span>
              {(!isHome ? myLogo : oppLogo) && <img src={!isHome ? myLogo : oppLogo} alt="Away Team" className="w-12 h-12 sm:w-16 sm:h-16 object-contain mb-3 drop-shadow-xl" />}
              <div className="flex flex-col items-center">
                <span className="font-jersey font-bold text-5xl sm:text-6xl tracking-widest text-white leading-none mb-2">{awayAbbr}</span>
                <span className="text-[9px] font-sans font-bold tracking-widest text-gray-500 leading-none">{!isHome ? myRecordStr : oppRecordStr}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4 sm:gap-6 pb-6">
              <span className={`font-jersey font-bold text-6xl sm:text-8xl ${wonMatch && !isHome ? `text-[${heroColor}] drop-shadow-[0_0_10px_${heroColor}80]` : isTie ? 'text-white' : 'text-gray-500'}`} style={wonMatch && !isHome ? { color: heroColor } : {}}>
                {(!isHome ? myScore : oppScore) !== null ? (!isHome ? myScore : oppScore) : '-'}
              </span>
              <span className="text-gray-600 font-jersey font-bold text-2xl sm:text-4xl">-</span>
              <span className={`font-jersey font-bold text-6xl sm:text-8xl ${wonMatch && isHome ? `text-[${heroColor}] drop-shadow-[0_0_10px_${heroColor}80]` : isTie ? 'text-white' : 'text-gray-500'}`} style={wonMatch && isHome ? { color: heroColor } : {}}>
                {(isHome ? myScore : oppScore) !== null ? (isHome ? myScore : oppScore) : '-'}
              </span>
            </div>
            
            <div className="flex flex-col items-center flex-1">
              <span className="text-[10px] font-black tracking-widest text-gray-500 mb-2">HOME</span>
              {(isHome ? myLogo : oppLogo) && <img src={isHome ? myLogo : oppLogo} alt="Home Team" className="w-12 h-12 sm:w-16 sm:h-16 object-contain mb-3 drop-shadow-xl" />}
              <div className="flex flex-col items-center">
                <span className="font-jersey font-bold text-5xl sm:text-6xl tracking-widest text-white leading-none mb-2">{homeAbbr}</span>
                <span className="text-[9px] font-sans font-bold tracking-widest text-gray-500 leading-none">{isHome ? myRecordStr : oppRecordStr}</span>
              </div>
            </div>
        </div>

        {(homeLeaders.length > 0 || awayLeaders.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 relative z-10">
            <div className="flex flex-col gap-3">
              <span className="font-sans font-black text-[10px] uppercase tracking-widest text-gray-400 block border-b border-white/10 pb-2">
                {awayAbbr} LEADERS
              </span>
              <div className="flex flex-col gap-2">
                {awayLeaders.map((l: any, i: number) => (
                    <div key={i} className="flex flex-col bg-black/40 border border-white/5 rounded-lg p-3 hover:bg-white/5 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-sans text-gray-300 text-[11px] font-bold truncate leading-tight pr-2">{l.name}</span>
                        <span className={`font-sans text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0 ${l.badge === 'DEF' || l.badge === 'ST' ? 'bg-transparent text-gray-500 border border-white/10' : 'bg-white/10 text-gray-400'}`}>
                          {l.badge}
                        </span>
                      </div>
                      <span className="font-sport font-bold text-white text-lg leading-tight tracking-wide">{l.formattedStat}</span>
                    </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <span className="font-sans font-black text-[10px] uppercase tracking-widest text-gray-400 block border-b border-white/10 pb-2">
                {homeAbbr} LEADERS
              </span>
              <div className="flex flex-col gap-2">
                {homeLeaders.map((l: any, i: number) => (
                    <div key={i} className="flex flex-col bg-black/40 border border-white/5 rounded-lg p-3 hover:bg-white/5 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-sans text-gray-300 text-[11px] font-bold truncate leading-tight pr-2">{l.name}</span>
                        <span className={`font-sans text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0 ${l.badge === 'DEF' || l.badge === 'ST' ? 'bg-transparent text-gray-500 border border-white/10' : 'bg-white/10 text-gray-400'}`}>
                          {l.badge}
                        </span>
                      </div>
                      <span className="font-sport font-bold text-white text-lg leading-tight tracking-wide">{l.formattedStat}</span>
                    </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl group flex flex-col bg-[#0a0a0a] transition-all duration-500">
      
      {/* BACKGROUND HOLOFOTE E TEXTURA DE ESTÁDIO */}
      <div 
        className="absolute inset-0 z-0 transition-all duration-700 opacity-30 group-hover:opacity-50 group-hover:scale-105"
        style={{ background: `radial-gradient(circle at top left, ${heroColor}80 0%, transparent 70%)` }}
      />
      <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 8px)'
        }}
      />
      
      <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center justify-between p-6 sm:p-10 pb-4 sm:pb-6">
        
        <div className="flex items-center gap-4 sm:gap-8 w-full md:w-auto">
          {teamInfo.logo_url ? (
            <div className="w-20 h-20 sm:w-36 sm:h-36 bg-[#050505]/80 p-4 sm:p-6 rounded-2xl border border-white/20 shadow-[0_15px_30px_rgba(0,0,0,0.8)] backdrop-blur-md shrink-0 transition-transform group-hover:rotate-[-5deg]">
              <img src={teamInfo.logo_url} alt={teamInfo.name} className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
            </div>
          ) : (
            <div className="w-20 h-20 sm:w-36 sm:h-36 bg-black/50 rounded-2xl border border-white/10 shrink-0" />
          )}
          
          <div className="flex flex-col min-w-0 flex-1">
            {!isGenericNFL && cityStr && (
              <span className="font-sans text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest leading-none mb-1 sm:mb-2">
                {cityStr}
              </span>
            )}
            
            {/* NOME DO TIME COM TAMBÉM RESPONSIVO (text-2xl no mobile e text-7xl no desktop) */}
            <h1 className="font-jersey font-bold text-2xl sm:text-5xl md:text-7xl uppercase text-white drop-shadow-[0_5px_10px_rgba(0,0,0,0.8)] leading-none mb-1 tracking-wider break-words">
              {nameStr}
            </h1>
            
            {!isGenericNFL ? (
              <div className="flex items-center gap-2 mt-2">
                <span className="font-sport font-bold text-xl sm:text-xl text-white bg-black/60 px-3 py-0.5 border border-white/10 rounded tracking-wider leading-none shadow-inner">
                  {formattedMyRecord}
                </span>
              </div>
            ) : (
              <p className="font-sans text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest leading-none mt-1">
                Global Locker Room
              </p>
            )}
          </div>
        </div>

        {/* PONTUAÇÃO DO USUÁRIO VAZADA (OUTLINE) E GIGANTE */}
        <div className="flex flex-col items-center md:items-end w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t border-white/10 md:border-t-0">
            <span className="font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-400 mb-[-5px] sm:mb-[-10px] z-10 bg-[#0a0a0a] px-2 rounded-full border border-white/10">
              TOTAL POINTS
            </span>
            <span 
              key={score}
              className="font-jersey font-bold text-8xl sm:text-[140px] tracking-tight leading-none animate-fadeIn" 
              style={{ 
                color: 'transparent', 
                WebkitTextStroke: '4px white',
                filter: `drop-shadow(0 0 15px ${heroColor})` 
              }}
            >
            {score}
            </span>
        </div>
      </div>

      {!isGenericNFL && (
        <div className="relative z-10 w-full px-6 sm:px-10 pb-6 mt-4">
          <button 
            onClick={() => setActiveTab(activeTab === 'profile' ? null : 'profile')}
            className={`w-full py-3 border rounded-lg font-sans text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all flex justify-center items-center gap-2 backdrop-blur-md shadow-lg ${activeTab === 'profile' ? 'bg-white text-black border-white' : 'border-white/10 bg-black/40 hover:bg-black/60 hover:border-white/30 text-gray-400'}`}
          >
            {activeTab === 'profile' ? 'HIDE TEAM DATA ▲' : 'VIEW TEAM PROFILE & RECORDS ▼'}
          </button>
        </div>
      )}

      {(!isGenericNFL) && (
        <div className="relative z-10 bg-black/80 border-t border-white/10 backdrop-blur-xl grid grid-cols-2 divide-x divide-white/10">
          
          <button 
            onClick={() => setActiveTab(activeTab === 'lastMatch' ? null : 'lastMatch')}
            disabled={!lastGame}
            className={`p-4 sm:p-5 flex flex-col justify-center items-center text-center transition-colors ${!lastGame ? 'opacity-50 cursor-not-allowed' : activeTab === 'lastMatch' ? 'bg-white/10' : 'hover:bg-white/5 cursor-pointer'}`}
          >
            <span className={`font-sans text-[10px] sm:text-[11px] font-black uppercase tracking-widest mb-2 ${activeTab === 'lastMatch' ? 'text-white' : 'text-gray-500'}`}>LAST MATCH</span>
            {lastGame ? (
              <div className="flex items-center gap-3 font-jersey font-bold text-2xl sm:text-4xl tracking-wide">
                <span className={wonLast ? `text-[${heroColor}] drop-shadow-[0_0_8px_${heroColor}80]` : "text-gray-400"} style={wonLast ? { color: heroColor } : {}}>{lastScoreDisplay.split(' - ')[0]}</span>
                <span className="text-gray-600 text-sm font-sans font-bold uppercase tracking-widest">{isLastHome ? "VS" : "@"} {lastOppAbbr}</span>
                <span className={!wonLast && parseInt(lastScoreDisplay.split(' - ')[0]) < parseInt(lastScoreDisplay.split(' - ')[1]) ? "text-red-500" : "text-gray-400"}>{lastScoreDisplay.split(' - ')[1]}</span>
              </div>
            ) : (
              <span className="font-sans text-xs text-gray-600 font-bold italic">-</span>
            )}
          </button>

          <button 
            onClick={() => { if(nextGame) setActiveTab(activeTab === 'nextMatch' ? null : 'nextMatch') }}
            disabled={!nextGame}
            className={`p-4 sm:p-5 flex flex-col justify-center items-center text-center transition-colors ${!nextGame ? 'cursor-default' : activeTab === 'nextMatch' ? 'bg-white/10' : 'hover:bg-white/5 cursor-pointer'}`}
          >
            <span className={`font-sans text-[10px] sm:text-[11px] font-black uppercase tracking-widest mb-2 flex items-center justify-center gap-1.5 ${isNextLive ? 'text-red-500 animate-pulse' : activeTab === 'nextMatch' ? 'text-white' : 'text-gray-500'}`}>
              {isNextLive ? <><Circle size={10} fill="currentColor" /> LIVE NOW</> : 'NEXT KICKOFF'}
            </span>
            {nextGame ? (
              <div className="font-jersey font-bold text-2xl sm:text-4xl text-white tracking-wide">
                {isNextLive ? (
                  <div className="flex items-center justify-center gap-3">
                    <span className={wonNextLive ? `text-[${heroColor}] drop-shadow-[0_0_8px_${heroColor}80]` : "text-white"} style={wonNextLive ? { color: heroColor } : {}}>{nextScoreDisplay.split(' - ')[0]}</span>
                    <span className="text-gray-600 text-sm font-sans font-bold uppercase tracking-widest">{isNextHome ? "VS" : "@"} {nextOppAbbr}</span>
                    <span className={!wonNextLive && parseInt(nextScoreDisplay.split(' - ')[0]) < parseInt(nextScoreDisplay.split(' - ')[1]) ? "text-red-400" : "text-white"}>{nextScoreDisplay.split(' - ')[1]}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 text-sm font-sans font-bold uppercase tracking-widest">{isNextHome ? "VS" : "@"}</span> 
                      <span>{nextOppAbbr}</span>
                    </div>
                    <span className="block text-[9px] sm:text-[10px] font-sans text-gray-500 font-bold mt-1.5 tracking-widest uppercase">
                      {nextDateStr}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <span className="font-sans text-sm font-black text-gray-600 uppercase tracking-widest">BYE WEEK</span>
            )}
          </button>
          
        </div>
      )}

      {/* CONTEÚDO EXPANDIDO */}
      {activeTab !== null && !isGenericNFL && (
        <div className="relative z-10 bg-[#0a0a0a] border-t-4 animate-fadeIn p-6 sm:p-10 pt-6 sm:pt-8" style={{ borderTopColor: heroColor }}>
          
          <div 
            className="absolute inset-0 z-0 pointer-events-none opacity-[0.15]"
            style={{
              backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 8px)'
            }}
          />

          {activeTab === 'profile' && (
            <div className="flex flex-col gap-8 relative z-10">
              
              {/* O MÓDULO DE ESTATÍSTICAS */}
              {teamId && <TeamStatsViewer teamId={teamId.toString()} teamInfo={teamInfo} />}

              {/* Tabela de Classificação da Divisão */}
              <div className="bg-black/60 border border-white/10 shadow-inner rounded-xl p-4 sm:p-6 flex flex-col overflow-x-auto">
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/10">
                  <span className="font-sans font-black text-sm uppercase tracking-widest text-white">
                    {teamInfo.conference} {teamInfo.division} STANDINGS
                  </span>
                </div>
                
                {loadingStandings ? (
                  <div className="animate-pulse space-y-3">
                     <div className="h-8 bg-white/5 rounded w-full"></div>
                     <div className="h-8 bg-white/5 rounded w-full"></div>
                     <div className="h-8 bg-white/5 rounded w-full"></div>
                  </div>
                ) : (
                  <table className="w-full text-left whitespace-nowrap">
                    <thead>
                      <tr className="font-sans text-gray-500 border-b border-white/10 font-black text-[10px] uppercase tracking-widest">
                        <th className="pb-3">Team</th>
                        <th className="pb-3 text-center w-8">W</th>
                        <th className="pb-3 text-center w-8">L</th>
                        <th className="pb-3 text-center w-8">T</th>
                        <th className="pb-3 text-center w-12 text-white">PCT</th>
                        <th className="pb-3 text-center hidden sm:table-cell">DIV</th>
                        <th className="pb-3 text-center hidden sm:table-cell">CONF</th>
                        <th className="pb-3 text-center hidden lg:table-cell">NON-CONF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {divisionStandings.map((row) => (
                        <tr key={row.id} className={`transition-colors ${row.id.toString() === teamId?.toString() ? 'bg-white/10' : 'hover:bg-white/[0.02]'}`}>
                          <td className="py-3 flex items-center gap-3 pr-2">
                            {row.logo_url && <img src={row.logo_url} className="w-5 h-5 sm:w-6 sm:h-6 object-contain drop-shadow-md" alt={row.abbreviation} />}
                            <span className="font-sport font-bold text-lg sm:text-xl text-white uppercase">{row.name?.split(' ').pop()}</span>
                          </td>
                          <td className="py-3 text-center text-gray-300 font-sport font-bold text-xl">{row.wins || 0}</td>
                          <td className="py-3 text-center text-gray-300 font-sport font-bold text-xl">{row.losses || 0}</td>
                          <td className="py-3 text-center text-gray-300 font-sport font-bold text-xl">{row.ties || 0}</td>
                          <td className="py-3 text-center text-amber-500 font-sport font-bold text-xl drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">{calculatePct(row.wins || 0, row.losses || 0, row.ties || 0).toFixed(3).replace("0.", ".")}</td>
                          <td className="py-3 text-center text-gray-500 font-sans font-bold text-xs hidden sm:table-cell">{row.division_record || "0-0"}</td>
                          <td className="py-3 text-center text-gray-500 font-sans font-bold text-xs hidden sm:table-cell">{row.conference_record || "0-0"}</td>
                          <td className="py-3 text-center text-gray-500 font-sans font-bold text-xs hidden lg:table-cell">{row.non_conference_record || "0-0"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === 'lastMatch' && lastGame && (
            <div className="w-full animate-fadeIn relative z-10">
              {renderGameDetails(lastGame, "LAST MATCH BOX SCORE")}
            </div>
          )}

          {activeTab === 'nextMatch' && nextGame && (
            <div className="w-full animate-fadeIn relative z-10">
              {renderGameDetails(nextGame, isNextLive ? "LIVE MATCH BOX SCORE" : "UPCOMING MATCH PREVIEW")}
            </div>
          )}

        </div>
      )}

    </div>
  );
}