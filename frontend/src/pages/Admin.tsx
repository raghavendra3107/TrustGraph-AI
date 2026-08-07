import React, { useEffect, useState } from 'react';
import { graphService } from '../services/api';
import type { GraphData } from '../types';
import { GraphVisualizer } from '../components/GraphVisualizer';
import { Sliders, Cpu, Activity, Database, Check } from 'lucide-react';

export const Admin: React.FC = () => {
  const [globalGraph, setGlobalGraph] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sensitivity, setSensitivity] = useState<number>(70);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
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
  }, []);

  const handleSaveSensitivity = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="p-8 flex-1 min-w-0 overflow-y-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100">System Admin Control Center</h2>
        <p className="text-xs text-slate-400 mt-1">
          Adjust AI engine thresholds, manage network database integrations, and map macro level connection clusters.
        </p>
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
                <span className="font-semibold text-emerald-400">PostgreSQL (Connected)</span>
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
    </div>
  );
};
export default Admin;
