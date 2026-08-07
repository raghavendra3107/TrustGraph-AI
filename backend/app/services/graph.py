import networkx as nx
from sqlalchemy.orm import Session
from app.models.models import Transaction, SystemSetting
from typing import Dict, List, Any

class GraphAnalyzer:
    @staticmethod
    def get_transaction_graph(db: Session, transaction_id: str) -> Dict[str, List[Any]]:
        """
        Builds a network graph around a transaction using NetworkX.
        Includes Customer, Seller, Delivery Partner, Device, IP, and Address.
        Exposes fraud rings by linking overlapping entities.
        """
        tx = db.query(Transaction).filter(Transaction.transaction_id == transaction_id).first()
        if not tx:
            return {"nodes": [], "edges": []}

        # Initialize NetworkX undirected graph
        G = nx.Graph()

        # Fetch configurations
        try:
            sensitivity_setting = db.query(SystemSetting).filter(SystemSetting.key == "graph_sensitivity").first()
            graph_sensitivity = sensitivity_setting.value if sensitivity_setting else 50.0
        except Exception:
            graph_sensitivity = 50.0

        # Define primary IDs
        tx_node = f"TX_{tx.transaction_id}"
        cust_node = f"CUST_{tx.user_email}"
        dev_node = f"DEV_{tx.device_id}"
        ip_node = f"IP_{tx.ip_address}"
        addr_node = f"ADDR_{hash(tx.billing_address) % 100000}"
        seller_node = f"SELL_{tx.seller_id}"
        delivery_node = f"DELV_{tx.delivery_partner}"

        # Helper to add node features to networkx node metadata
        def add_nx_node(node_id: str, label: str, name: str, risk: float):
            G.add_node(node_id, label=label, name=name, fraud_risk=risk)

        # 1. Add primary nodes to NetworkX
        add_nx_node(tx_node, "transaction", f"Tx {tx.transaction_id}", tx.fraud_score)
        add_nx_node(cust_node, "customer", tx.user_email, tx.fraud_score * 0.8)
        add_nx_node(dev_node, "device", f"Device: {tx.device_id[:6]}", tx.fraud_score * 0.85)
        add_nx_node(ip_node, "ip", tx.ip_address, tx.fraud_score * 0.9)
        add_nx_node(addr_node, "address", f"Addr: {tx.billing_address[:15]}...", tx.fraud_score * 0.7)
        add_nx_node(seller_node, "seller", f"Seller: {tx.seller_id}", 15.0)
        add_nx_node(delivery_node, "delivery_partner", f"Courier: {tx.delivery_partner}", 10.0)

        # Connect primary transaction to attributes
        G.add_edge(cust_node, tx_node, label="ordered")
        G.add_edge(tx_node, dev_node, label="used_device")
        G.add_edge(tx_node, ip_node, label="routed_from")
        G.add_edge(tx_node, addr_node, label="delivered_to")
        G.add_edge(tx_node, seller_node, label="purchased_from")
        G.add_edge(tx_node, delivery_node, label="shipped_via")

        # 2. Query matching transactions sharing device, IP, address, seller, or customer
        sharing_txs = db.query(Transaction).filter(
            (Transaction.device_id == tx.device_id) |
            (Transaction.ip_address == tx.ip_address) |
            (Transaction.billing_address == tx.billing_address) |
            (Transaction.user_email == tx.user_email) |
            (Transaction.seller_id == tx.seller_id)
        ).filter(Transaction.transaction_id != tx.transaction_id).limit(20).all()

        # Connect linked transactions and overlapping attributes
        for s_tx in sharing_txs:
            s_tx_node = f"TX_{s_tx.transaction_id}"
            s_cust_node = f"CUST_{s_tx.user_email}"
            
            # Add other transactions & customers
            add_nx_node(s_tx_node, "transaction", f"Tx {s_tx.transaction_id}", s_tx.fraud_score)
            add_nx_node(s_cust_node, "customer", s_tx.user_email, s_tx.fraud_score * 0.8)
            G.add_edge(s_cust_node, s_tx_node, label="ordered")

            # Connect details shared
            if s_tx.device_id == tx.device_id:
                G.add_edge(s_tx_node, dev_node, label="shared_device")
            if s_tx.ip_address == tx.ip_address:
                G.add_edge(s_tx_node, ip_node, label="shared_ip")
            if s_tx.billing_address == tx.billing_address:
                G.add_edge(s_tx_node, addr_node, label="shared_address")
            if s_tx.seller_id == tx.seller_id:
                G.add_edge(s_tx_node, seller_node, label="shared_seller")
            if s_tx.user_email == tx.user_email:
                G.add_edge(s_tx_node, cust_node, label="same_customer")

        # Convert NetworkX data to list schema for response output
        nodes_list = []
        for n_id, data in G.nodes(data=True):
            nodes_list.append({
                "id": n_id,
                "label": data.get("label", "unknown"),
                "name": data.get("name", n_id),
                "fraud_risk": data.get("fraud_risk", 0.0)
            })

        edges_list = []
        for source, target, data in G.edges(data=True):
            edges_list.append({
                "source_id": source,
                "target_id": target,
                "label": data.get("label", "linked"),
                "weight": 1.0 if not data.get("label", "").startswith("shared_") else 1.5
            })

        return {
            "nodes": nodes_list,
            "edges": edges_list
        }

    @staticmethod
    def calculate_collusion_score(db: Session, user_email: str, device_id: str, ip_address: str, billing_address: str) -> float:
        """
        Runs NetworkX degree correlation queries to see how heavily shared
        attributes are. Returns a collusion risk score between 0.0 and 100.0.
        """
        # Fetch related transactions
        related_txs = db.query(Transaction).filter(
            (Transaction.device_id == device_id) |
            (Transaction.ip_address == ip_address) |
            (Transaction.billing_address == billing_address)
        ).limit(100).all()

        if not related_txs:
            return 0.0

        # Build NetworkX connectivity map
        G = nx.Graph()
        for tx in related_txs:
            tx_node = f"TX_{tx.transaction_id}"
            user_node = f"CUST_{tx.user_email}"
            dev_node = f"DEV_{tx.device_id}"
            ip_node = f"IP_{tx.ip_address}"
            addr_node = f"ADDR_{hash(tx.billing_address) % 100000}"

            G.add_edge(user_node, tx_node)
            G.add_edge(tx_node, dev_node)
            G.add_edge(tx_node, ip_node)
            G.add_edge(tx_node, addr_node)

        # Collusion indicator is the size and degree of hubs.
        # e.g., if a single Device or IP connects to many different Customer nodes.
        unique_customers = set(n for n in G.nodes() if n.startswith("CUST_"))
        
        device_node = f"DEV_{device_id}"
        ip_node_id = f"IP_{ip_address}"
        
        max_sharing = 0
        if G.has_node(device_node):
            # How many customers are connected to this device node
            # (path of length 2: Device -> Tx -> Customer)
            sharing_customers = set()
            for tx_link in G.neighbors(device_node):
                for cust_link in G.neighbors(tx_link):
                    if cust_link.startswith("CUST_") and cust_link != f"CUST_{user_email}":
                        sharing_customers.add(cust_link)
            max_sharing = max(max_sharing, len(sharing_customers))

        if G.has_node(ip_node_id):
            sharing_customers = set()
            for tx_link in G.neighbors(ip_node_id):
                for cust_link in G.neighbors(tx_link):
                    if cust_link.startswith("CUST_") and cust_link != f"CUST_{user_email}":
                        sharing_customers.add(cust_link)
            max_sharing = max(max_sharing, len(sharing_customers))

        # Compute risk: 0 sharing = 0 score, 1 = 15, 2 = 45, 3 = 75, >=4 = 95
        if max_sharing == 0:
            collusion_score = 10.0
        elif max_sharing == 1:
            collusion_score = 30.0
        elif max_sharing == 2:
            collusion_score = 65.0
        elif max_sharing == 3:
            collusion_score = 85.0
        else:
            collusion_score = 98.0

        return collusion_score

    @staticmethod
    def get_global_fraud_graph(db: Session, limit: int = 40) -> Dict[str, List[Any]]:
        """
        Builds a macro graph of high-risk users and devices for global system representation.
        """
        high_risk_txs = db.query(Transaction).filter(
            Transaction.fraud_score > 40.0
        ).order_by(Transaction.transaction_time.desc()).limit(limit).all()

        G = nx.Graph()

        def add_nx_node(node_id: str, label: str, name: str, risk: float):
            G.add_node(node_id, label=label, name=name, fraud_risk=risk)

        for tx in high_risk_txs:
            tx_id = f"TX_{tx.transaction_id}"
            cust_id = f"CUST_{tx.user_email}"
            dev_id = f"DEV_{tx.device_id}"
            ip_id = f"IP_{tx.ip_address}"
            seller_id = f"SELL_{tx.seller_id}"

            add_nx_node(tx_id, "transaction", f"Tx {tx.transaction_id[:6]}...", tx.fraud_score)
            add_nx_node(cust_id, "customer", tx.user_email, tx.fraud_score * 0.8)
            add_nx_node(dev_id, "device", f"Device {tx.device_id[:6]}", tx.fraud_score * 0.85)
            add_nx_node(ip_id, "ip", tx.ip_address, tx.fraud_score * 0.9)
            add_nx_node(seller_id, "seller", f"Seller {tx.seller_id[:6]}", 15.0)

            G.add_edge(cust_id, tx_id, label="ordered")
            G.add_edge(tx_id, dev_id, label="used_device")
            G.add_edge(tx_id, ip_id, label="routed_from")
            G.add_edge(tx_id, seller_id, label="purchased_from")

        nodes_list = []
        for n_id, data in G.nodes(data=True):
            nodes_list.append({
                "id": n_id,
                "label": data.get("label", "unknown"),
                "name": data.get("name", n_id),
                "fraud_risk": data.get("fraud_risk", 0.0)
            })

        edges_list = []
        for source, target, data in G.edges(data=True):
            edges_list.append({
                "source_id": source,
                "target_id": target,
                "label": data.get("label", "linked"),
                "weight": 1.0
            })

        return {
            "nodes": nodes_list,
            "edges": edges_list
        }

graph_analyzer = GraphAnalyzer()
