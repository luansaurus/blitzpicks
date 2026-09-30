import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

export async function getTeams(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.from('teams')
    .select('id, name, abbreviation, logo_url, primary_color, secondary_color');
  if (error) throw error;
  return data || [];
}

export async function getValidProfiles(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.from('profiles')
    .select('id, nickname, score, global_titles, is_test, favorite_team_id, teams(logo_url, abbreviation)')
    .eq('is_test', false);
  if (error) throw error;
  return data || [];
}

export async function getGames(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.from('games')
    .select('id, home_team_id, away_team_id, status, week, game_time, home_score, away_score, meta_data, broadcast_tag, clock')
    .order('game_time', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getGuesses(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.from('guesses')
    .select('id, user_id, game_id, home_guess, away_guess');
  if (error) throw error;
  return data || [];
}