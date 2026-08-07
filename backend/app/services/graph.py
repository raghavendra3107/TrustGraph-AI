import hashlib
import networkx as nx
from sqlalchemy.orm import Session
from app.models.models import Transaction, SystemSetting
from typing import Dict, List, Any, Set, Optional


class GraphAnalyzer:
    SHARE_EDGE_LABELS = ("shared_device", "shared_ip", "shared_shipping_address")

    @staticmethod
    def _get_graph_sensitivity(db: Session) -> float:
        try:
            setting = db.query(SystemSetting).filter(SystemSetting.key == "graph_sensitivity").first()
            return setting.value if setting else 50.0
        except Exception:
            return 50.0

    @staticmethod
    def _address_node_id(address: str, prefix: str = "SHIP") -> str:
        digest = hashlib.md5(address.strip().lower().encode()).hexdigest()[:12]
        return f"{prefix}_{digest}"

    @staticmethod
    def _customer_node_id(email: str) -> str:
        return f"CUST_{email}"

    @staticmethod
    def _add_nx_node(G: nx.Graph, node_id: str, label: str, name: str, risk: float) -> None:
        if G.has_node(node_id):
            G.nodes[node_id]["fraud_risk"] = max(G.nodes[node_id].get("fraud_risk", 0.0), risk)
        else:
            G.add_node(node_id, label=label, name=name, fraud_risk=risk)

    @classmethod
    def _build_entity_graph(cls, transactions: List[Transaction]) -> nx.Graph:
        """
        Build a NetworkX graph with Customer, Transaction, Device, IP, and Shipping Address nodes.
        Adds customer-to-customer edges when they share device, IP, or shipping address.
        """
        G = nx.Graph()
        device_customers: Dict[str, Set[str]] = {}
        ip_customers: Dict[str, Set[str]] = {}
        shipping_customers: Dict[str, Set[str]] = {}

        for tx in transactions:
            cust_id = cls._customer_node_id(tx.user_email)
            tx_id = f"TX_{tx.transaction_id}"
            dev_id = f"DEV_{tx.device_id}"
            ip_id = f"IP_{tx.ip_address}"
            ship_id = cls._address_node_id(tx.shipping_address)

            cls._add_nx_node(G, tx_id, "transaction", f"Tx {tx.transaction_id}", tx.fraud_score)
            cls._add_nx_node(G, cust_id, "customer", tx.user_email, tx.fraud_score * 0.8)
            cls._add_nx_node(G, dev_id, "device", f"Device: {tx.device_id[:8]}", tx.fraud_score * 0.85)
            cls._add_nx_node(G, ip_id, "ip", tx.ip_address, tx.fraud_score * 0.9)
            cls._add_nx_node(
                G,
                ship_id,
                "address",
                f"Ship: {tx.shipping_address[:20]}...",
                tx.fraud_score * 0.75,
            )

            G.add_edge(cust_id, tx_id, label="ordered")
            G.add_edge(tx_id, dev_id, label="used_device")
            G.add_edge(tx_id, ip_id, label="routed_from")
            G.add_edge(tx_id, ship_id, label="shipped_to")

            if tx.device_id:
                device_customers.setdefault(tx.device_id, set()).add(tx.user_email)
            if tx.ip_address:
                ip_customers.setdefault(tx.ip_address, set()).add(tx.user_email)
            if tx.shipping_address:
                shipping_customers.setdefault(tx.shipping_address.strip().lower(), set()).add(tx.user_email)

        def link_shared_customers(email_groups: Dict[str, Set[str]], edge_label: str) -> None:
            for emails in email_groups.values():
                email_list = sorted(emails)
                if len(email_list) < 2:
                    continue
                for i in range(len(email_list)):
                    for j in range(i + 1, len(email_list)):
                        c1 = cls._customer_node_id(email_list[i])
                        c2 = cls._customer_node_id(email_list[j])
                        if G.has_node(c1) and G.has_node(c2):
                            if G.has_edge(c1, c2):
                                existing = G[c1][c2].get("label", "")
                                labels = {existing} if existing else set()
                                labels.add(edge_label)
                                G[c1][c2]["label"] = ",".join(sorted(labels))
                                G[c1][c2]["weight"] = 1.0 + (0.5 * len(labels))
                            else:
                                G.add_edge(c1, c2, label=edge_label, weight=1.5)

        link_shared_customers(device_customers, "shared_device")
        link_shared_customers(ip_customers, "shared_ip")
        link_shared_customers(shipping_customers, "shared_shipping_address")

        return G

    @classmethod
    def _serialize_graph(cls, G: nx.Graph) -> Dict[str, List[Any]]:
        nodes_list = []
        for node_id, data in G.nodes(data=True):
            nodes_list.append(
                {
                    "id": node_id,
                    "label": data.get("label", "unknown"),
                    "name": data.get("name", node_id),
                    "fraud_risk": round(float(data.get("fraud_risk", 0.0)), 2),
                }
            )

        edges_list = []
        for source, target, data in G.edges(data=True):
            label = data.get("label", "linked")
            share_count = len([part for part in label.split(",") if part in cls.SHARE_EDGE_LABELS])
            edges_list.append(
                {
                    "source_id": source,
                    "target_id": target,
                    "label": label,
                    "weight": float(
                        data.get("weight", 1.5 if share_count else 1.0)
                    ),
                }
            )

        return {"nodes": nodes_list, "edges": edges_list}

    @classmethod
    def _get_connected_accounts(cls, G: nx.Graph, focal_email: Optional[str]) -> List[str]:
        if not focal_email:
            return []

        focal = cls._customer_node_id(focal_email)
        if not G.has_node(focal):
            return []

        connected: Set[str] = set()
        for neighbor in G.neighbors(focal):
            if neighbor.startswith("CUST_") and neighbor != focal:
                connected.add(neighbor.replace("CUST_", "", 1))
            elif neighbor.startswith("TX_"):
                for linked in G.neighbors(neighbor):
                    if linked.startswith("CUST_") and linked != focal:
                        connected.add(linked.replace("CUST_", "", 1))

        return sorted(connected)

    @classmethod
    def _get_suspicious_fraud_clusters(
        cls, G: nx.Graph, graph_sensitivity: float
    ) -> List[Dict[str, Any]]:
        cust_graph = nx.Graph()
        for node_id, data in G.nodes(data=True):
            if data.get("label") == "customer":
                cust_graph.add_node(node_id, **data)

        for source, target, data in G.edges(data=True):
            if source.startswith("CUST_") and target.startswith("CUST_"):
                label = data.get("label", "")
                if any(part in cls.SHARE_EDGE_LABELS for part in label.split(",")):
                    cust_graph.add_edge(source, target, **data)

        risk_threshold = max(25.0, graph_sensitivity * 0.6)
        clusters: List[Dict[str, Any]] = []

        for idx, component in enumerate(nx.connected_components(cust_graph), start=1):
            if len(component) < 2:
                continue

            customers = [node.replace("CUST_", "", 1) for node in sorted(component)]
            risks = [float(cust_graph.nodes[node].get("fraud_risk", 0.0)) for node in component]
            avg_risk = sum(risks) / len(risks)
            max_risk = max(risks)

            shared_attributes: Set[str] = set()
        for c1, c2, data in cust_graph.edges(data=True):
            if c1 in component and c2 in component:
                for part in data.get("label", "linked").split(","):
                    if part in cls.SHARE_EDGE_LABELS:
                        shared_attributes.add(part)

            suspicious = len(component) >= 2 and (
                avg_risk >= risk_threshold or len(shared_attributes) >= 2
            )
            if not suspicious:
                continue

            clusters.append(
                {
                    "cluster_id": idx,
                    "customers": customers,
                    "size": len(customers),
                    "average_fraud_risk": round(avg_risk, 2),
                    "max_fraud_risk": round(max_risk, 2),
                    "shared_attributes": sorted(shared_attributes),
                    "risk_level": "high" if avg_risk >= 70 else ("medium" if avg_risk >= 40 else "low"),
                }
            )

        clusters.sort(key=lambda c: (c["average_fraud_risk"], c["size"]), reverse=True)
        return clusters

    @classmethod
    def _sharing_count_for_attribute(
        cls, G: nx.Graph, attr_node_id: str, focal_email: str
    ) -> int:
        if not G.has_node(attr_node_id):
            return 0

        sharing_customers: Set[str] = set()
        for tx_link in G.neighbors(attr_node_id):
            if not tx_link.startswith("TX_"):
                continue
            for cust_link in G.neighbors(tx_link):
                if cust_link.startswith("CUST_") and cust_link != cls._customer_node_id(focal_email):
                    sharing_customers.add(cust_link)

        return len(sharing_customers)

    @classmethod
    def _base_collusion_from_sharing(cls, max_sharing: int) -> float:
        if max_sharing == 0:
            return 10.0
        if max_sharing == 1:
            return 30.0
        if max_sharing == 2:
            return 65.0
        if max_sharing == 3:
            return 85.0
        return 98.0

    @classmethod
    def _apply_graph_sensitivity(cls, score: float, graph_sensitivity: float) -> float:
        multiplier = graph_sensitivity / 50.0
        adjusted = score * multiplier
        return round(min(max(adjusted, 0.0), 100.0), 2)

    @classmethod
    def calculate_collusion_score(
        cls,
        db: Session,
        user_email: str,
        device_id: str,
        ip_address: str,
        billing_address: str,
        shipping_address: str = "",
    ) -> float:
        """
        Measure collusion risk from shared Device ID, IP Address, and Shipping Address.
        Returns a score between 0.0 and 100.0.
        """
        graph_sensitivity = cls._get_graph_sensitivity(db)

        filters = [
            Transaction.device_id == device_id,
            Transaction.ip_address == ip_address,
        ]
        if shipping_address:
            filters.append(Transaction.shipping_address == shipping_address)
        if billing_address:
            filters.append(Transaction.billing_address == billing_address)

        from sqlalchemy import or_

        related_txs = db.query(Transaction).filter(or_(*filters)).limit(100).all()
        if not related_txs:
            return 0.0

        G = cls._build_entity_graph(related_txs)

        device_node = f"DEV_{device_id}"
        ip_node = f"IP_{ip_address}"
        ship_node = cls._address_node_id(shipping_address) if shipping_address else None

        sharing_counts = [
            cls._sharing_count_for_attribute(G, device_node, user_email),
            cls._sharing_count_for_attribute(G, ip_node, user_email),
        ]
        if ship_node:
            sharing_counts.append(cls._sharing_count_for_attribute(G, ship_node, user_email))

        max_sharing = max(sharing_counts) if sharing_counts else 0
        base_score = cls._base_collusion_from_sharing(max_sharing)
        return cls._apply_graph_sensitivity(base_score, graph_sensitivity)

    @classmethod
    def _build_analysis_response(
        cls,
        G: nx.Graph,
        collusion_score: float,
        focal_email: Optional[str],
        graph_sensitivity: float,
    ) -> Dict[str, Any]:
        payload = cls._serialize_graph(G)
        payload["collusion_score"] = collusion_score
        payload["connected_accounts"] = cls._get_connected_accounts(G, focal_email)
        payload["suspicious_fraud_clusters"] = cls._get_suspicious_fraud_clusters(
            G, graph_sensitivity
        )
        return payload

    @classmethod
    def get_transaction_graph(cls, db: Session, transaction_id: str) -> Dict[str, Any]:
        """
        Builds a network graph around a transaction using NetworkX.
        Includes Customer, Transaction, Device, IP, and Shipping Address nodes,
        plus direct customer links for shared attributes.
        """
        tx = db.query(Transaction).filter(Transaction.transaction_id == transaction_id).first()
        if not tx:
            return {
                "nodes": [],
                "edges": [],
                "collusion_score": 0.0,
                "connected_accounts": [],
                "suspicious_fraud_clusters": [],
            }

        graph_sensitivity = cls._get_graph_sensitivity(db)

        from sqlalchemy import or_

        sharing_txs = (
            db.query(Transaction)
            .filter(
                or_(
                    Transaction.device_id == tx.device_id,
                    Transaction.ip_address == tx.ip_address,
                    Transaction.shipping_address == tx.shipping_address,
                    Transaction.user_email == tx.user_email,
                )
            )
            .limit(50)
            .all()
        )

        G = cls._build_entity_graph(sharing_txs)
        collusion_score = cls.calculate_collusion_score(
            db=db,
            user_email=tx.user_email,
            device_id=tx.device_id,
            ip_address=tx.ip_address,
            billing_address=tx.billing_address,
            shipping_address=tx.shipping_address,
        )

        return cls._build_analysis_response(
            G, collusion_score, tx.user_email, graph_sensitivity
        )

    @classmethod
    def get_global_fraud_graph(cls, db: Session, limit: int = 40) -> Dict[str, Any]:
        """
        Builds a macro graph of high-risk transactions and their shared-attribute links.
        """
        graph_sensitivity = cls._get_graph_sensitivity(db)
        high_risk_txs = (
            db.query(Transaction)
            .filter(Transaction.fraud_score > 40.0)
            .order_by(Transaction.transaction_time.desc())
            .limit(limit)
            .all()
        )

        if not high_risk_txs:
            return {
                "nodes": [],
                "edges": [],
                "collusion_score": 0.0,
                "connected_accounts": [],
                "suspicious_fraud_clusters": [],
            }

        G = cls._build_entity_graph(high_risk_txs)
        max_collusion = 0.0
        for tx in high_risk_txs:
            score = cls.calculate_collusion_score(
                db=db,
                user_email=tx.user_email,
                device_id=tx.device_id,
                ip_address=tx.ip_address,
                billing_address=tx.billing_address,
                shipping_address=tx.shipping_address,
            )
            max_collusion = max(max_collusion, score)

        return cls._build_analysis_response(G, max_collusion, None, graph_sensitivity)


graph_analyzer = GraphAnalyzer()
