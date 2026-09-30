import { useEffect, useState } from 'react';
import { getBestColor } from '@/lib/color';
import type { Team } from '../lib/types';

export function useTeamTheme(initialTeamId?: number | null, teams?: Team[]) {
  const [userColor, setUserColor] = useState<string>('#E31837');
  const [ambientPrimary, setAmbientPrimary] = useState<string>('#013369');
  const [ambientSecondary, setAmbientSecondary] = useState<string>('#E31837');

  // Inicializa o tema baseado no time ou no cache local
  useEffect(() => {
    if (initialTeamId && teams && teams.length > 0) {
      const team = teams.find(t => t.id === initialTeamId);
      if (team) {
        const pri = team.primary_color || '#013369';
        const sec = team.secondary_color || '#E31837';
        setAmbientPrimary(pri);
        setAmbientSecondary(sec);
        setUserColor(getBestColor(pri, sec));
        return;
      }
    }
    
    if (typeof window !== 'undefined') {
      setUserColor(localStorage.getItem('blitz_accent') || '#E31837');
      setAmbientPrimary(localStorage.getItem('blitz_header_bg') || '#013369');
      setAmbientSecondary(localStorage.getItem('blitz_header_sec') || '#E31837');
    }
  }, [initialTeamId, teams]);

  // Função para forçar a troca do tema em tempo real (ex: ao clicar na tela de Setup)
  const updateTheme = (team: Partial<Team>) => {
    const pri = team.primary_color || '#013369';
    const sec = team.secondary_color || '#E31837';
    setAmbientPrimary(pri);
    setAmbientSecondary(sec);
    setUserColor(getBestColor(pri, sec));
  };

  return { userColor, ambientPrimary, ambientSecondary, updateTheme };
}