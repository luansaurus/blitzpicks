import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    // Se a sua pasta app não estiver dentro de src, use a linha abaixo e apague as de cima:
    // "./app/**/*.{js,ts,jsx,tsx,mdx}",
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
      }
    },
  },
  plugins: [],
};
export default config;