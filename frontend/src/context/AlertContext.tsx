import React, { createContext, useState, useEffect, useContext, type ReactNode } from 'react';
import { useAuth } from './AuthContext';

export interface WSAlertData {
  id: number;
  transaction_id: number;
  transaction_code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  fraud_score: number;
  amount: number;
  user_email: string;
  created_at: string;
}

interface AlertContextType {
  wsAlerts: WSAlertData[];
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  clearWSAlerts: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [wsAlerts, setWsAlerts] = useState<WSAlertData[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      setConnectionStatus('disconnected');
      return;
    }

    setConnectionStatus('connecting');
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      setConnectionStatus('connected');
      console.log('Real-time WebSockets alert channel linked.');
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'NEW_ALERT') {
          const newAlert: WSAlertData = payload.data;
          setWsAlerts((prev) => [newAlert, ...prev]);
          
          // Optional: sound chime or visual notification trigger
          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav');
            audio.volume = 0.25;
            audio.play();
          } catch (e) {
            // Audio context security blockage, ignore
          }
        }
      } catch (err) {
        console.error('Failed to parse WebSocket packet:', err);
      }
    };

    socket.onerror = (error) => {
      console.error('Alert WebSocket encountered an error:', error);
      setConnectionStatus('disconnected');
    };

    socket.onclose = () => {
      console.log('Alert WebSocket disconnected.');
      setConnectionStatus('disconnected');
    };

    return () => {
      socket.close();
    };
  }, [isAuthenticated]);

  const clearWSAlerts = () => {
    setWsAlerts([]);
  };

  return (
    <AlertContext.Provider value={{
      wsAlerts,
      connectionStatus,
      clearWSAlerts
    }}>
      {children}
    </AlertContext.Provider>
  );
};

export const useAlerts = (): AlertContextType => {
  const context = useContext(AlertContext);
  if (context === undefined) {
    throw new Error('useAlerts must be used within an AlertProvider');
  }
  return context;
};
export default AlertContext;
