"use client";

import { useEffect, useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import GameCard from '../scoreboard/GameCard';

interface WeekPicksProps {
  teamId: number | string;
  primaryColor: string;
}

export default function WeekPicks({ teamId, primaryColor }: WeekPicksProps) {
  const [games, setGames] = useState<any[]>([]);
  const [teamsDataMap, setTeamsDataMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadWeekGames() {
      // Carrega o logo_url do banco
      const { data: teams } = await supabase.from('teams').select('id, name, abbreviation, primary_color, logo_url');
      const tMap: Record<string, any> = {};
      teams?.forEach(t => {
        tMap[t.id] = { name: t.name, abbr: t.abbreviation, color: t.primary_color, logo: t.logo_url };
      });
      setTeamsDataMap(tMap);

      const { data } = await supabase
        .from('games')
        .select('*')
        .order('game_time', { ascending: true });

      if (data) setGames(data);
      setLoading(false);
    }
    loadWeekGames();
  }, [supabase]);

  if (loading) return <div className="text-gray-500 text-center py-4">Loading schedule...</div>;

  return (
    <section className="bg-neutral-900/40 border border-white/5 rounded-2xl p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white uppercase tracking-widest">Week Picks</h2>
          <p className="text-gray-400 text-sm mt-1">Predict the exact scores to lock your weekly picks.</p>
        </div>
        <button className="text-sm font-bold uppercase tracking-widest transition hover:opacity-80" style={{ color: primaryColor }}>
          Full Schedule &rarr;
        </button>
      </div>

      <div className="grid gap-6">
        {games.map((game) => (
          <GameCard 
            key={game.id} 
            game={game} 
            userTeamColor={primaryColor} 
            homeTeam={teamsDataMap[game.home_team_id] || { name: 'Home', abbr: 'HOME', color: '#171717' }}
            awayTeam={teamsDataMap[game.away_team_id] || { name: 'Away', abbr: 'AWAY', color: '#171717' }}
          />
        ))}
      </div>
    </section>
  );
}