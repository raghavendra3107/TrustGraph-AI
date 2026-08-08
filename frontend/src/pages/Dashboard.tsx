import React, { useEffect, useState } from 'react';
import { adminService, transactionService } from '../services/api';
import type { DashboardStats, Alert, Transaction } from '../types';
import { StatCard } from '../components/StatCard';
import { useAlerts } from '../context/AlertContext';
import { useAuth } from '../context/AuthContext';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { 
  CreditCard, ShieldAlert, FileText, AlertCircle, TrendingUp, BellRing, CheckCircle, XCircle, AlertTriangle,
  Store, ShoppingBag, Package, Clock, Sparkles
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [recentOrders, setRecentOrders] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { wsAlerts } = useAlerts();

  const isMerchant = user?.role === 'merchant';

  const loadData = async () => {
    try {
      const statsData = await adminService.getStats();
      const alertsData = await adminService.getAlerts(false); // Unresolved alerts
      setStats(statsData);
      setAlerts(alertsData.slice(0, 5));

      if (isMerchant) {
        const txs = await transactionService.getAll();
        setRecentOrders(txs.slice(0, 8));
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, [user]);

  const riskColors = ['#10b981', '#34d399', '#f59e0b', '#fbbf24', '#ef4444'];

  // ----------------------------------------------------
  // MERCHANT DASHBOARD
  // ----------------------------------------------------
  if (isMerchant) {
    return (
      <div className="p-8 space-y-8 flex-1 min-w-0 overflow-y-auto">
        {/* Merchant Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 glass-panel p-6 rounded-2xl border border-slate-800/80">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight">
                {user?.seller_name || 'Merchant'} Dashboard
              </h2>
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Store size={12} />
                MERCHANT
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Monitor your orders, fraud reviews, and merchant performance.
            </p>
            <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                Store: <strong className="text-slate-200 font-semibold">{user?.seller_name || 'Merchant Store'}</strong>
              </span>
              <span className="text-slate-700">|</span>
              <span className="flex items-center gap-1">
                Seller ID: <strong className="text-blue-400 font-mono font-semibold">{user?.seller_id}</strong>
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-400 bg-slate-900/80 border border-slate-800 px-3.5 py-2 rounded-xl flex items-center gap-2 self-start sm:self-auto shrink-0 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Store Live Monitor (20s sync)</span>
          </div>
        </div>

        {/* Merchant KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
          <StatCard
            title="TOTAL ORDERS"
            value={stats?.total_transactions ?? '0'}
            subtext="My store volume"
            icon={<ShoppingBag size={18} className="text-blue-400" />}
            isLoading={isLoading}
          />
          <StatCard
            title="APPROVED ORDERS"
            value={stats?.approved_transactions ?? '0'}
            subtext="Successful sales"
            icon={<CheckCircle size={18} className="text-emerald-400" />}
            isLoading={isLoading}
          />
          <StatCard
            title="BLOCKED ORDERS"
            value={stats?.blocked_transactions ?? '0'}
            subtext="Prevented fraud"
            icon={<XCircle size={18} className="text-rose-400" />}
            isLoading={isLoading}
          />
          <StatCard
            title="PENDING REVIEWS"
            value={stats?.pending_reviews ?? '0'}
            subtext="Awaiting decision"
            icon={<AlertTriangle size={18} className="text-amber-400" />}
            isLoading={isLoading}
          />
          <StatCard
            title="FLAGGED ORDERS"
            value={stats?.flagged_transactions ?? '0'}
            subtext="Suspicious orders"
            icon={<ShieldAlert size={18} className="text-rose-400" />}
            isLoading={isLoading}
          />
          <StatCard
            title="APPROVAL RATE"
            value={stats ? (typeof stats.approval_rate === 'number' && !isNaN(stats.approval_rate) ? `${stats.approval_rate.toFixed(2)}%` : (stats.total_transactions > 0 ? `${((stats.approved_transactions / stats.total_transactions) * 100).toFixed(2)}%` : '0.00%')) : '0.00%'}
            subtext="Order completion %"
            icon={<Sparkles size={18} className="text-emerald-400" />}
            isLoading={isLoading}
          />
          <StatCard
            title="FRAUD RATE"
            value={stats ? (typeof stats.fraud_rate === 'number' && !isNaN(stats.fraud_rate) ? `${stats.fraud_rate.toFixed(2)}%` : '0.00%') : '0.00%'}
            subtext="Risk ratio"
            icon={<ShieldAlert size={18} className="text-amber-400" />}
            isLoading={isLoading}
          />
          <StatCard
            title="REVENUE AT RISK"
            value={stats ? `$${(stats.revenue_at_risk || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'}
            subtext="Flagged in last 30d"
            icon={<TrendingUp size={18} className="text-rose-400" />}
            isLoading={isLoading}
          />
        </div>

        {/* Merchant Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Activity - Last 7 Days */}
          <div className="lg:col-span-2 glass-panel rounded-2xl p-6 shadow-xl border border-slate-800/40">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-sm font-bold tracking-wide uppercase text-slate-300">
                ORDER ACTIVITY - LAST 7 DAYS
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">Store Scope</span>
            </div>
            <div className="h-72">
              {stats && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.monthly_trends}>
                    <defs>
                      <linearGradient id="colorStoreTxs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorStoreApp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
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
                    <Area type="monotone" dataKey="transactions" stroke="#3b82f6" fillOpacity={1} fill="url(#colorStoreTxs)" name="Total Orders" strokeWidth={2} />
                    <Area type="monotone" dataKey="approved" stroke="#10b981" fillOpacity={1} fill="url(#colorStoreApp)" name="Approved Orders" strokeWidth={2} />
                    <Area type="monotone" dataKey="flagged" stroke="#f59e0b" strokeWidth={2} name="Flagged Orders" fill="none" />
                    <Area type="monotone" dataKey="blocked" stroke="#ef4444" strokeWidth={2} name="Blocked Orders" fill="none" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Store Risk Distribution */}
          <div className="glass-panel rounded-2xl p-6 shadow-xl border border-slate-800/40">
            <h3 className="text-sm font-bold tracking-wide uppercase text-slate-300 mb-5">
              MY STORE RISK DISTRIBUTION
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
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Orders Count">
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

        {/* Product Performance & Fraud Review Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product Performance Table */}
          <div className="lg:col-span-2 glass-panel rounded-2xl p-6 shadow-xl border border-slate-800/40">
            <h3 className="text-sm font-bold tracking-wide uppercase text-slate-300 mb-5 flex items-center gap-2">
              <Package size={16} className="text-blue-400" />
              <span>PRODUCT PERFORMANCE</span>
            </h3>

            {stats?.product_performance && stats.product_performance.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3 text-right">Orders</th>
                      <th className="py-2.5 px-3 text-right">Approved</th>
                      <th className="py-2.5 px-3 text-right">Flagged</th>
                      <th className="py-2.5 px-3 text-right">Blocked</th>
                      <th className="py-2.5 px-3 text-right">Fraud Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {stats.product_performance.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-3 px-3 font-semibold text-slate-200 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          {item.product}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-300">{item.orders}</td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-400 font-semibold">{item.approved}</td>
                        <td className="py-3 px-3 text-right font-mono text-amber-400">{item.flagged}</td>
                        <td className="py-3 px-3 text-right font-mono text-rose-400">{item.blocked}</td>
                        <td className="py-3 px-3 text-right font-mono">
                          <span className={`px-2 py-0.5 rounded font-bold ${item.fraud_rate > 15 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-slate-800 text-slate-300'}`}>
                            {item.fraud_rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-900/10">
                No product performance data logged yet.
              </div>
            )}
          </div>

          {/* Fraud Review Summary */}
          <div className="glass-panel rounded-2xl p-6 shadow-xl border border-slate-800/40">
            <h3 className="text-sm font-bold tracking-wide uppercase text-slate-300 mb-5 flex items-center gap-2">
              <FileText size={16} className="text-amber-400" />
              <span>FRAUD REVIEW SUMMARY</span>
            </h3>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                <span className="text-xs text-slate-400 font-medium">Pending Analyst Reviews</span>
                <span className="text-sm font-bold text-amber-400 font-mono">
                  {stats?.fraud_review_summary?.pending_analyst_reviews ?? 0}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                <span className="text-xs text-slate-400 font-medium">Analyst Recommended Approval</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">
                  {stats?.fraud_review_summary?.analyst_recommended_approval ?? 0}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                <span className="text-xs text-slate-400 font-medium">Analyst Recommended Rejection</span>
                <span className="text-sm font-bold text-rose-400 font-mono">
                  {stats?.fraud_review_summary?.analyst_recommended_rejection ?? 0}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                <span className="text-xs text-slate-400 font-medium">Merchant Decisions Completed</span>
                <span className="text-sm font-bold text-blue-400 font-mono">
                  {stats?.fraud_review_summary?.merchant_decisions_completed ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Orders & My Store Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Orders Table */}
          <div className="lg:col-span-2 glass-panel rounded-2xl p-6 shadow-xl border border-slate-800/40">
            <h3 className="text-sm font-bold tracking-wide uppercase text-slate-300 mb-5 flex items-center gap-2">
              <Clock size={16} className="text-blue-400" />
              <span>RECENT ORDERS</span>
            </h3>

            {recentOrders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-3">TX ID</th>
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-right">Fraud Score</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {recentOrders.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-3 font-mono font-bold text-slate-200">{tx.transaction_id}</td>
                        <td className="py-3 px-3 text-slate-300 font-semibold">{tx.product_name || 'Item'}</td>
                        <td className="py-3 px-3 text-slate-400">{tx.user_email}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-200">${tx.amount}</td>
                        <td className="py-3 px-3 text-right font-mono">
                          <span className={`font-bold ${tx.fraud_score >= 70 ? 'text-rose-400' : tx.fraud_score >= 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {tx.fraud_score.toFixed(0)}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border ${
                            tx.status === 'approved' 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : tx.status === 'blocked'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-900/10">
                No orders logged for your store yet.
              </div>
            )}
          </div>

          {/* My Store Fraud Alerts */}
          <div className="glass-panel rounded-2xl p-6 shadow-xl border border-slate-800/40">
            <h3 className="text-sm font-bold tracking-wide uppercase text-slate-300 mb-5 flex items-center gap-2">
              <BellRing size={16} className="text-rose-400 animate-bounce" />
              <span>MY STORE FRAUD ALERTS</span>
            </h3>

            <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
              {alerts.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-900/10">
                  ✓ No unresolved fraud alerts for your store.
                </div>
              ) : (
                alerts.map(alert => (
                  <div key={alert.id} className="p-3.5 rounded-xl bg-slate-900/60 border border-rose-500/20 flex gap-3.5 items-start">
                    <div className="p-2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                      <ShieldAlert size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-slate-200">
                          {alert.transaction?.transaction_id || alert.transaction_id}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono">
                          {new Date(alert.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{alert.message}</p>
                      {alert.transaction && (
                        <div className="mt-2 flex gap-4 text-[10px]">
                          <span className="text-slate-500">Amount: <strong className="text-slate-300">${alert.transaction.amount}</strong></span>
                          <span className="text-slate-500">Risk: <strong className="text-rose-400">{alert.transaction.fraud_score}%</strong></span>
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
  }

  // ----------------------------------------------------
  // ADMIN & ANALYST GLOBAL DASHBOARD
  // ----------------------------------------------------
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
        <StatCard
          title="Total Transactions"
          value={stats?.total_transactions ?? '0'}
          subtext="Volume logged"
          icon={<CreditCard size={18} />}
          isLoading={isLoading}
        />
        <StatCard
          title="Approved Transactions"
          value={stats?.approved_transactions ?? '0'}
          subtext="Completed orders"
          icon={<CheckCircle size={18} className="text-emerald-400" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Blocked Transactions"
          value={stats?.blocked_transactions ?? '0'}
          subtext="Prevented fraud"
          icon={<XCircle size={18} className="text-rose-400" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Pending Reviews"
          value={stats?.pending_reviews ?? '0'}
          subtext="Flagged status"
          icon={<AlertTriangle size={18} className="text-amber-400" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Global Fraud Rate"
          value={stats ? `${stats.fraud_rate}%` : '0%'}
          subtext="Risk ratio"
          icon={<ShieldAlert size={18} className="text-rose-400" />}
          isLoading={isLoading}
        />
        <StatCard
          title="High Risk (Score >= 80)"
          value={stats?.high_risk_transactions ?? '0'}
          subtext="Critical threats"
          icon={<ShieldAlert size={18} className="text-rose-500" />}
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
          title="Total Appeals"
          value={stats?.total_appeals ?? '0'}
          subtext="Disputes logged"
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
