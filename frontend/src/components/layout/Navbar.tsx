import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { logout } from '../../store/auth';
import { Activity, BarChart2, Bot, BookOpen, LogOut, ShieldAlert } from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';

const LINKS = [
  { to: '/dashboard', label: 'Simulate', icon: BarChart2 },
  { to: '/compare', label: 'Compare', icon: Activity },
  { to: '/risk', label: 'Risk', icon: ShieldAlert },
  { to: '/agent', label: 'Agent', icon: Bot },
  { to: '/scenarios', label: 'Saved', icon: BookOpen },
];

/**
 * The active tab is marked with a rule along the bar's own bottom edge rather
 * than a filled pill. On a dark surface a filled pill is the loudest element
 * in the chrome, and navigation should never outrank the numbers.
 */
export function Navbar() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/90 backdrop-blur-md">
      <div className="max-w-[92rem] mx-auto px-4 sm:px-6 h-14 flex items-center gap-6">
        <Link
          to="/"
          className="flex items-center gap-2 text-gray-50 font-bold tracking-tight shrink-0"
        >
          <span
            className="w-5 h-5 rounded flex items-center justify-center text-[0.625rem] font-bold
                       bg-[var(--color-accent)] text-gray-950"
            aria-hidden
          >
            IQ
          </span>
          <span className="hidden sm:inline text-[0.9375rem]">InvestIQ</span>
        </Link>

        {isAuthenticated && (
          <div className="flex items-center gap-0.5 -mb-px overflow-x-auto">
            {LINKS.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-1.5 px-3 h-14 text-[0.8125rem] font-medium
                              border-b-2 transition-colors whitespace-nowrap ${
                                active
                                  ? 'text-gray-50 border-[var(--color-accent)]'
                                  : 'text-gray-500 border-transparent hover:text-gray-200'
                              }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-1 ml-auto shrink-0">
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              <span className="hidden sm:inline mono text-xs text-gray-500 px-2">
                {user?.username}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-gray-500
                           hover:text-gray-100 hover:bg-gray-800 transition-colors"
                aria-label="Log out"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="px-3 py-1.5 text-[0.8125rem] text-gray-400 hover:text-gray-100 transition-colors"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="px-3 py-1.5 text-[0.8125rem] font-semibold rounded-md
                           bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]
                           text-gray-950 transition-colors"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
