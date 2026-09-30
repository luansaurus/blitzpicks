import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getPickResult } from '@/lib/scoring';
import type { League, Game, Profile, Guess } from '@/lib/types';

export function useLeagues(currentUserId: string) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  
  const [allLeagues, setAllLeagues] = useState<League[]>([]);
  const [myLeagues, setMyLeagues] = useState<League[]>([]);
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);
  
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allGuesses, setAllGuesses] = useState<Guess[]>([]);
  const [gamesMap, setGamesMap] = useState<Record<string, Game>>({});
  const [gamesByWeek, setGamesByWeek] = useState<Record<string, Game[]>>({});
  const [teamsMap, setTeamsMap] = useState<Record<string, any>>({});
  const [leagueMembersMap, setLeagueMembersMap] = useState<Record<string, string[]>>({});
  const [championships, setChampionships] = useState<any[]>([]);
  const [displayedLeaderboard, setDisplayedLeaderboard] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: teams }, { data: games }] = await Promise.all([
      supabase.from('teams').select('*'),
      supabase.from('games').select('*').order('game_time', { ascending: true })
    ]);

    const tMap: Record<string, any> = {};
    teams?.forEach(t => { tMap[t.id.toString()] = { name: t.name, abbr: t.abbreviation, logo: t.logo_url }; });
    setTeamsMap(tMap);

    const gMap: Record<string, Game> = {};
    const groupedGames: Record<string, Game[]> = {};
    games?.forEach(g => {
      gMap[g.id.toString()] = g as Game;
      let w = g.week || '1';
      if (!groupedGames[w]) groupedGames[w] = [];
      groupedGames[w].push(g as Game);
    });
    setGamesMap(gMap);
    setGamesByWeek(groupedGames);

    const [{ data: leagues }, { data: members }, { data: users }, { data: guesses }, { data: champs }] = await Promise.all([
      supabase.from('leagues').select('*').order('created_at', { ascending: false }),
      supabase.from('league_members').select('*'),
      supabase.from('profiles').select('id, nickname, score, global_titles, is_test, teams ( logo_url, abbreviation )'),
      supabase.from('guesses').select('*'),
      supabase.from('championships').select('*')
    ]);

    setAllLeagues((leagues as League[]) || []);
    setAllUsers((users || []).filter(u => !u.is_test));
    setAllGuesses((guesses as Guess[]) || []);
    setChampionships(champs || []);

    const lMap: Record<string, string[]> = {};
    const myTempLeagues: League[] = [];
    
    members?.forEach((m: any) => {
      if (!lMap[m.league_id]) lMap[m.league_id] = [];
      lMap[m.league_id].push(m.user_id);
      
      if (m.user_id === currentUserId && leagues) {
        const found = leagues.find(l => l.id === m.league_id);
        if (found) myTempLeagues.push(found as League);
      }
    });

    setLeagueMembersMap(lMap);
    setMyLeagues(myTempLeagues);
    if (myTempLeagues.length > 0 && !activeLeagueId) setActiveLeagueId(myTempLeagues[0].id);

    setLoading(false);
  };

  useEffect(() => { loadData(); }, [currentUserId]);

  useEffect(() => {
    if (!activeLeagueId) {
      setDisplayedLeaderboard([]);
      return;
    }

    const selectedLeague = myLeagues.find(l => l.id === activeLeagueId);
    const rules = {
      exact: selectedLeague?.pts_exact ?? 7,
      diff: selectedLeague?.pts_diff ?? 5,
      winner: selectedLeague?.pts_winner ?? 3
    };

    const validMemberIds = leagueMembersMap[activeLeagueId] || [];
    const membersData = allUsers.filter(u => validMemberIds.includes(u.id));
    
    const recalculatedLeaderboard = membersData.map((user) => {
      let officialScore = 0;
      let projectedPoints = 0;

      const userGuesses = allGuesses.filter(g => g.user_id === user.id);
      userGuesses.forEach(guess => {
        const game = gamesMap[guess.game_id];
        const res = getPickResult(game, guess, rules);
        if (game?.status === 'finished') officialScore += res.points;
        else if (game?.status === 'in_progress') projectedPoints += res.points;
      });

      return { ...user, officialScore, projectedPoints, totalScore: officialScore + projectedPoints };
    });

    recalculatedLeaderboard.sort((a, b) => b.totalScore - a.totalScore);
    setDisplayedLeaderboard(recalculatedLeaderboard);
  }, [activeLeagueId, myLeagues, leagueMembersMap, allUsers, allGuesses, gamesMap]);

  return {
    loading, allLeagues, myLeagues, activeLeagueId, setActiveLeagueId,
    allUsers, allGuesses, gamesMap, gamesByWeek, teamsMap, leagueMembersMap, championships,
    displayedLeaderboard, reloadLeagues: loadData
  };
}