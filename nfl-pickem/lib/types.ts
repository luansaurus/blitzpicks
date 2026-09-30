import { Database } from './database.types';

export type Team = Database['public']['Tables']['teams']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Game = Database['public']['Tables']['games']['Row'];
export type Guess = Database['public']['Tables']['guesses']['Row'];
export type Standing = Database['public']['Tables']['standings']['Row'];
export type League = Database['public']['Tables']['leagues']['Row'];
export type LeagueMember = Database['public']['Tables']['league_members']['Row'];
export type Championship = Database['public']['Tables']['championships']['Row'];
export type Stadium = Database['public']['Tables']['stadium']['Row'];
export type UserBracket = Database['public']['Tables']['user_brackets']['Row'];

// Tipos auxiliares para consultas que usam JOIN
export type GameWithStadium = Game & { stadium?: Pick<Stadium, 'name' | 'city'> | null };
export type ProfileWithTeam = Profile & { teams?: Pick<Team, 'logo_url' | 'abbreviation'> | null };