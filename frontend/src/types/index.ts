export interface User {
  id: number;
  email: string;
  full_name: string | null;
  role: 'admin' | 'analyst' | 'merchant';
  is_active: boolean;
  created_at: string;
}

export interface Transaction {
  id: number;
  transaction_id: string;
  user_email: string;
  amount: number;
  currency: string;
  merchant_category: string;
  transaction_time: string;
  ip_address: string;
  device_id: string;
  card_hash: string;
  billing_address: string;
  shipping_address: string;
  fraud_score: number;
  is_flagged: boolean;
  status: 'approved' | 'flagged' | 'blocked' | 'refunded';
  risk_explanation: string | null;
  created_at: string;
  appeal?: Appeal;
}

export interface Appeal {
  id: number;
  transaction_id: number;
  user_email: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  analyst_feedback: string | null;
  created_at: string;
  updated_at: string;
  transaction?: Transaction;
}

export interface Alert {
  id: number;
  transaction_id: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  is_resolved: boolean;
  created_at: string;
  transaction?: Transaction;
}

export interface GraphNode {
  id: string;
  label: 'user' | 'device' | 'card' | 'transaction' | 'address';
  name: string;
  fraud_risk: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
  weight: number;
}

export interface SuspiciousFraudCluster {
  cluster_id: number;
  customers: string[];
  size: number;
  average_fraud_risk: number;
  max_fraud_risk: number;
  shared_attributes: string[];
  risk_level: 'low' | 'medium' | 'high';
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  collusion_score?: number;
  connected_accounts?: string[];
  suspicious_fraud_clusters?: SuspiciousFraudCluster[];
}

export interface MonthlyTrend {
  name: string;
  transactions: number;
  fraud: number;
}

export interface RiskDistribution {
  range: string;
  count: number;
}

export interface DashboardStats {
  total_transactions: number;
  approved_transactions: number;
  blocked_transactions: number;
  pending_reviews: number;
  total_appeals: number;
  fraud_rate: number;
  high_risk_transactions: number;
  pending_appeals: number;
  active_alerts: number;
  revenue_at_risk: number;
  monthly_trends: MonthlyTrend[];
  risk_distribution: RiskDistribution[];
}
