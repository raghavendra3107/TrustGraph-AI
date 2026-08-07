import React, { type ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  isLoading?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtext,
  icon,
  trend,
  isLoading = false
}) => {
  return (
    <div className="glass-card rounded-xl p-5 relative overflow-hidden transition-all duration-300 hover:border-slate-700/60 hover:-translate-y-0.5">
      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-slate-800 rounded w-1/3"></div>
          <div className="h-8 bg-slate-800 rounded w-2/3"></div>
          <div className="h-4 bg-slate-800 rounded w-1/2"></div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                {title}
              </p>
              <h3 className="text-2xl font-bold text-slate-100 mt-2 font-mono">
                {value}
              </h3>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/35 text-slate-300">
              {icon}
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-4">
            {subtext && (
              <span className="text-[11px] text-slate-400">
                {subtext}
              </span>
            )}
            
            {trend && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                trend.isPositive 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
            )}
          </div>
          
          {/* Subtle bottom gradient glow */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
        </>
      )}
    </div>
  );
};
export default StatCard;
