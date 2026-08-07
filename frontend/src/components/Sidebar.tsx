import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAlerts } from '../context/AlertContext';
import { 
  LayoutDashboard, ShieldAlert, FileText, Settings, LogOut, Terminal, Activity 
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const { wsAlerts, connectionStatus } = useAlerts();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} />, roles: ['admin', 'analyst', 'merchant'] },
    { to: '/transactions', label: 'Fraud Detection', icon: <ShieldAlert size={18} />, roles: ['admin', 'analyst', 'merchant'] },
    { to: '/appeals', label: 'Appeals', icon: <FileText size={18} />, roles: ['admin', 'analyst', 'merchant'] },
    { to: '/admin', label: 'Admin panel', icon: <Settings size={18} />, roles: ['admin'] },
  ];

  const allowedNavItems = navItems.filter(item => user && item.roles.includes(user.role));

  return (
    <aside className="w-64 glass-panel border-r border-slate-800/80 flex flex-col justify-between h-screen sticky top-0">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/10">
            <Terminal size={22} className="animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold tracking-tight text-slate-100 text-lg leading-tight">
              TrustGraph <span className="text-blue-500">AI</span>
            </h1>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              Fraud Guard System
            </span>
          </div>
        </div>

        <div className="mb-4">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-3">
            Realtime Channel
          </span>
          <div className="flex items-center gap-2 px-3 py-2 rounded bg-slate-900/60 border border-slate-800 text-xs">
            <Activity size={12} className={connectionStatus === 'connected' ? 'text-emerald-500 animate-pulse' : 'text-rose-500'} />
            <span className="text-slate-300">Live Agent:</span>
            <span className={`font-semibold capitalize ${
              connectionStatus === 'connected' ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {connectionStatus}
            </span>
          </div>
        </div>

        <nav className="space-y-1">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-3 mt-6">
            Menu Navigation
          </span>
          {allowedNavItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `
                flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
                ${isActive 
                  ? 'bg-blue-600/15 text-blue-400 border-l-[3px] border-blue-500 pl-3.5 glass-panel' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border-l-[3px] border-transparent'
                }
              `}
            >
              <div className="flex items-center gap-3.5">
                {item.icon}
                <span>{item.label}</span>
              </div>
              
              {item.to === '/transactions' && wsAlerts.length > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-bounce">
                  {wsAlerts.length}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="p-6 border-t border-slate-800/60 bg-slate-950/40">
        {user && (
          <div className="flex items-center gap-3.5 mb-5">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700 font-bold text-blue-400 uppercase">
              {user.email.substring(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">
                {user.full_name || user.email}
              </p>
              <span className="inline-block mt-1 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {user.role}
              </span>
            </div>
          </div>
        )}
        
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg border border-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-500/5 hover:border-rose-500/20 text-xs font-semibold tracking-wide transition-all duration-200"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
export default Sidebar;
