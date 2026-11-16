import { useTheme } from '../theme/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" className="btn btn-outlined theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle light/dark theme">
      {theme === 'dark' ? '🌙 DARK' : '☀️ LIGHT'}
    </button>
  );
}
