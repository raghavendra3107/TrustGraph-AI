import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Terminal, Lock, Mail, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.detail || 
        'Authorization failed. Please check credentials.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadDemoUser = (userRole: 'admin' | 'analyst' | 'merchant') => {
    if (userRole === 'admin') {
      setEmail('admin@trustgraph.ai');
      setPassword('admin123');
    } else if (userRole === 'analyst') {
      setEmail('analyst@trustgraph.ai');
      setPassword('analyst123');
    } else {
      setEmail('merchant@trustgraph.ai');
      setPassword('merchant123');
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-slate-950 px-4 overflow-hidden">
      {/* Dynamic background lights */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        <div className="flex justify-center items-center gap-3 mb-8">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/10">
            <Terminal size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white leading-none">
              TrustGraph <span className="text-blue-500">AI</span>
            </h1>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mt-0.5">
              Enterprise Fraud Analytics
            </span>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-8 shadow-2xl relative">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-100">Sign In</h2>
            <p className="text-xs text-slate-400 mt-1.5">
              Access the analytics engine and monitor transactional integrity.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-xs font-semibold flex items-center gap-2">
              <ShieldAlert size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@trustgraph.ai"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Account Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer shadow-lg shadow-blue-600/10"
            >
              {isLoading ? 'Authorizing Session...' : 'Secure Authorization'}
              {!isLoading && <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />}
            </button>
          </form>

          {/* Quick Seed accounts login */}
          <div className="mt-8 pt-6 border-t border-slate-800/60">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3 text-center">
              Quick Connect Demo Accounts
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => loadDemoUser('admin')}
                className="py-2 px-1 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/30 text-[10px] font-bold text-slate-300 transition-all cursor-pointer text-center"
              >
                Admin
              </button>
              <button
                onClick={() => loadDemoUser('analyst')}
                className="py-2 px-1 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/30 text-[10px] font-bold text-slate-300 transition-all cursor-pointer text-center"
              >
                Analyst
              </button>
              <button
                onClick={() => loadDemoUser('merchant')}
                className="py-2 px-1 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/30 text-[10px] font-bold text-slate-300 transition-all cursor-pointer text-center"
              >
                Merchant
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Login;
