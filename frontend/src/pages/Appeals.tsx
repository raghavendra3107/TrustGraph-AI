import React, { useEffect, useState } from 'react';
import { appealService } from '../services/api';
import type { Appeal } from '../types';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, ShieldAlert, Clock, MessageSquare, Check, X } from 'lucide-react';

export const Appeals: React.FC = () => {
  const { user } = useAuth();
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [actionSuccess, setActionSuccess] = useState<string>('');

  const fetchAppeals = async () => {
    setIsLoading(true);
    try {
      const data = await appealService.getAll();
      setAppeals(data);
      
      // Auto select first
      if (data.length > 0 && !selectedAppeal) {
        setSelectedAppeal(data[0]);
      }
    } catch (err) {
      console.error('Failed to retrieve appeals:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppeals();
  }, []);

  const handleSelectAppeal = async (appeal: Appeal) => {
    setSelectedAppeal(appeal);
    setReviewNotes('');
    setActionSuccess('');
  };

  const handleDecision = async (status: 'approved' | 'rejected') => {
    if (!selectedAppeal || !reviewNotes) return;
    
    try {
      const updated = await appealService.update(selectedAppeal.id, {
        status,
        analyst_feedback: reviewNotes
      });
      setSelectedAppeal(updated);
      setActionSuccess(`Appeal decision set: ${status.toUpperCase()}`);
      fetchAppeals();
    } catch (err: any) {
      setActionSuccess(err.response?.data?.detail || 'Failed to update decision.');
    }
  };

  return (
    <div className="p-8 flex-1 min-w-0 overflow-y-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Dispute & Appeals Management</h2>
        <p className="text-xs text-slate-400 mt-1">
          Review appeals submitted by merchants for flagged or blocked transactions. Resolve charges under analyst review.
        </p>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Left: Appeals Table */}
        <div className="lg:col-span-3 glass-panel rounded-xl overflow-hidden border border-slate-800/40 shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Tx Reference</th>
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Submitted At</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">
                      Querying appeals database...
                    </td>
                  </tr>
                ) : appeals.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">
                      No appeals filed in system database.
                    </td>
                  </tr>
                ) : (
                  appeals.map((appeal) => (
                    <tr
                      key={appeal.id}
                      onClick={() => handleSelectAppeal(appeal)}
                      className={`cursor-pointer transition-colors ${
                        selectedAppeal?.id === appeal.id 
                          ? 'bg-blue-600/10 text-slate-200' 
                          : 'hover:bg-slate-900/45 text-slate-300'
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold">
                        {appeal.transaction?.transaction_id || `Tx #${appeal.transaction_id}`}
                      </td>
                      <td className="py-3 px-4 truncate max-w-[150px]">{appeal.user_email}</td>
                      <td className="py-3 px-4">{new Date(appeal.created_at).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          appeal.status === 'approved' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : (appeal.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20')
                        }`}>
                          {appeal.status === 'approved' && <ShieldCheck size={9} />}
                          {appeal.status === 'pending' && <Clock size={9} />}
                          {appeal.status === 'rejected' && <ShieldAlert size={9} />}
                          {appeal.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Inspection Drawer */}
        <div className="lg:col-span-2 space-y-6">
          {selectedAppeal ? (
            <div className="glass-panel rounded-xl p-6 space-y-5 animate-fade-in">
              <div className="border-b border-slate-800/80 pb-4">
                <h3 className="font-bold text-slate-200 text-sm">Dispute Investigation</h3>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">Appeal Reference ID: #{selectedAppeal.id}</p>
              </div>

              {/* Transaction details if attached */}
              {selectedAppeal.transaction && (
                <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-3.5 text-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Associated Transaction Details
                  </span>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <span className="text-slate-500 block">Amount</span>
                      <span className="text-slate-300 font-mono font-semibold">${selectedAppeal.transaction.amount.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">AI Fraud Score</span>
                      <span className="text-rose-400 font-semibold">{selectedAppeal.transaction.fraud_score}%</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 block">XAI Analysis Indicators</span>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        {selectedAppeal.transaction.risk_explanation || 'No factors flagged.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Dispute statement */}
              <div className="space-y-1.5 text-xs">
                <span className="text-slate-500 flex items-center gap-1.5 font-semibold">
                  <MessageSquare size={13} />
                  <span>Merchant Dispute Reason</span>
                </span>
                <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/60 text-slate-300 leading-relaxed text-[11px]">
                  "{selectedAppeal.reason}"
                </div>
              </div>

              {/* Action notes / Feedback */}
              <div className="space-y-4 pt-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Analyst Review Notes
                </span>

                {selectedAppeal.status === 'pending' && user?.role !== 'merchant' ? (
                  user?.role === 'admin' ? (
                    <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800 text-xs text-amber-500/90 font-medium">
                      View Only - Appeal decisions are handled by Security Analysts.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Add investigation comments, whitelist reasons, or block details..."
                        rows={3}
                        required
                        className="w-full p-2.5 text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-lg focus:border-blue-500 outline-none"
                      />

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDecision('approved')}
                          disabled={!reviewNotes}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800/80 disabled:text-slate-500 text-white text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Check size={14} />
                          <span>Approve (Allow Tx)</span>
                        </button>
                        <button
                          onClick={() => handleDecision('rejected')}
                          disabled={!reviewNotes}
                          className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800/80 disabled:text-slate-500 text-white text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <X size={14} />
                          <span>Reject (Block Tx)</span>
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800 text-xs">
                    <span className="text-slate-500 block mb-1">Official Decision Notes:</span>
                    <p className="text-slate-300 leading-relaxed text-[11px]">
                      {selectedAppeal.analyst_feedback || 'Under queue review. No decision notes logged.'}
                    </p>
                  </div>
                )}

                {actionSuccess && (
                  <p className="text-[10px] text-amber-400 font-semibold mt-2">{actionSuccess}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-xl p-12 text-center text-xs text-slate-500 border border-dashed border-slate-800">
              Select an appeal from list queue to review details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default Appeals;
