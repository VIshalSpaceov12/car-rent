import { createContext, useContext } from 'react';
import { defaultTheme, type Theme } from './theme';

export const ThemeContext = createContext<Theme>(defaultTheme);
export const useTheme = (): Theme => useContext(ThemeContext);
