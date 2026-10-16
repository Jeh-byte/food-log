import { useColorScheme } from 'react-native';
import type { FoodColour } from './nutrition';

const light = {
  bg: '#F4F4F2',
  surface: '#FCFCFB',
  surface2: '#ECEBE8',
  text: '#0B0B0B',
  text2: '#52514E',
  muted: '#8A8984',
  border: '#E0DFDB',
  accent: '#2A78D6',
  onAccent: '#FFFFFF',
  protein: '#EB6834',
  carbs: '#1BAF7A',
  fat: '#6250D6',
  over: '#E34948',
  danger: '#C23A39',
  star: '#EDA100',
  food: { green: '#1BAF7A', yellow: '#EDA100', orange: '#EB6834' } as Record<FoodColour, string>,
};

const dark: typeof light = {
  bg: '#111110',
  surface: '#1A1A19',
  surface2: '#262624',
  text: '#F0EFEC',
  text2: '#C3C2B7',
  muted: '#8F8E88',
  border: '#2F2F2D',
  accent: '#3987E5',
  onAccent: '#FFFFFF',
  protein: '#D95926',
  carbs: '#199E70',
  fat: '#9085E9',
  over: '#E66767',
  danger: '#E66767',
  star: '#C98500',
  food: { green: '#199E70', yellow: '#C98500', orange: '#D95926' },
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
