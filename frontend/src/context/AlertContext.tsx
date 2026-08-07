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
        let newAlert: WSAlertData | null = null;
        
        if (payload.type === 'NEW_ALERT') {
          newAlert = payload.data;
        } else if (payload.type === 'NEW_APPEAL') {
          newAlert = {
            id: payload.data.id + 10000, // Avoid key collision
            transaction_id: payload.data.transaction_id,
            transaction_code: payload.data.transaction_code,
            severity: 'medium',
            message: `Dispute Appeal Submitted: "${payload.data.reason}"`,
            fraud_score: 50,
            amount: payload.data.amount || 0,
            user_email: payload.data.user_email,
            created_at: payload.data.created_at
          };
        } else if (payload.type === 'APPEAL_APPROVED') {
          newAlert = {
            id: payload.data.id + 20000,
            transaction_id: payload.data.transaction_id,
            transaction_code: payload.data.transaction_code,
            severity: 'low',
            message: `Appeal APPROVED: ${payload.data.analyst_feedback || 'No comment'}`,
            fraud_score: 0,
            amount: 0,
            user_email: payload.data.user_email,
            created_at: payload.data.updated_at
          };
        } else if (payload.type === 'APPEAL_REJECTED') {
          newAlert = {
            id: payload.data.id + 30000,
            transaction_id: payload.data.transaction_id,
            transaction_code: payload.data.transaction_code,
            severity: 'critical',
            message: `Appeal REJECTED: ${payload.data.analyst_feedback || 'No comment'}`,
            fraud_score: 100,
            amount: 0,
            user_email: payload.data.user_email,
            created_at: payload.data.updated_at
          };
        }
        
        if (newAlert) {
          setWsAlerts((prev) => [newAlert!, ...prev]);
          
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
