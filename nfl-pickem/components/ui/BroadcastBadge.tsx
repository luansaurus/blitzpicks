"use client";

export default function BroadcastBadge({ tag }: { tag: string | null }) {
  if (!tag) return null;

  let styles = "";
  let label = tag;
  let icon = "";

  switch (tag.toUpperCase()) {
    case 'TNF':
      // Estilo Prime Video: Azul escuro com ciano neon
      styles = "bg-gradient-to-r from-blue-950 to-cyan-950 text-cyan-400 border-cyan-500/30";
      label = "Thursday Night";
      icon = "🌙";
      break;
    case 'SNF':
      // Estilo NBC: Dourado vivo, texto preto, com brilho
      styles = "bg-gradient-to-r from-yellow-500 to-amber-500 text-black border-yellow-300 shadow-[0_0_10px_rgba(245,158,11,0.3)] font-extrabold";
      label = "Sunday Night";
      icon = "⭐";
      break;
    case 'MNF':
      // Estilo ESPN: Vermelho sangue e preto
      styles = "bg-gradient-to-r from-red-950 to-black text-red-500 border-red-600/30";
      label = "Monday Night";
      icon = "🔥";
      break;
    case 'INT':
      // Estilo Global: Verde esmeralda terroso
      styles = "bg-gradient-to-r from-emerald-950 to-teal-950 text-emerald-400 border-emerald-500/30";
      label = "International";
      icon = "✈️";
      break;
    case 'THX':
      // Estilo Ação de Graças: Tons de outono/peru
      styles = "bg-gradient-to-r from-orange-950 to-amber-950 text-orange-400 border-orange-500/30";
      label = "Thanksgiving";
      icon = "🦃";
      break;
    case 'BLK':
      // Estilo Black Friday: Todo preto, borda neon discreta
      styles = "bg-black text-white border-neutral-600 shadow-inner";
      label = "Black Friday";
      icon = "🛒";
      break;
    case 'XMAS':
      // Estilo Natal: Mistura de vermelho escuro com borda verde
      styles = "bg-gradient-to-r from-red-950 to-red-900 text-white border-green-500/50";
      label = "Christmas Special";
      icon = "🎄";
      break;
    case 'SAT':
      // Estilo NFL Network: Roxo escuro institucional
      styles = "bg-gradient-to-r from-indigo-950 to-purple-950 text-purple-300 border-purple-500/30";
      label = "Saturday Game";
      icon = "🏈";
      break;
    default:
      // Fallback genérico caso apareça alguma tag nova não mapeada
      styles = "bg-neutral-900 text-neutral-400 border-neutral-700";
      label = tag;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border transition-all ${styles}`}>
      {icon && <span className="textxs">{icon}</span>}
      {label}
    </span>
  );
}