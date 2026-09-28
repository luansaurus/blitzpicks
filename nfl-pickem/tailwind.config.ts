import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        nfl: {
          blue: '#003399', 
          red: '#FF0000',  
          black: '#000000',
          gray: '#999999', 
          light: '#CCCCCC' 
        }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Arial', 'sans-serif'], 
        sport: ['var(--font-oswald)', 'Impact', 'sans-serif'],
        // Lendo diretamente a fonte Graduate que importamos no CSS:
        jersey: ['"Graduate"', 'Impact', 'serif'], 
      }
    },
  },
  plugins: [],
};
export default config;