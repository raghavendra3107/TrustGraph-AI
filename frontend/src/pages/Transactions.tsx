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
  
  // Create mock transaction form fields for live testing
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProductName, setNewProductName] = useState('iPhone 17');
  const [newProductCategory, setNewProductCategory] = useState('Electronics');
  const [newSellerStore, setNewSellerStore] = useState('SELL_APPLE_STORE');
  const [newSellerName, setNewSellerName] = useState('Apple Store');
  const [newSellerId, setNewSellerId] = useState('SELL_APPLE_STORE');
  const [newSellerLocation, setNewSellerLocation] = useState('Cupertino, USA');
  
  const [newCustId, setNewCustId] = useState('CUST-1001');
  const [newCustEmail, setNewCustEmail] = useState('buyer_john@gmail.com');
  const [newCustLocation, setNewCustLocation] = useState('Hyderabad, India');
  const [newTxIP, setNewTxIP] = useState('185.220.101.4');
  const [newTxDevice, setNewTxDevice] = useState('DEV_SHARED_SUSPECT_009');
  
  const [newTxAmount, setNewTxAmount] = useState('899.99');
  const [newTxBilling, setNewTxBilling] = useState('123 Main St, Hyderabad, India');
  const [newTxShipping, setNewTxShipping] = useState('999 Shadow Path, Moscow, RU');

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

  const handleSellerSelect = (storeKey: string) => {
    setNewSellerStore(storeKey);
    const catalog: Record<string, { name: string; id: string; category: string; location: string; defaultProd: string }> = {
      SELL_APPLE_STORE: { name: 'Apple Store', id: 'SELL_APPLE_STORE', category: 'Electronics', location: 'Cupertino, USA', defaultProd: 'iPhone 17' },
      SELL_DELL_STORE: { name: 'Dell Store', id: 'SELL_DELL_STORE', category: 'Electronics', location: 'Round Rock, USA', defaultProd: 'Dell XPS' },
      SELL_HP_STORE: { name: 'HP Store', id: 'SELL_HP_STORE', category: 'Electronics', location: 'Palo Alto, USA', defaultProd: 'HP Laptop' },
      SELL_FASHION_STORE: { name: 'Fashion Store', id: 'SELL_FASHION_STORE', category: 'Clothing', location: 'Paris, France', defaultProd: 'Designer Jacket' },
      SELL_APEX_STORE: { name: 'Apex Retailers', id: 'SELL_APEX_STORE', category: 'Electronics', location: 'New York, USA', defaultProd: 'Apex Smart Tablet' },
    };
    const s = catalog[storeKey];
    if (s) {
      setNewSellerName(s.name);
      setNewSellerId(s.id);
      setNewProductCategory(s.category);
      setNewSellerLocation(s.location);
      setNewProductName(s.defaultProd);
    }
  };

  const handleSelectTransaction = async (tx: Transaction) => {
    setSelectedTx(tx);
    setGraphData(null);
    setIsGraphLoading(true);
    try {
      // Re-fetch transaction from DB to ensure nested appeal data is fully updated
      const detailTx = await transactionService.getById(tx.id);
      setSelectedTx(detailTx);
      
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
        user_email: newCustEmail,
        amount: parseFloat(newTxAmount),
        currency: 'USD',
        merchant_category: newProductCategory,
        product_name: newProductName,
        product_category: newProductCategory,
        seller_name: newSellerName,
        seller_id: newSellerId,
        seller_location: newSellerLocation,
        customer_id: newCustId,
        customer_location: newCustLocation,
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


  return (
    <div className="p-8 flex-1 min-w-0 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-100">Fraud Detection Logs</h2>
            {user?.role === 'merchant' && (
              <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-mono font-bold rounded-lg flex items-center gap-1.5">
                <span>Store: {user.seller_name || user.seller_id || 'SELL_APEX_STORE'}</span>
                <span className="text-[10px] text-blue-400 font-mono">({user.seller_id || 'SELL_APEX_STORE'})</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Browse raw transaction events, inspect AI risk factor breakdowns (XAI), and map graph relationship rings.
          </p>
        </div>
        {user?.role !== 'admin' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/10 cursor-pointer"
          >
            Create Test Transaction
          </button>
        )}
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
                    <th className="py-3 px-3">Tx ID</th>
                    <th className="py-3 px-3">Product / Store</th>
                    <th className="py-3 px-3">User</th>
                    <th className="py-3 px-3">Amount</th>
                    <th className="py-3 px-3">Risk Score</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/65">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Analyzing transaction logs...
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
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
                        <td className="py-3 px-3 font-mono font-bold text-[11px]">{tx.transaction_id}</td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-200">{tx.product_name || 'Standard Item'}</div>
                          <div className="text-[10px] text-blue-400 font-mono">{tx.seller_name || tx.seller_id}</div>
                        </td>
                        <td className="py-3 px-3 truncate max-w-[100px] text-slate-400">{tx.user_email}</td>
                        <td className="py-3 px-3 font-mono">${tx.amount.toFixed(2)}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-10 bg-slate-800 h-1.5 rounded-full overflow-hidden shrink-0">
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

                {/* Appeal disputes triggers / status card */}
                {selectedTx.appeal && (
                  <div className="border-t border-slate-800/80 pt-4 space-y-3.5">
                    <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 text-xs space-y-3.5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Fraud Review & Investigation Report
                      </span>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-slate-500 block">Review Status</span>
                          <span className={`inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            selectedTx.appeal.status === 'approved' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : (selectedTx.appeal.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20')
                          }`}>
                            {selectedTx.appeal.status}
                          </span>
                        </div>
                        
                        <div>
                          <span className="text-slate-500 block">Report Triggered</span>
                          <span className="text-slate-300 font-mono mt-0.5 block">
                            {new Date(selectedTx.appeal.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Analyst recommendation if exists */}
                        {selectedTx.appeal.investigation_status && selectedTx.appeal.investigation_status !== 'pending' && (
                          <div className="col-span-2 border-t border-slate-900 pt-2.5 space-y-2">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-slate-500">Analyst Recommendation:</span>
                              <span className={`font-bold uppercase px-1.5 py-0.5 rounded text-[9px] ${
                                selectedTx.appeal.investigation_status === 'recommended_approve' 
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}>
                                {selectedTx.appeal.investigation_status === 'recommended_approve' ? 'Recommended Approval' : 'Recommended Rejection'}
                              </span>
                            </div>
                            {selectedTx.appeal.investigation_notes && (
                              <div>
                                <span className="text-slate-500 block">Investigation Notes:</span>
                                <p className="text-slate-300 mt-0.5 leading-relaxed text-[11px]">
                                  {selectedTx.appeal.investigation_notes}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Merchant final decision display */}
                        {selectedTx.appeal.merchant_final_decision && (
                          <div className="col-span-2 border-t border-slate-900 pt-2">
                            <span className="text-slate-500 block">Merchant Final Decision</span>
                            <span className={`font-semibold mt-0.5 block ${selectedTx.appeal.merchant_final_decision === 'approved' ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {selectedTx.appeal.merchant_final_decision === 'approved' ? 'Transaction Whitelisted & Approved' : 'Transaction Block Confirmed'}
                            </span>
                          </div>
                        )}

                        {/* Merchant final decision action trigger inside Transactions view */}
                        {user?.role === 'merchant' && selectedTx.appeal.status === 'pending' && selectedTx.appeal.investigation_status && selectedTx.appeal.investigation_status !== 'pending' && (
                          <div className="col-span-2 border-t border-slate-900 pt-3.5 space-y-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Submit Final Order Decision
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  await appealService.update(selectedTx.appeal!.id, { final_order_status: 'approved' });
                                  await handleSelectTransaction(selectedTx);
                                }}
                                className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                              >
                                Approve Order
                              </button>
                              <button
                                onClick={async () => {
                                  await appealService.update(selectedTx.appeal!.id, { final_order_status: 'rejected' });
                                  await handleSelectTransaction(selectedTx);
                                }}
                                className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                              >
                                Reject Order
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Investigation Graph */}
              {isGraphLoading ? (
                <div className="h-64 glass-panel rounded-xl flex items-center justify-center text-xs text-slate-500">
                  Compiling network graph ring data...
                </div>
              ) : graphData ? (
                <GraphVisualizer graphData={graphData} height={420} />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl glass-panel rounded-2xl p-6 shadow-2xl space-y-4 my-8 animate-fade-in border border-slate-800/80">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Simulate Marketplace Transaction</h3>
                <p className="text-[10px] text-slate-400">Inject order parameters for multi-merchant risk engine simulation</p>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 bg-slate-800/60 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateTransaction} className="space-y-4 text-xs">
              {/* SECTION 1: PRODUCT INFORMATION */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                <div className="flex justify-between items-center border-b border-slate-800/60 pb-1.5">
                  <span className="font-bold text-[11px] text-blue-400 uppercase tracking-wider">1. Product Information</span>
                  <span className="text-[10px] text-slate-500 font-mono">Catalog Select</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold">Select Store / Merchant</label>
                    <select
                      value={newSellerStore}
                      onChange={(e) => handleSellerSelect(e.target.value)}
                      className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-semibold outline-none focus:border-blue-500"
                    >
                      <option value="SELL_APPLE_STORE">Apple Store (Cupertino)</option>
                      <option value="SELL_DELL_STORE">Dell Store (Round Rock)</option>
                      <option value="SELL_HP_STORE">HP Store (Palo Alto)</option>
                      <option value="SELL_FASHION_STORE">Fashion Store (Paris)</option>
                      <option value="SELL_APEX_STORE">Apex Retailers (New York)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold">Product Name</label>
                    <input
                      type="text"
                      required
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold">Product Category</label>
                    <input
                      type="text"
                      required
                      value={newProductCategory}
                      onChange={(e) => setNewProductCategory(e.target.value)}
                      className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: CUSTOMER / BUYER METADATA */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                <div className="flex justify-between items-center border-b border-slate-800/60 pb-1.5">
                  <span className="font-bold text-[11px] text-indigo-400 uppercase tracking-wider">2. Customer / Buyer Metadata</span>
                  <span className="text-[10px] text-slate-500 font-mono">External Buyer</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold">Customer ID</label>
                    <input
                      type="text"
                      required
                      value={newCustId}
                      onChange={(e) => setNewCustId(e.target.value)}
                      className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold">Customer Email</label>
                    <input
                      type="email"
                      required
                      value={newCustEmail}
                      onChange={(e) => setNewCustEmail(e.target.value)}
                      className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold">Customer Location</label>
                    <input
                      type="text"
                      required
                      value={newCustLocation}
                      onChange={(e) => setNewCustLocation(e.target.value)}
                      className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold">Customer IP Address</label>
                    <input
                      type="text"
                      required
                      value={newTxIP}
                      onChange={(e) => setNewTxIP(e.target.value)}
                      className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-slate-400 block mb-1 font-semibold">Customer Device Fingerprint</label>
                    <input
                      type="text"
                      required
                      value={newTxDevice}
                      onChange={(e) => setNewTxDevice(e.target.value)}
                      className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: TRANSACTION INFORMATION */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                <div className="flex justify-between items-center border-b border-slate-800/60 pb-1.5">
                  <span className="font-bold text-[11px] text-emerald-400 uppercase tracking-wider">3. Transaction Information</span>
                  <span className="text-[10px] text-slate-500 font-mono">Payment Details</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold">Amount ($)</label>
                    <input
                      type="text"
                      required
                      value={newTxAmount}
                      onChange={(e) => setNewTxAmount(e.target.value)}
                      className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold">Billing Address</label>
                    <input
                      type="text"
                      required
                      value={newTxBilling}
                      onChange={(e) => setNewTxBilling(e.target.value)}
                      className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold">Shipping Address</label>
                    <input
                      type="text"
                      required
                      value={newTxShipping}
                      onChange={(e) => setNewTxShipping(e.target.value)}
                      className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: SELLER INFORMATION */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                <div className="flex justify-between items-center border-b border-slate-800/60 pb-1.5">
                  <span className="font-bold text-[11px] text-amber-400 uppercase tracking-wider">4. Seller Information</span>
                  <span className="text-[10px] text-slate-500 font-mono">Merchant Owner</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold">Seller Name</label>
                    <input
                      type="text"
                      required
                      value={newSellerName}
                      onChange={(e) => setNewSellerName(e.target.value)}
                      className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold">Seller ID</label>
                    <input
                      type="text"
                      required
                      value={newSellerId}
                      onChange={(e) => setNewSellerId(e.target.value)}
                      className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 font-semibold">Seller Location</label>
                    <input
                      type="text"
                      required
                      value={newSellerLocation}
                      onChange={(e) => setNewSellerLocation(e.target.value)}
                      className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold cursor-pointer shadow-lg shadow-blue-500/20"
                >
                  Submit Order to TrustGraph AI
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
