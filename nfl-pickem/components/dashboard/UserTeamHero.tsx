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

export default function UserTeamHero({ teamId, score, lastGame, nextGame, teamsDataMap }: UserTeamHeroProps) {
  const [teamInfo, setTeamInfo] = useState<any>(null);
  const [teamRecord, setTeamRecord] = useState<string>("0-0-0");
  
  const [seasonLeaders, setSeasonLeaders] = useState<any[]>([]);
  const [loadingLeaders, setLoadingLeaders] = useState<boolean>(true);

  useEffect(() => {
    async function fetchTeamAndStandings() {
      if (!teamId) return;
      const supabase = createClient();
      
      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();
        
      if (teamData) setTeamInfo(teamData);

      const { data: stdData } = await supabase
        .from('standings')
        .select('wins, losses, ties')
        .eq('team_id', teamId)
        .single();
        
      if (stdData) {
        setTeamRecord(`${stdData.wins}-${stdData.losses}-${stdData.ties}`);
      }
      
      if (teamData && teamData.abbreviation && teamData.abbreviation !== 'NFL') {
        try {
          const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamData.abbreviation.toLowerCase()}`);
          if (res.ok) {
            const espnData = await res.json();
            const stats = espnData?.team?.record?.items?.[0]?.stats;
            
            if (stats && Array.isArray(stats) && stats.length > 0) {
              const passing = stats.find((s: any) => s.name === 'passingYards');
              const rushing = stats.find((s: any) => s.name === 'rushingYards');
              const receiving = stats.find((s: any) => s.name === 'receivingYards');

              // Nomes mais descritivos e tipos de jardas cravados
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
          console.error("Erro ao buscar stats da ESPN", error);
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

  let wonLast = false;
  let lastOppAbbr = "OPP";
  let lastScoreDisplay = "";
  if (lastGame && teamsDataMap) {
    const isHome = lastGame.home_team_id?.toString() === teamId?.toString();
    const oppId = isHome ? lastGame.away_team_id : lastGame.home_team_id;
    lastOppAbbr = teamsDataMap[oppId?.toString()]?.abbr || "OPP";
    const myScore = isHome ? lastGame.home_score : lastGame.away_score;
    const oppScore = isHome ? lastGame.away_score : lastGame.home_score;
    wonLast = myScore > oppScore;
    lastScoreDisplay = `${myScore} - ${oppScore}`;
  }

  let nextOppAbbr = "OPP";
  let nextDateStr = "";
  let isNextHome = false;
  if (nextGame && teamsDataMap) {
    isNextHome = nextGame.home_team_id?.toString() === teamId?.toString();
    const oppId = isNextHome ? nextGame.away_team_id : nextGame.home_team_id;
    nextOppAbbr = teamsDataMap[oppId?.toString()]?.abbr || "OPP";
    nextDateStr = new Date(nextGame.game_time).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl group flex flex-col bg-neutral-950">
      
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
      
      <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between p-6 sm:p-10">
        
        <div className="flex items-center gap-4 sm:gap-6 w-full md:w-auto">
          {teamInfo.logo_url ? (
            <div className="w-16 h-16 sm:w-28 sm:h-28 bg-black/40 p-3 sm:p-4 rounded-full border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-md shrink-0">
              <img src={teamInfo.logo_url} alt={teamInfo.name} className="w-full h-full object-contain drop-shadow-xl" />
            </div>
          ) : (
            <div className="w-16 h-16 sm:w-28 sm:h-28 bg-black/30 rounded-full border border-white/10 shrink-0" />
          )}
          
          <div className="flex flex-col">
            <h1 className="text-xl sm:text-4xl font-black italic uppercase tracking-widest text-white drop-shadow-md leading-none mb-1">
              {teamInfo.name}
            </h1>
            {!isGenericNFL ? (
              <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest leading-none">
                {teamRecord} • Locker Room
              </p>
            ) : (
              <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest leading-none">
                Global Locker Room
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-start md:items-end w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t border-white/10 md:border-t-0">
            
            <div className="flex flex-col items-start md:items-end mb-4">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-500">Total Points</span>
                <span 
                className="text-4xl sm:text-6xl font-black italic tracking-tighter text-white leading-none mt-1" 
                style={{ textShadow: `0 0 25px ${teamInfo.primary_color}` }}
                >
                {score}
                </span>
            </div>

            {!isGenericNFL && seasonLeaders.length > 0 && (
                <div className="w-full md:w-64 bg-black/40 border border-white/10 rounded-lg p-3">
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-2 text-center md:text-right">Season Totals</span>
                    {loadingLeaders ? (
                        <div className="animate-pulse space-y-2">
                             <div className="h-3 bg-white/5 rounded w-full"></div>
                             <div className="h-3 bg-white/5 rounded w-full"></div>
                             <div className="h-3 bg-white/5 rounded w-full"></div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1.5">
                            {seasonLeaders.map((leader, i) => (
                                <div key={i} className="flex justify-between items-center text-[9px] sm:text-[10px]">
                                    <span className="text-gray-400 uppercase font-bold tracking-widest">{leader.category}: <span className="text-white normal-case font-medium tracking-normal">{leader.name}</span></span>
                                    <span className="text-white font-black">{leader.stat}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>

      {(!isGenericNFL && (lastGame || nextGame)) && (
        <div className="relative z-10 bg-black/50 border-t border-white/10 backdrop-blur-xl grid grid-cols-2 divide-x divide-white/10">
          
          <div className="p-3 sm:p-4 flex flex-col justify-center items-center text-center">
            <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Last Match</span>
            {lastGame ? (
              <div className="flex items-center gap-2 font-black text-sm sm:text-base">
                <span className={wonLast ? "text-green-500" : "text-gray-400"}>{lastScoreDisplay.split(' - ')[0]}</span>
                <span className="text-gray-500 text-xs font-bold px-1">{lastGame.home_team_id?.toString() === teamId?.toString() ? "vs" : "@"} {lastOppAbbr}</span>
                <span className={!wonLast && parseInt(lastScoreDisplay.split(' - ')[0]) < parseInt(lastScoreDisplay.split(' - ')[1]) ? "text-red-500" : "text-gray-400"}>{lastScoreDisplay.split(' - ')[1]}</span>
              </div>
            ) : (
              <span className="text-xs text-gray-600 font-bold italic">-</span>
            )}
          </div>

          <div className="p-3 sm:p-4 flex flex-col justify-center items-center text-center">
            <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Next Kickoff</span>
            {nextGame ? (
              <div className="font-black text-sm sm:text-base text-white">
                {isNextHome ? "vs" : "@"} {nextOppAbbr}
                <span className="block text-[9px] sm:text-[10px] text-gray-400 font-bold mt-0.5">
                  {nextDateStr}
                </span>
              </div>
            ) : (
              <span className="text-xs text-gray-600 font-bold italic">-</span>
            )}
          </div>
          
        </div>
      )}
    </div>
  );
}