import React, { useEffect, useState } from 'react';
import { appealService, graphService } from '../services/api';
import type { Appeal } from '../types';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, ShieldAlert, Clock, MessageSquare, Check, X } from 'lucide-react';
import { GraphVisualizer } from '../components/GraphVisualizer';

export const Appeals: React.FC = () => {
  const { user } = useAuth();
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [recommendation, setRecommendation] = useState<'recommended_approve' | 'recommended_reject'>('recommended_approve');
  const [actionSuccess, setActionSuccess] = useState<string>('');
  
  const [graphData, setGraphData] = useState<any>(null);
  const [isGraphLoading, setIsGraphLoading] = useState<boolean>(false);

  const fetchAppeals = async () => {
    setIsLoading(true);
    try {
      const data = await appealService.getAll();
      setAppeals(data);
      
      // Auto select first
      if (data.length > 0) {
        // Find if selectedAppeal still exists in list, otherwise select first
        const matched = selectedAppeal ? data.find(a => a.id === selectedAppeal.id) : null;
        setSelectedAppeal(matched || data[0]);
      } else {
        setSelectedAppeal(null);
      }
    } catch (err) {
      console.error('Failed to retrieve appeals:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGraphData = async (txId: string) => {
    setIsGraphLoading(true);
    setGraphData(null);
    try {
      const data = await graphService.getByTransaction(txId);
      setGraphData(data);
    } catch (err) {
      console.error('Failed to load graph data:', err);
    } finally {
      setIsGraphLoading(false);
    }
  };

  useEffect(() => {
    fetchAppeals();
  }, []);

  useEffect(() => {
    if (selectedAppeal?.transaction?.transaction_id) {
      fetchGraphData(selectedAppeal.transaction.transaction_id);
    } else {
      setGraphData(null);
    }
  }, [selectedAppeal?.transaction?.transaction_id]);

  const handleSelectAppeal = async (appeal: Appeal) => {
    setSelectedAppeal(appeal);
    setReviewNotes('');
    setActionSuccess('');
  };

  const handleAnalystSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppeal || !reviewNotes) return;

    try {
      const updated = await appealService.update(selectedAppeal.id, {
        investigation_status: recommendation,
        investigation_notes: reviewNotes
      });
      setSelectedAppeal(updated);
      setActionSuccess('Investigation report submitted to Merchant.');
      setReviewNotes('');
      fetchAppeals();
    } catch (err: any) {
      setActionSuccess(err.response?.data?.detail || 'Failed to submit investigation.');
    }
  };

  const handleMerchantDecision = async (decision: 'approved' | 'rejected') => {
    if (!selectedAppeal) return;

    try {
      const updated = await appealService.update(selectedAppeal.id, {
        final_order_status: decision
      });
      setSelectedAppeal(updated);
      setActionSuccess(`Order status updated to: ${decision.toUpperCase()}`);
      fetchAppeals();
    } catch (err: any) {
      setActionSuccess(err.response?.data?.detail || 'Failed to apply final decision.');
    }
  };

  return (
    <div className="p-8 flex-1 min-w-0 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-100">Fraud Review Workstation</h2>
            {user?.role === 'merchant' && (
              <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-mono font-bold rounded-lg flex items-center gap-1.5">
                <span>Store: {user.seller_name || user.seller_id || 'SELL_APEX_STORE'}</span>
                <span className="text-[10px] text-blue-400 font-mono">({user.seller_id || 'SELL_APEX_STORE'})</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Investigate suspicious flagged orders, review AI fraud graph signals, and process merchant final business decisions.
          </p>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Left: Appeals / Fraud Reviews Table */}
        <div className="lg:col-span-3 glass-panel rounded-xl overflow-hidden border border-slate-800/40 shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-3">Tx ID</th>
                  <th className="py-3.5 px-3">Product / Store</th>
                  <th className="py-3.5 px-3">Customer</th>
                  <th className="py-3.5 px-3">Date</th>
                  <th className="py-3.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Loading fraud reviews...
                    </td>
                  </tr>
                ) : appeals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No fraud reviews found in your queue.
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
                      <td className="py-3 px-3 font-mono font-bold text-[11px]">
                        {appeal.transaction?.transaction_id || `Tx #${appeal.transaction_id}`}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-200">{appeal.transaction?.product_name || 'Standard Item'}</div>
                        <div className="text-[10px] text-blue-400 font-mono">{appeal.transaction?.seller_name || appeal.transaction?.seller_id}</div>
                      </td>
                      <td className="py-3 px-3 truncate max-w-[120px] text-slate-400">{appeal.user_email}</td>
                      <td className="py-3 px-3 text-slate-400">{new Date(appeal.created_at).toLocaleDateString()}</td>
                      <td className="py-3 px-3 text-center">
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
              <div className="border-b border-slate-800/80 pb-3 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-200 text-sm">Fraud Review Detail</h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">Review Ref: #{selectedAppeal.id}</p>
                </div>
                {selectedAppeal.transaction && (
                  <span className={`px-2 py-1 rounded text-xs font-bold font-mono ${
                    selectedAppeal.transaction.fraud_score >= 70 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    Risk: {selectedAppeal.transaction.fraud_score}%
                  </span>
                )}
              </div>

              {/* Product and Seller Card */}
              {selectedAppeal.transaction && (
                <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between items-center border-b border-slate-800/60 pb-1.5">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Product & Seller Information</span>
                    <span className="text-[10px] text-slate-500 font-mono">{selectedAppeal.transaction.seller_id}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500 text-[10px] block">Product Name</span>
                      <span className="text-slate-200 font-semibold">{selectedAppeal.transaction.product_name || 'Standard Item'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Product Category</span>
                      <span className="text-slate-300">{selectedAppeal.transaction.product_category || selectedAppeal.transaction.merchant_category}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Seller Store</span>
                      <span className="text-blue-400 font-semibold">{selectedAppeal.transaction.seller_name || selectedAppeal.transaction.seller_id}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Seller Location</span>
                      <span className="text-slate-300">{selectedAppeal.transaction.seller_location || 'Global Store'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Transaction details if attached */}
              {selectedAppeal.transaction && (
                <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2.5 text-xs">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                    Buyer & Risk Metadata
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <span className="text-slate-500 text-[10px] block">Order Amount</span>
                      <span className="text-slate-200 font-mono font-semibold">${selectedAppeal.transaction.amount.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Buyer Email</span>
                      <span className="text-slate-300 truncate block">{selectedAppeal.user_email}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Buyer IP</span>
                      <span className="text-slate-300 font-mono">{selectedAppeal.transaction.ip_address}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Device Fingerprint</span>
                      <span className="text-slate-300 font-mono text-[10px] truncate block">{selectedAppeal.transaction.device_id}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 text-[10px] block">XAI Risk Explanation</span>
                      <p className="text-[11px] text-amber-300/90 mt-0.5 leading-relaxed bg-slate-950 p-2 rounded border border-slate-800">
                        {selectedAppeal.transaction.risk_explanation || 'High risk score calculated by engine.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Fraud Graph Visualizer */}
              {selectedAppeal.transaction && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Fraud Connection Graph
                  </span>
                  {isGraphLoading ? (
                    <div className="h-44 glass-panel rounded-xl flex items-center justify-center text-xs text-slate-500 border border-slate-800">
                      Compiling network graph data...
                    </div>
                  ) : graphData ? (
                    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                      <GraphVisualizer graphData={graphData} height={420} />
                    </div>
                  ) : (
                    <div className="h-44 glass-panel rounded-xl flex items-center justify-center text-xs text-slate-500 border border-slate-800">
                      No network graph loaded.
                    </div>
                  )}
                </div>
              )}

              {/* Dispute statement */}
              <div className="space-y-1.5 text-xs">
                <span className="text-slate-500 flex items-center gap-1.5 font-semibold">
                  <MessageSquare size={13} />
                  <span>Customer Dispute Reason</span>
                </span>
                <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/60 text-slate-300 leading-relaxed text-[11px]">
                  "{selectedAppeal.reason}"
                </div>
              </div>

              {/* Action notes / Feedback */}
              <div className="space-y-4 pt-2">
                {/* 1. Show existing Analyst recommendation report if already investigated */}
                {selectedAppeal.investigation_status && selectedAppeal.investigation_status !== 'pending' && (
                  <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800 text-xs space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block text-slate-400">
                      Analyst Recommendation Report
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-slate-400">Recommendation:</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        selectedAppeal.investigation_status === 'recommended_approve'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {selectedAppeal.investigation_status === 'recommended_approve' ? 'Recommended Approval' : 'Recommended Rejection'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-1">Analyst Notes:</span>
                      <p className="text-slate-300 leading-relaxed text-[11px]">
                        {selectedAppeal.investigation_notes || 'No notes logged by security analyst.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* 2. Show Merchant final decision if resolved */}
                {selectedAppeal.merchant_final_decision && (
                  <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 text-xs space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block text-slate-400">
                      Merchant Final Decision
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Merchant Decision:</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        selectedAppeal.merchant_final_decision === 'approved'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {selectedAppeal.merchant_final_decision === 'approved' ? 'Order Approved' : 'Order Rejected'}
                      </span>
                    </div>
                    {selectedAppeal.merchant_decision_timestamp && (
                      <div className="text-[10px] text-slate-500">
                        Decided on: {new Date(selectedAppeal.merchant_decision_timestamp).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Action Block based on user role */}
                <div className="border-t border-slate-800/80 pt-4 space-y-3">
                  {/* CASE A: Security Analyst Action Queue */}
                  {user?.role === 'analyst' && (
                    selectedAppeal.investigation_status === 'pending' || !selectedAppeal.investigation_status ? (
                      <form onSubmit={handleAnalystSubmit} className="space-y-3 text-xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Submit Investigation Report
                        </span>
                        
                        <div>
                          <label className="text-slate-500 block mb-1">Analyst Recommendation</label>
                          <select
                            value={recommendation}
                            onChange={(e) => setRecommendation(e.target.value as any)}
                            className="w-full p-2 text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-lg focus:border-blue-500 outline-none"
                          >
                            <option value="recommended_approve">Recommended Approval</option>
                            <option value="recommended_reject">Recommended Rejection</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-slate-500 block mb-1">Investigation Notes</label>
                          <textarea
                            value={reviewNotes}
                            onChange={(e) => setReviewNotes(e.target.value)}
                            placeholder="Detail your fraud ring analysis findings, customer velocity checks, or collusion metrics..."
                            rows={3}
                            required
                            className="w-full p-2.5 text-xs text-slate-200 bg-slate-950 border border-slate-800 rounded-lg focus:border-blue-500 outline-none"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/10"
                        >
                          <Check size={14} />
                          <span>Submit Investigation to Merchant</span>
                        </button>
                      </form>
                    ) : (
                      <div className="p-3 bg-blue-950/20 border border-blue-900/30 text-blue-400 text-xs rounded-lg font-medium text-center">
                        Report submitted. Awaiting final decision from Merchant.
                      </div>
                    )
                  )}

                  {/* CASE B: Merchant Action Queue */}
                  {user?.role === 'merchant' && (
                    selectedAppeal.status === 'pending' ? (
                      selectedAppeal.investigation_status && selectedAppeal.investigation_status !== 'pending' ? (
                        <div className="space-y-3 text-xs">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Execute Business Decision
                          </span>
                          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] rounded-lg leading-relaxed">
                            <strong>Note:</strong> You hold final liability for the charge. The analyst has recommended **{
                              selectedAppeal.investigation_status === 'recommended_approve' ? 'APPROVAL' : 'REJECTION'
                            }**.
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleMerchantDecision('approved')}
                              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-600/10"
                            >
                              <Check size={14} />
                              <span>Approve Order</span>
                            </button>
                            <button
                              onClick={() => handleMerchantDecision('rejected')}
                              className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-rose-600/10"
                            >
                              <X size={14} />
                              <span>Reject Order</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-slate-900/50 border border-slate-800 text-slate-400 text-xs rounded-lg text-center font-medium">
                          Awaiting Security Analyst's Investigation Report.
                        </div>
                      )
                    ) : (
                      <div className="p-3 bg-slate-900/50 border border-slate-800 text-slate-400 text-xs rounded-lg text-center font-medium">
                        Order decision completed. This appeal is now closed.
                      </div>
                    )
                  )}

                  {/* CASE C: Admin Read-only Queue */}
                  {user?.role === 'admin' && (
                    <div className="p-3 bg-slate-900/40 border border-slate-800 text-slate-500 text-xs rounded-lg text-center font-medium">
                      System Administrator view - Read-only transaction oversight.
                    </div>
                  )}
                </div>

                {actionSuccess && (
                  <p className="text-[10px] text-amber-400 font-semibold mt-2 text-center">{actionSuccess}</p>
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
