import { createContext, useContext } from 'react';

export const THEME_KEY = 'nexus-theme';
export const ThemeContext = createContext({
  preference: 'light', theme: 'light', setPreference: () => {}, toggle: () => {},
});
export const useTheme = () => useContext(ThemeContext);
