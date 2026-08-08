export interface User {
  id: number;
  email: string;
  full_name: string | null;
  role: 'admin' | 'analyst' | 'merchant';
  is_active: boolean;
  seller_id?: string | null;
  seller_name?: string | null;
  assigned_category?: string | null;
  seller_location?: string | null;
  created_at: string;
}

export interface MerchantCreateData {
  email: string;
  password?: string;
  full_name?: string;
  seller_id: string;
  seller_name: string;
  assigned_category?: string;
  seller_location?: string;
}

export interface MerchantUpdateData {
  full_name?: string;
  seller_id?: string;
  seller_name?: string;
  assigned_category?: string;
  seller_location?: string;
  is_active?: boolean;
}

export interface Transaction {
  id: number;
  transaction_id: string;
  user_email: string;
  amount: number;
  currency: string;
  merchant_category: string;
  product_name?: string;
  product_category?: string;
  seller_name?: string;
  seller_id?: string;
  seller_location?: string;
  customer_id?: string;
  customer_location?: string;
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
  investigation_status?: 'pending' | 'recommended_approve' | 'recommended_reject';
  investigation_notes?: string | null;
  analyst_recommendation?: string | null;
  merchant_final_decision?: string | null;
  merchant_decision_timestamp?: string | null;
  final_order_status?: string | null;
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
  label: 'user' | 'customer' | 'device' | 'card' | 'transaction' | 'address' | 'product' | 'merchant' | 'ip' | string;
  name: string;
  fraud_risk: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  source_id?: string;
  target_id?: string;
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

export interface ProductPerformanceItem {
  product: string;
  orders: number;
  approved: number;
  flagged: number;
  blocked: number;
  fraud_rate: number;
}

export interface FraudReviewSummary {
  pending_analyst_reviews: number;
  analyst_recommended_approval: number;
  analyst_recommended_rejection: number;
  merchant_decisions_completed: number;
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
  monthly_trends: any[];
  risk_distribution: RiskDistribution[];
  flagged_transactions?: number;
  approval_rate?: number;
  product_performance?: ProductPerformanceItem[];
  fraud_review_summary?: FraudReviewSummary;
}
