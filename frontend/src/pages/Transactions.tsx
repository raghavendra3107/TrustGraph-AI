import React, { useEffect, useState } from 'react';
import { transactionService, graphService, appealService } from '../services/api';
import type { Transaction, GraphData } from '../types';
import { useAuth } from '../context/AuthContext';
import { GraphVisualizer } from '../components/GraphVisualizer';
import { 
  ShieldAlert, ShieldCheck, Eye, AlertCircle, X 
} from 'lucide-react';

export const Transactions: React.FC = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchEmail, setSearchEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  const [appealReason, setAppealReason] = useState<string>('');
  const [appealSuccess, setAppealSuccess] = useState<string>('');
  
  // Create mock transaction form fields for live testing
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTxEmail, setNewTxEmail] = useState('user_test@gmail.com');
  const [newTxAmount, setNewTxAmount] = useState('150.00');
  const [newTxCategory, setNewTxCategory] = useState('Electronics');
  const [newTxIP, setNewTxIP] = useState('198.51.100.12');
  const [newTxDevice, setNewTxDevice] = useState('DEV_SHARED_SUSPECT_009');
  const [newTxBilling, setNewTxBilling] = useState('123 Main St, New York, NY');
  const [newTxShipping, setNewTxShipping] = useState('999 Unknown Path, Moscow');

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const data = await transactionService.getAll({
        status: filterStatus || undefined,
        user_email: searchEmail || undefined
      });
      setTransactions(data);
      
      // Auto select first transaction if none selected
      if (data.length > 0 && !selectedTx) {
        handleSelectTransaction(data[0]);
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [filterStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTransactions();
  };

  const handleSelectTransaction = async (tx: Transaction) => {
    setSelectedTx(tx);
    setGraphData(null);
    setIsGraphLoading(true);
    setAppealSuccess('');
    setAppealReason('');
    
    try {
      const network = await graphService.getByTransaction(tx.transaction_id);
      setGraphData(network);
    } catch (err) {
      console.error('Failed to retrieve graph data for transaction:', err);
    } finally {
      setIsGraphLoading(false);
    }
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const randomId = `TRX${Math.floor(Math.random() * 900000) + 100000}`;
      await transactionService.create({
        transaction_id: randomId,
        user_email: newTxEmail,
        amount: parseFloat(newTxAmount),
        currency: 'USD',
        merchant_category: newTxCategory,
        ip_address: newTxIP,
        device_id: newTxDevice,
        card_hash: '411111XXXXXX' + Math.floor(1000 + Math.random() * 9000),
        billing_address: newTxBilling,
        shipping_address: newTxShipping
      });
      setShowCreateModal(false);
      fetchTransactions();
    } catch (err) {
      console.error('Failed to dispatch transaction:', err);
    }
  };

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTx || !appealReason) return;
    
    try {
      await appealService.create({
        transaction_id: selectedTx.id,
        reason: appealReason
      });
      setAppealSuccess('Appeal submitted successfully.');
      setAppealReason('');
      fetchTransactions();
    } catch (err: any) {
      setAppealSuccess(err.response?.data?.detail || 'Failed to submit appeal');
    }
  };

  return (
    <div className="p-8 flex-1 min-w-0 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Fraud Detection Logs</h2>
          <p className="text-xs text-slate-400 mt-1">
            Browse raw transaction events, inspect AI risk factor breakdowns (XAI), and map graph relationship rings.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/10 cursor-pointer"
        >
          Create Test Transaction
        </button>
      </div>

      {/* Main Workspaces: Split pane */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
        {/* Left Side: Table & Filters */}
        <div className="xl:col-span-3 space-y-4">
          {/* Filters Bar */}
          <div className="glass-panel rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <form onSubmit={handleSearchSubmit} className="flex gap-2 flex-1">
              <input
                type="text"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="Search user email..."
                className="bg-slate-900/60 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none w-full md:max-w-xs"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 rounded-lg text-xs font-medium cursor-pointer"
              >
                Search
              </button>
            </form>
            
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Status:
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-900/60 border border-slate-800 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg focus:border-blue-500 outline-none"
              >
                <option value="">All Transactions</option>
                <option value="approved">Approved</option>
                <option value="flagged">Flagged</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
          </div>

          {/* Transactions List */}
          <div className="glass-panel rounded-xl overflow-hidden shadow-lg border border-slate-800/40">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Tx ID</th>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Risk Score</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/65">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Analyzing transaction logs...
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No transactions matches filters.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr 
                        key={tx.id} 
                        onClick={() => handleSelectTransaction(tx)}
                        className={`cursor-pointer transition-colors ${
                          selectedTx?.id === tx.id 
                            ? 'bg-blue-600/10 text-slate-200' 
                            : 'hover:bg-slate-900/40 text-slate-300'
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold">{tx.transaction_id}</td>
                        <td className="py-3 px-4 truncate max-w-[120px]">{tx.user_email}</td>
                        <td className="py-3 px-4 font-mono">${tx.amount.toFixed(2)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-12 bg-slate-800 h-1.5 rounded-full overflow-hidden shrink-0">
                              <div 
                                className={`h-full rounded-full ${
                                  tx.fraud_score >= 70 ? 'bg-rose-500' : (tx.fraud_score >= 40 ? 'bg-amber-500' : 'bg-emerald-500')
                                }`} 
                                style={{ width: `${tx.fraud_score}%` }} 
                              />
                            </div>
                            <span className={`font-mono font-semibold ${
                              tx.fraud_score >= 70 ? 'text-rose-400' : (tx.fraud_score >= 40 ? 'text-amber-400' : 'text-emerald-400')
                            }`}>
                              {tx.fraud_score}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            tx.status === 'approved' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : (tx.status === 'flagged' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20')
                          }`}>
                            {tx.status === 'approved' ? <ShieldCheck size={10} /> : <ShieldAlert size={10} />}
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button className="p-1 rounded bg-slate-800 text-slate-400 hover:text-slate-200">
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Details, XAI & Graph */}
        <div className="xl:col-span-2 space-y-6">
          {selectedTx ? (
            <div className="space-y-6 animate-fade-in">
              {/* Core Details */}
              <div className="glass-panel rounded-xl p-6 space-y-5">
                <div className="flex justify-between items-start border-b border-slate-800/80 pb-4">
                  <div>
                    <h3 className="font-bold text-slate-200 text-base">Transaction Details</h3>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">DB_ID: #{selectedTx.id} | CODE: {selectedTx.transaction_id}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold text-slate-100 font-mono">${selectedTx.amount.toFixed(2)}</span>
                    <p className="text-[10px] text-slate-500 uppercase font-semibold mt-0.5">{selectedTx.currency}</p>
                  </div>
                </div>

                {/* AI Score breakdown (XAI) */}
                <div>
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">AI Fraud Assessment Risk</span>
                    <span className={`text-sm font-bold ${
                      selectedTx.fraud_score >= 70 ? 'text-rose-400' : (selectedTx.fraud_score >= 40 ? 'text-amber-400' : 'text-emerald-400')
                    }`}>
                      {selectedTx.fraud_score}% Score
                    </span>
                  </div>
                  <div className="w-full bg-slate-800/60 h-2.5 rounded-full overflow-hidden border border-slate-800">
                    <div 
                      className={`h-full rounded-full bg-gradient-to-r ${
                        selectedTx.fraud_score >= 70 ? 'from-amber-500 to-rose-600' : (selectedTx.fraud_score >= 40 ? 'from-emerald-500 to-amber-500' : 'from-emerald-600 to-teal-400')
                      }`} 
                      style={{ width: `${selectedTx.fraud_score}%` }} 
                    />
                  </div>
                </div>

                {/* XAI explanation factors */}
                <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Explainable AI (XAI) Risk Factors
                  </span>
                  
                  {selectedTx.risk_explanation ? (
                    selectedTx.risk_explanation.split(',').map((factor, i) => (
                      <div key={i} className="flex gap-2 items-start text-xs text-slate-300">
                        <AlertCircle size={13} className="shrink-0 text-amber-500 mt-0.5" />
                        <span>{factor.trim()}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">No anomalous indicators captured.</p>
                  )}
                </div>

                {/* Metadata details table */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block mb-0.5">User Email</span>
                    <span className="text-slate-300 font-medium truncate block">{selectedTx.user_email}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">Category</span>
                    <span className="text-slate-300 font-medium">{selectedTx.merchant_category}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">Device ID</span>
                    <span className="text-slate-300 font-medium font-mono truncate block">{selectedTx.device_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">IP Address</span>
                    <span className="text-slate-300 font-medium font-mono">{selectedTx.ip_address}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block mb-0.5">Shipping Location</span>
                    <span className="text-slate-300 font-medium truncate block">{selectedTx.shipping_address}</span>
                  </div>
                </div>

                {/* Appeal disputes triggers */}
                {selectedTx.status !== 'approved' && user?.role === 'merchant' && (
                  <form onSubmit={handleSubmitAppeal} className="border-t border-slate-800/80 pt-4 space-y-3.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Dispute Flagged Transaction
                    </span>
                    <textarea
                      value={appealReason}
                      onChange={(e) => setAppealReason(e.target.value)}
                      placeholder="Explain why this transaction is legitimate..."
                      required
                      rows={2}
                      className="w-full p-2.5 text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-lg focus:border-blue-500 outline-none"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                    >
                      Submit Appeal
                    </button>
                    {appealSuccess && (
                      <p className="text-[10px] text-amber-400 font-semibold">{appealSuccess}</p>
                    )}
                  </form>
                )}
              </div>

              {/* Investigation Graph */}
              {isGraphLoading ? (
                <div className="h-64 glass-panel rounded-xl flex items-center justify-center text-xs text-slate-500">
                  Compiling network graph ring data...
                </div>
              ) : graphData ? (
                <GraphVisualizer graphData={graphData} height={320} />
              ) : (
                <div className="h-64 glass-panel rounded-xl flex items-center justify-center text-xs text-slate-500">
                  No network graph loaded.
                </div>
              )}
            </div>
          ) : (
            <div className="glass-panel rounded-xl p-12 text-center text-xs text-slate-500 border border-dashed border-slate-800">
              Select a transaction to inspect logs, AI reasoning, and graph structures.
            </div>
          )}
        </div>
      </div>

      {/* CREATE TRANSACTION MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg glass-panel rounded-2xl p-6 shadow-2xl space-y-4 animate-fade-in border border-slate-800/80">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-200">Inject Mock Transaction</h3>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 bg-slate-800/60 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateTransaction} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">User Email</label>
                  <input
                    type="email"
                    value={newTxEmail}
                    onChange={(e) => setNewTxEmail(e.target.value)}
                    className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Amount ($)</label>
                  <input
                    type="text"
                    value={newTxAmount}
                    onChange={(e) => setNewTxAmount(e.target.value)}
                    className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Category</label>
                  <select
                    value={newTxCategory}
                    onChange={(e) => setNewTxCategory(e.target.value)}
                    className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 outline-none"
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="Gift Cards">Gift Cards</option>
                    <option value="Apparel">Apparel</option>
                    <option value="Crypto">Crypto</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">IP Address</label>
                  <input
                    type="text"
                    value={newTxIP}
                    onChange={(e) => setNewTxIP(e.target.value)}
                    className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 outline-none font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-slate-400 block mb-1">Device ID fingerprint</label>
                  <input
                    type="text"
                    value={newTxDevice}
                    onChange={(e) => setNewTxDevice(e.target.value)}
                    className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Billing Address</label>
                  <input
                    type="text"
                    value={newTxBilling}
                    onChange={(e) => setNewTxBilling(e.target.value)}
                    className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Shipping Address</label>
                  <input
                    type="text"
                    value={newTxShipping}
                    onChange={(e) => setNewTxShipping(e.target.value)}
                    className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold cursor-pointer"
                >
                  Dispatch to AI Engine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default Transactions;
