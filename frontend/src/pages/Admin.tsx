import React, { useEffect, useState } from 'react';
import { graphService, adminService } from '../services/api';
import type { GraphData, User } from '../types';
import { GraphVisualizer } from '../components/GraphVisualizer';
import { Sliders, Cpu, Activity, Database, Check, Store, Plus, Power, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Admin: React.FC = () => {
  const { user } = useAuth();

  if (user?.role !== 'admin') {
    return (
      <div className="p-8 flex-1 min-w-0 flex items-center justify-center text-xs text-rose-500 font-mono">
        Access Denied: Admin privileges required.
      </div>
    );
  }

  const [globalGraph, setGlobalGraph] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sensitivity, setSensitivity] = useState<number>(70);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Merchant Management states
  const [merchants, setMerchants] = useState<User[]>([]);
  const [isMerchantsLoading, setIsMerchantsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [merchantEmail, setMerchantEmail] = useState('');
  const [merchantPassword, setMerchantPassword] = useState('');
  const [merchantStoreName, setMerchantStoreName] = useState('');
  const [merchantSellerId, setMerchantSellerId] = useState('');
  const [merchantCategory, setMerchantCategory] = useState('Electronics');
  const [merchantLocation, setMerchantLocation] = useState('Cupertino, USA');
  const [formError, setFormError] = useState('');

  const fetchMerchants = async () => {
    try {
      const data = await adminService.getMerchants();
      setMerchants(data);
    } catch (err) {
      console.error('Failed to load merchants:', err);
    } finally {
      setIsMerchantsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role !== 'admin') return;
    const fetchGlobalGraph = async () => {
      try {
        const network = await graphService.getGlobal(35);
        setGlobalGraph(network);
      } catch (err) {
        console.error('Failed to load global fraud graph:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGlobalGraph();
    fetchMerchants();
  }, []);

  const handleSaveSensitivity = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleCreateMerchant = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!merchantEmail || !merchantPassword || !merchantSellerId || !merchantStoreName) {
      setFormError('Please fill out all required merchant fields.');
      return;
    }
    try {
      await adminService.createMerchant({
        email: merchantEmail,
        password: merchantPassword,
        seller_name: merchantStoreName,
        full_name: `${merchantStoreName} Manager`,
        seller_id: merchantSellerId,
        assigned_category: merchantCategory,
        seller_location: merchantLocation
      });
      setShowAddModal(false);
      setMerchantEmail('');
      setMerchantPassword('');
      setMerchantStoreName('');
      setMerchantSellerId('');
      await fetchMerchants();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Failed to create merchant account.');
    }
  };

  const handleToggleMerchantStatus = async (m: User) => {
    try {
      await adminService.updateMerchant(m.id, { is_active: !m.is_active });
      await fetchMerchants();
    } catch (err) {
      console.error('Failed to toggle merchant status:', err);
    }
  };

  return (
    <div className="p-8 flex-1 min-w-0 overflow-y-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100">System Admin Control Center</h2>
        <p className="text-xs text-slate-400 mt-1">
          Manage merchant store accounts, adjust AI engine thresholds, and inspect global fraud network relationships.
        </p>
      </div>

      {/* Merchant Management Section */}
      <div className="glass-panel rounded-xl p-6 space-y-4 border border-slate-800">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <Store size={18} className="text-blue-400" />
              <span>Registered Merchant Accounts</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Admin manages merchant accounts, assigns unique Seller IDs, and configures active store status.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Merchant Store</span>
          </button>
        </div>

        {isMerchantsLoading ? (
          <div className="py-8 text-center text-xs text-slate-500">Loading merchant registry...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/60 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Store Name</th>
                  <th className="py-2.5 px-3">Seller ID</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Location</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {merchants.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-100">{m.seller_name || m.full_name || 'Merchant'}</td>
                    <td className="py-2.5 px-3 font-mono text-blue-400 text-[11px]">{m.seller_id || 'SELL_DEFAULT'}</td>
                    <td className="py-2.5 px-3 text-slate-300">{m.email}</td>
                    <td className="py-2.5 px-3 text-slate-400">{m.assigned_category || 'Electronics'}</td>
                    <td className="py-2.5 px-3 text-slate-400">{m.seller_location || 'Global'}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        m.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {m.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleToggleMerchantStatus(m)}
                        className={`px-2.5 py-1 rounded text-[10px] font-semibold flex items-center gap-1 ml-auto cursor-pointer transition-all ${
                          m.is_active 
                            ? 'bg-rose-950/40 hover:bg-rose-900/40 text-rose-400 border border-rose-800/40' 
                            : 'bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-800/40'
                        }`}
                      >
                        <Power size={11} />
                        <span>{m.is_active ? 'Disable' : 'Enable'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Left Column: System controls */}
        <div className="xl:col-span-1 space-y-6">
          {/* Machine learning configs */}
          <div className="glass-panel rounded-xl p-6 space-y-5">
            <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
              <Cpu size={16} className="text-blue-400" />
              <span>Machine Learning Settings</span>
            </h3>

            <div className="space-y-4 text-xs">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>Block Threshold Sensitivity</span>
                  <span className="font-mono text-blue-400 text-xs">{sensitivity}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="95"
                  value={sensitivity}
                  onChange={(e) => setSensitivity(parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <p className="text-[10px] text-slate-500 leading-normal">
                  Transactions with scores higher than this threshold are blocked immediately. Flagged states evaluate below.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleSaveSensitivity}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  {saveSuccess ? (
                    <>
                      <Check size={14} />
                      <span>Configurations Saved</span>
                    </>
                  ) : (
                    <span>Save AI Configurations</span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Infrastructure Metrics */}
          <div className="glass-panel rounded-xl p-6 space-y-5">
            <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
              <Sliders size={16} className="text-indigo-400" />
              <span>Platform Specifications</span>
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
                <span className="text-slate-400 flex items-center gap-2">
                  <Database size={13} />
                  <span>DB Connection status</span>
                </span>
                <span className="font-semibold text-emerald-400">SQLite / PostgreSQL</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
                <span className="text-slate-400 flex items-center gap-2">
                  <Activity size={13} />
                  <span>Broker Response Latency</span>
                </span>
                <span className="font-mono text-slate-300">12ms</span>
              </div>
              <div className="flex justify-between items-center pb-1">
                <span className="text-slate-400 flex items-center gap-2">
                  <Cpu size={13} />
                  <span>ML Model Version</span>
                </span>
                <span className="font-mono text-slate-300">v4.1-IsolationForest</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Global Graph View */}
        <div className="xl:col-span-2">
          {isLoading ? (
            <div className="h-[460px] glass-panel rounded-xl flex items-center justify-center text-xs text-slate-500">
              Generating global cluster map...
            </div>
          ) : globalGraph ? (
            <GraphVisualizer graphData={globalGraph} height={420} />
          ) : (
            <div className="h-[460px] glass-panel rounded-xl flex items-center justify-center text-xs text-slate-500">
              No macro connection data loaded.
            </div>
          )}
        </div>
      </div>

      {/* Add Merchant Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 space-y-4 border border-slate-800 shadow-2xl relative">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Store size={16} className="text-blue-400" />
                <span>Add Merchant Account</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <ShieldAlert size={14} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateMerchant} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Store / Seller Name</label>
                <input
                  type="text"
                  required
                  placeholder="Sony Store"
                  value={merchantStoreName}
                  onChange={(e) => {
                    setMerchantStoreName(e.target.value);
                    if (!merchantSellerId) {
                      setMerchantSellerId(`SELL_${e.target.value.toUpperCase().replace(/\s+/g, '_')}`);
                    }
                  }}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Seller ID</label>
                <input
                  type="text"
                  required
                  placeholder="SELL_SONY_STORE"
                  value={merchantSellerId}
                  onChange={(e) => setMerchantSellerId(e.target.value)}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 outline-none font-mono focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Merchant Email</label>
                  <input
                    type="email"
                    required
                    placeholder="sony@trustgraph.ai"
                    value={merchantEmail}
                    onChange={(e) => setEmailValue(e.target.value, setMerchantEmail)}
                    className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={merchantPassword}
                    onChange={(e) => setMerchantPassword(e.target.value)}
                    className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Product Category</label>
                  <select
                    value={merchantCategory}
                    onChange={(e) => setMerchantCategory(e.target.value)}
                    className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 outline-none focus:border-blue-500"
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="Clothing">Clothing</option>
                    <option value="Digital Goods">Digital Goods</option>
                    <option value="Gift Cards">Gift Cards</option>
                    <option value="Jewelry">Jewelry</option>
                    <option value="Travel">Travel</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Seller Location</label>
                  <input
                    type="text"
                    placeholder="Tokyo, Japan"
                    value={merchantLocation}
                    onChange={(e) => setMerchantLocation(e.target.value)}
                    className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-all cursor-pointer shadow-lg shadow-blue-500/20"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  function setEmailValue(val: string, setter: React.Dispatch<React.SetStateAction<string>>) {
    setter(val);
  }
};
export default Admin;
