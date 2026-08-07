import React, { useEffect, useState } from 'react';
import { adminService } from '../services/api';
import type { DashboardStats, Alert } from '../types';
import { StatCard } from '../components/StatCard';
import { useAlerts } from '../context/AlertContext';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { 
  CreditCard, ShieldAlert, FileText, AlertCircle, TrendingUp, BellRing
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { wsAlerts } = useAlerts();

  const loadData = async () => {
    try {
      const statsData = await adminService.getStats();
      const alertsData = await adminService.getAlerts(false); // Unresolved
      setStats(statsData);
      setAlerts(alertsData.slice(0, 5)); // Keep top 5
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Refresh stats periodically
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, []);

  const riskColors = ['#10b981', '#34d399', '#f59e0b', '#fbbf24', '#ef4444'];

  return (
    <div className="p-8 space-y-8 flex-1 min-w-0 overflow-y-auto">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Analytical Dashboard</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time insights, network graph correlations, and machine learning scoring flags.
          </p>
        </div>
        <div className="text-xs text-slate-400 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
          <span>Updates automatically every 20s</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
        <StatCard
          title="Total Transactions"
          value={stats?.total_transactions ?? '0'}
          subtext="Volume logged"
          icon={<CreditCard size={18} />}
          isLoading={isLoading}
        />
        <StatCard
          title="Global Fraud Rate"
          value={stats ? `${stats.fraud_rate}%` : '0%'}
          subtext="Risk ratio"
          icon={<ShieldAlert size={18} className="text-rose-400" />}
          trend={{ value: 0.8, isPositive: false }}
          isLoading={isLoading}
        />
        <StatCard
          title="Active Alerts"
          value={(stats?.active_alerts ?? 0) + wsAlerts.length}
          subtext="Requires inspection"
          icon={<AlertCircle size={18} className="text-amber-400" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Pending Appeals"
          value={stats?.pending_appeals ?? '0'}
          subtext="Awaiting review"
          icon={<FileText size={18} />}
          isLoading={isLoading}
        />
        <StatCard
          title="Revenue at Risk"
          value={stats ? `$${stats.revenue_at_risk.toLocaleString()}` : '$0'}
          subtext="Flagged in last 30d"
          icon={<TrendingUp size={18} className="text-rose-400" />}
          isLoading={isLoading}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area Chart */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 shadow-xl border border-slate-800/40">
          <h3 className="text-sm font-semibold tracking-wide uppercase text-slate-400 mb-5">
            Transaction Activity & Fraud Rates (Last 7 Days)
          </h3>
          <div className="h-72">
            {stats && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.monthly_trends}>
                  <defs>
                    <linearGradient id="colorTxs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorFraud" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)' }}
                    labelStyle={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}
                    itemStyle={{ fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="transactions" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTxs)" name="Total Vol" strokeWidth={2} />
                  <Area type="monotone" dataKey="fraud" stroke="#ef4444" fillOpacity={1} fill="url(#colorFraud)" name="Fraud Flags" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Histogram Bar Chart */}
        <div className="glass-panel rounded-2xl p-6 shadow-xl border border-slate-800/40">
          <h3 className="text-sm font-semibold tracking-wide uppercase text-slate-400 mb-5">
            Risk Distribution Curve
          </h3>
          <div className="h-72">
            {stats && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.risk_distribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="range" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)' }}
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    itemStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Score Freq">
                    {stats.risk_distribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={riskColors[index % riskColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Real-time Alerts / Recent Feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Real-Time Live Feed */}
        <div className="glass-panel rounded-2xl p-6 shadow-xl border border-slate-800/40">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-sm font-semibold tracking-wide uppercase text-slate-400 flex items-center gap-2">
              <BellRing size={16} className="text-rose-400 animate-bounce" />
              <span>Real-Time Stream Alerts</span>
            </h3>
            {wsAlerts.length > 0 && (
              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                {wsAlerts.length} new
              </span>
            )}
          </div>

          <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
            {wsAlerts.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-900/10">
                No real-time alerts stream connected yet. Generate transactions to test.
              </div>
            ) : (
              wsAlerts.map(alert => (
                <div key={alert.id} className="p-4 rounded-xl bg-slate-900/60 border border-rose-500/20 flex gap-4 items-start animate-pulse-ring">
                  <div className="p-2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                    <ShieldAlert size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-slate-200">
                        {alert.transaction_code} ({alert.user_email})
                      </span>
                      <span className="text-[9px] text-slate-500 font-semibold font-mono">
                        {new Date(alert.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{alert.message}</p>
                    <div className="mt-2.5 flex items-center gap-4 text-[10px]">
                      <span className="text-slate-500">Amount: <strong className="text-slate-300 font-mono">${alert.amount}</strong></span>
                      <span className="text-slate-500">Risk score: <strong className="text-rose-400">{alert.fraud_score}%</strong></span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Database Static Alerts */}
        <div className="glass-panel rounded-2xl p-6 shadow-xl border border-slate-800/40">
          <h3 className="text-sm font-semibold tracking-wide uppercase text-slate-400 mb-5">
            Database Logged Alerts (Pending Resolution)
          </h3>
          <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
            {alerts.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-900/10">
                All alerts resolved. Good job!
              </div>
            ) : (
              alerts.map(alert => (
                <div key={alert.id} className="p-4 rounded-xl bg-slate-900/45 border border-slate-800 hover:border-slate-700/80 transition-all flex gap-4 items-start">
                  <div className={`p-2 rounded shrink-0 ${
                    alert.severity === 'critical' 
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    <ShieldAlert size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold text-slate-200">
                        {alert.transaction?.transaction_id || 'Alert'}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {new Date(alert.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{alert.message}</p>
                    {alert.transaction && (
                      <div className="mt-2 flex gap-4 text-[10px]">
                        <span className="text-slate-500">Amount: <strong className="text-slate-300">${alert.transaction.amount}</strong></span>
                        <span className="text-slate-500">Risk score: <strong className={alert.transaction.fraud_score >= 70 ? 'text-rose-400' : 'text-amber-400'}>{alert.transaction.fraud_score}%</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default Dashboard;
