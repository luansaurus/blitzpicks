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

// Palpites de todos os usuários. Os placares de outros usuários só vêm reais a partir de
// 10 min antes do jogo (ou sempre, para VIP/admin). Antes disso vêm "mascarados" (1x0, 0x1
// ou 0x0), mantendo apenas o lado escolhido. Ver supabase get_masked_guesses().
export async function getGuesses(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.rpc('get_masked_guesses');
  if (error) throw error;
  return data || [];
}