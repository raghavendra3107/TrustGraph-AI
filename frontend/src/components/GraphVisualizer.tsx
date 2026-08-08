import React, { useRef, useEffect, useState } from 'react';
import type { GraphData, GraphNode, GraphEdge } from '../types';

interface GraphVisualizerProps {
  graphData: GraphData;
  height?: number;
  onNodeSelect?: (node: GraphNode) => void;
}

interface HierarchyNode extends GraphNode {
  x: number;
  y: number;
  layer: number; // 0=Customer, 1=Transaction (Center), 2=Attributes, 3=Shared Customers
  category: 'customer' | 'transaction' | 'product' | 'merchant' | 'ip' | 'device' | 'billing' | 'shipping' | 'shared_customer';
}

interface RenderEdge {
  sourceNode: HierarchyNode;
  targetNode: HierarchyNode;
  label: string;
  isSuspicious: boolean;
}

export const GraphVisualizer: React.FC<GraphVisualizerProps> = ({ 
  graphData, 
  height = 430, 
  onNodeSelect 
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredNode, setHoveredNode] = useState<HierarchyNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<HierarchyNode | null>(null);
  const [viewMode, setViewMode] = useState<'investigation' | 'global'>('investigation');

  const nodesRef = useRef<HierarchyNode[]>([]);
  const edgesRef = useRef<RenderEdge[]>([]);
  const draggingNodeRef = useRef<HierarchyNode | null>(null);

  const getEdgeSourceId = (e: GraphEdge) => e.source_id || e.source;
  const getEdgeTargetId = (e: GraphEdge) => e.target_id || e.target;

  // Build Fixed Hierarchical Layout
  useEffect(() => {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
      nodesRef.current = [];
      edgesRef.current = [];
      return;
    }

    const canvasWidth = 750;

    // 1. Identify Central Transaction Node
    let txNode = graphData.nodes.find(n => n.label === 'transaction');
    if (!txNode) {
      txNode = graphData.nodes[0];
    } else {
      // Pick highest risk transaction if multiple
      const txNodes = graphData.nodes.filter(n => n.label === 'transaction');
      txNode = txNodes.reduce((max, n) => (n.fraud_risk > max.fraud_risk ? n : max), txNodes[0]);
    }

    // 2. Identify Focal Customer
    let focalCustomer = graphData.nodes.find(n => n.label === 'customer' || n.label === 'user');
    if (!focalCustomer) {
      const custEdge = graphData.edges.find(e => getEdgeSourceId(e) === txNode!.id || getEdgeTargetId(e) === txNode!.id);
      if (custEdge) {
        const otherId = getEdgeSourceId(custEdge) === txNode!.id ? getEdgeTargetId(custEdge) : getEdgeSourceId(custEdge);
        focalCustomer = graphData.nodes.find(n => n.id === otherId);
      }
    }

    // Categorize attribute nodes connected to Transaction
    const connectedEdges = graphData.edges.filter(e => getEdgeSourceId(e) === txNode!.id || getEdgeTargetId(e) === txNode!.id);
    const connectedNodeIds = new Set<string>();
    connectedEdges.forEach(e => {
      connectedNodeIds.add(getEdgeSourceId(e));
      connectedNodeIds.add(getEdgeTargetId(e));
    });
    connectedNodeIds.delete(txNode.id);
    if (focalCustomer) connectedNodeIds.delete(focalCustomer.id);

    const productNode = graphData.nodes.find(n => n.label === 'product' && connectedNodeIds.has(n.id));
    const merchantNode = graphData.nodes.find(n => n.label === 'merchant' && connectedNodeIds.has(n.id));
    const ipNode = graphData.nodes.find(n => n.label === 'ip' && connectedNodeIds.has(n.id));
    const deviceNode = graphData.nodes.find(n => n.label === 'device' && connectedNodeIds.has(n.id));
    const billingNode = graphData.nodes.find(n => n.label === 'address' && n.name.toLowerCase().includes('bill') && connectedNodeIds.has(n.id));
    const shippingNode = graphData.nodes.find(n => (n.label === 'address' && !n.name.toLowerCase().includes('bill') && connectedNodeIds.has(n.id)) || (n.label === 'address' && n.id !== billingNode?.id && connectedNodeIds.has(n.id)));

    const positioned: HierarchyNode[] = [];

    // LEVEL 0: Top Customer (y = 40)
    if (focalCustomer) {
      positioned.push({
        ...focalCustomer,
        x: canvasWidth / 2,
        y: 40,
        layer: 0,
        category: 'customer'
      });
    }

    // LEVEL 1: Central Selected Transaction (y = 115)
    const centerTxPos: HierarchyNode = {
      ...txNode,
      x: canvasWidth / 2,
      y: 115,
      layer: 1,
      category: 'transaction'
    };
    positioned.push(centerTxPos);

    // LEVEL 2: 6 Attribute Columns at y = 215
    const attrCols = [
      { node: productNode, label: 'product', category: 'product' as const, x: 85 },
      { node: merchantNode, label: 'merchant', category: 'merchant' as const, x: 195 },
      { node: ipNode, label: 'ip', category: 'ip' as const, x: 310 },
      { node: deviceNode, label: 'device', category: 'device' as const, x: 425 },
      { node: billingNode, label: 'address', category: 'billing' as const, x: 540 },
      { node: shippingNode, label: 'address', category: 'shipping' as const, x: 655 },
    ];

    attrCols.forEach((col) => {
      if (col.node) {
        positioned.push({
          ...col.node,
          x: col.x,
          y: 215,
          layer: 2,
          category: col.category
        });
      }
    });

    // Categorize Layer 3 / Level 4: Collateral/Secondary Customers connected to IP/Device/Addresses
    const level2AttrNodes = positioned.filter(p => p.layer === 2);
    const sharedCustomersMap: { node: GraphNode; connectedAttrId: string }[] = [];

    graphData.nodes.forEach(n => {
      if (n.id === txNode!.id || (focalCustomer && n.id === focalCustomer.id)) return;
      if (n.label === 'customer' || n.label === 'user') {
        let matchedAttrId = '';

        // 1. Direct edge to a Level 2 attribute node in graphData.edges
        const directEdge = graphData.edges.find(e => {
          const s = getEdgeSourceId(e);
          const t = getEdgeTargetId(e);
          if (s === n.id && level2AttrNodes.some(l2 => l2.id === t)) return true;
          if (t === n.id && level2AttrNodes.some(l2 => l2.id === s)) return true;
          return false;
        });

        if (directEdge) {
          const s = getEdgeSourceId(directEdge);
          const t = getEdgeTargetId(directEdge);
          matchedAttrId = s === n.id ? t : s;
        }

        // 2. If no direct edge to Level 2 node, check customer-to-customer edges
        if (!matchedAttrId && focalCustomer) {
          const custCustEdge = graphData.edges.find(e => {
            const s = getEdgeSourceId(e);
            const t = getEdgeTargetId(e);
            return (s === n.id && t === focalCustomer!.id) || (t === n.id && s === focalCustomer!.id);
          });

          if (custCustEdge) {
            const lbl = (custCustEdge.label || '').toLowerCase();
            if (lbl.includes('device')) {
              matchedAttrId = deviceNode?.id || '';
            } else if (lbl.includes('ip')) {
              matchedAttrId = ipNode?.id || '';
            } else if (lbl.includes('shipping') || lbl.includes('ship')) {
              matchedAttrId = shippingNode?.id || '';
            } else if (lbl.includes('billing') || lbl.includes('bill')) {
              matchedAttrId = billingNode?.id || '';
            }
          }
        }

        // 3. Fallback: match any edge from n to any attribute node
        if (!matchedAttrId) {
          const anyEdge = graphData.edges.find(e => getEdgeSourceId(e) === n.id || getEdgeTargetId(e) === n.id);
          if (anyEdge) {
            const s = getEdgeSourceId(anyEdge);
            const t = getEdgeTargetId(anyEdge);
            const candidate = s === n.id ? t : s;
            if (level2AttrNodes.some(l2 => l2.id === candidate)) {
              matchedAttrId = candidate;
            }
          }
        }

        // 4. Ultimate fallback: if deviceNode or ipNode exists, connect to deviceNode / ipNode
        if (!matchedAttrId) {
          matchedAttrId = deviceNode?.id || ipNode?.id || shippingNode?.id || billingNode?.id || '';
        }

        if (matchedAttrId) {
          sharedCustomersMap.push({ node: n, connectedAttrId: matchedAttrId });
        }
      }
    });

    // Group shared customers by connected attribute node to space them horizontally under that node
    const groupedByAttr = new Map<string, typeof sharedCustomersMap>();
    sharedCustomersMap.forEach(sc => {
      if (!groupedByAttr.has(sc.connectedAttrId)) {
        groupedByAttr.set(sc.connectedAttrId, []);
      }
      groupedByAttr.get(sc.connectedAttrId)!.push(sc);
    });

    groupedByAttr.forEach((group, attrId) => {
      const parentAttr = positioned.find(p => p.id === attrId);
      const baseX = parentAttr ? parentAttr.x : 375;
      const count = group.length;

      group.forEach((sc, i) => {
        const offset = count === 1 ? 0 : (i - (count - 1) / 2) * 85;
        const posX = Math.max(70, Math.min(canvasWidth - 70, baseX + offset));

        positioned.push({
          ...sc.node,
          x: posX,
          y: 315,
          layer: 3,
          category: 'shared_customer'
        });
      });
    });

    nodesRef.current = positioned;

    // Construct Explicit investigation edges with exact requirement labels:
    const renderEdges: RenderEdge[] = [];
    const focalCustPos = positioned.find(p => p.layer === 0);

    if (focalCustPos) {
      renderEdges.push({
        sourceNode: focalCustPos,
        targetNode: centerTxPos,
        label: 'placed order',
        isSuspicious: false
      });
    }

    positioned.filter(p => p.layer === 2).forEach(attrNode => {
      let labelName = 'linked';
      if (attrNode.category === 'product') labelName = 'product';
      else if (attrNode.category === 'merchant') labelName = 'seller';
      else if (attrNode.category === 'ip') labelName = 'customer IP';
      else if (attrNode.category === 'device') labelName = 'device';
      else if (attrNode.category === 'billing') labelName = 'billing';
      else if (attrNode.category === 'shipping') labelName = 'shipping';

      renderEdges.push({
        sourceNode: centerTxPos,
        targetNode: attrNode,
        label: labelName,
        isSuspicious: false
      });
    });

    positioned.filter(p => p.layer === 3).forEach(scNode => {
      const parentSc = sharedCustomersMap.find(sc => sc.node.id === scNode.id);
      let parentAttrNode = parentSc ? positioned.find(p => p.id === parentSc.connectedAttrId) : undefined;

      if (!parentAttrNode) {
        parentAttrNode = positioned.find(p => p.category === 'device' || p.category === 'ip');
      }

      if (parentAttrNode) {
        renderEdges.push({
          sourceNode: parentAttrNode,
          targetNode: scNode,
          label: 'shared with',
          isSuspicious: true
        });
      }
    });

    edgesRef.current = renderEdges;
  }, [graphData, height, viewMode]);

  // Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const draw = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const width = canvas.width;
      const heightVal = canvas.height;

      ctx.clearRect(0, 0, width, heightVal);

      // Background Grid
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.35)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, heightVal);
        ctx.stroke();
      }
      for (let y = 0; y < heightVal; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Horizontal Level Divider Lines
      const levelYPositions = [40, 115, 215, 315];
      levelYPositions.forEach((yPos) => {
        ctx.beginPath();
        ctx.moveTo(30, yPos);
        ctx.lineTo(width - 30, yPos);
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.15)';
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // 1. Draw Edges
      edges.forEach(edge => {
        const { sourceNode, targetNode, label, isSuspicious } = edge;

        ctx.beginPath();
        ctx.moveTo(sourceNode.x, sourceNode.y);
        ctx.lineTo(targetNode.x, targetNode.y);

        if (isSuspicious) {
          ctx.strokeStyle = '#ef4444'; // Red dashed edge for suspicious/shared
          ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 4]);
        } else {
          ctx.strokeStyle = '#64748b'; // Solid slate edge for normal relationships
          ctx.lineWidth = 1.8;
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Edge Label Pill
        const midX = (sourceNode.x + targetNode.x) / 2;
        const midY = (sourceNode.y + targetNode.y) / 2;

        ctx.font = 'bold 9px system-ui, sans-serif';
        const textWidth = ctx.measureText(label).width;

        ctx.fillStyle = isSuspicious ? '#450a0a' : '#0f172a';
        ctx.strokeStyle = isSuspicious ? '#dc2626' : '#334155';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(midX - textWidth / 2 - 5, midY - 7, textWidth + 10, 14, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isSuspicious ? '#fca5a5' : '#cbd5e1';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, midX, midY);
      });

      // 2. Draw Nodes
      nodes.forEach(node => {
        const isSelected = selectedNode?.id === node.id;
        const isHovered = hoveredNode?.id === node.id;

        if (node.category === 'transaction') {
          // Central Transaction Prominent Card Box (Width: 200, Height: 66)
          const boxWidth = 210;
          const boxHeight = 68;
          const boxX = node.x - boxWidth / 2;
          const boxY = node.y - boxHeight / 2;

          let riskColor = '#dc2626'; // High Risk (Red)
          let riskBg = 'rgba(220, 38, 38, 0.15)';
          let riskBadge = 'HIGH RISK';

          if (node.fraud_risk < 40) {
            riskColor = '#10b981';
            riskBg = 'rgba(16, 185, 129, 0.15)';
            riskBadge = 'LOW RISK';
          } else if (node.fraud_risk < 70) {
            riskColor = '#f59e0b';
            riskBg = 'rgba(245, 158, 11, 0.15)';
            riskBadge = 'MEDIUM RISK';
          }

          // Card Outer Glow
          ctx.beginPath();
          ctx.roundRect(boxX - 4, boxY - 4, boxWidth + 8, boxHeight + 8, 10);
          ctx.fillStyle = riskBg;
          ctx.fill();

          // Card Main Box
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 8);
          ctx.fillStyle = '#090d16';
          ctx.fill();
          ctx.strokeStyle = riskColor;
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // Text Line 1: TX ID & Risk Badge
          ctx.font = 'bold 11px system-ui, sans-serif';
          ctx.fillStyle = '#f8fafc';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          const txTitle = node.id.startsWith('TX_') ? `TX: ${node.id.replace('TX_', '')}` : node.name;
          ctx.fillText(txTitle, boxX + 10, boxY + 10);

          // Risk Badge Pill (Top Right)
          ctx.font = 'bold 8px system-ui, sans-serif';
          const badgeWidth = ctx.measureText(riskBadge).width;
          ctx.fillStyle = riskBg;
          ctx.strokeStyle = riskColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(boxX + boxWidth - badgeWidth - 16, boxY + 8, badgeWidth + 10, 14, 3);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = riskColor;
          ctx.fillText(riskBadge, boxX + boxWidth - badgeWidth - 11, boxY + 10);

          // Text Line 2: Product Name
          ctx.font = '10px system-ui, sans-serif';
          ctx.fillStyle = '#94a3b8';
          const prodName = node.name || 'Order Item';
          ctx.fillText(prodName.length > 24 ? `${prodName.substring(0, 22)}..` : prodName, boxX + 10, boxY + 28);

          // Text Line 3: Fraud Score %
          ctx.font = 'bold 10px monospace';
          ctx.fillStyle = riskColor;
          ctx.fillText(`Fraud Score: ${node.fraud_risk.toFixed(1)}%`, boxX + 10, boxY + 46);

        } else {
          // Standard Entity Circle Nodes
          const radius = (node.category === 'customer' || node.category === 'shared_customer') ? 22 : 19;
          
          let fill = '#3b82f6'; // Customer (Blue)
          let stroke = '#60a5fa';
          let typeLabel = 'CUST';

          if (node.category === 'product') {
            fill = '#06b6d4'; stroke = '#22d3ee'; typeLabel = 'PROD'; // Cyan
          } else if (node.category === 'merchant') {
            fill = '#a855f7'; stroke = '#c084fc'; typeLabel = 'STORE'; // Purple
          } else if (node.category === 'ip') {
            fill = '#f43f5e'; stroke = '#fb7185'; typeLabel = 'IP'; // Pink/Red
          } else if (node.category === 'device') {
            fill = '#f97316'; stroke = '#fb923c'; typeLabel = 'DEV'; // Orange
          } else if (node.category === 'billing' || node.category === 'shipping') {
            fill = node.category === 'billing' ? '#eab308' : '#10b981';
            stroke = node.category === 'billing' ? '#facc15' : '#34d399';
            typeLabel = node.category === 'billing' ? 'BILL' : 'SHIP'; // Yellow / Green
          } else if (node.category === 'shared_customer') {
            fill = '#ef4444'; stroke = '#f87171'; typeLabel = 'SHARED'; // Red
          }

          // Glow on hover or selection
          if (isHovered || isSelected || node.category === 'shared_customer') {
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 4, 0, Math.PI * 2);
            ctx.fillStyle = node.category === 'shared_customer' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(59, 130, 246, 0.25)';
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#ffffff' : stroke;
          ctx.lineWidth = isSelected ? 3 : 2;
          ctx.stroke();

          // Type Tag Inside Circle
          ctx.font = 'bold 8px system-ui, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(typeLabel, node.x, node.y);

          // Node Text Below Circle (Line 1: Title, Line 2: Value)
          let titleLine = '';
          let valueLine = node.name;

          if (node.category === 'customer' || node.category === 'shared_customer') {
            titleLine = 'Customer';
            valueLine = node.name;
          } else if (node.category === 'device') {
            titleLine = 'Device ID';
            valueLine = node.id.startsWith('DEV_') ? node.id.replace('DEV_', '') : node.name.replace('Device: ', '');
          } else if (node.category === 'ip') {
            titleLine = 'IP Address';
            valueLine = node.name;
          } else if (node.category === 'product') {
            titleLine = 'Product';
            valueLine = node.name;
          } else if (node.category === 'merchant') {
            titleLine = 'Merchant';
            valueLine = node.name;
          } else if (node.category === 'billing' || node.category === 'shipping') {
            titleLine = node.category === 'billing' ? 'Billing' : 'Shipping';
            valueLine = node.name.replace('Ship: ', '').replace('Bill: ', '');
          }

          ctx.font = '8px system-ui, sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(titleLine, node.x, node.y + radius + 3);

          ctx.font = 'bold 9.5px system-ui, sans-serif';
          ctx.fillStyle = node.category === 'shared_customer' ? '#fca5a5' : '#f1f5f9';
          const valTrunc = valueLine.length > 22 ? `${valueLine.substring(0, 20)}..` : valueLine;
          ctx.fillText(valTrunc, node.x, node.y + radius + 14);
        }
      });

      // 3. Empty State Notice if No Level 3 Shared Customers
      const hasSharedCustomers = nodes.some(n => n.layer === 3);
      if (!hasSharedCustomers) {
        ctx.font = 'italic 10px system-ui, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✓ No suspicious shared identifiers detected for this order', width / 2, 360);
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [selectedNode, hoveredNode]);

  // Click & Drag Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const clicked = nodesRef.current.find(n => {
      if (n.category === 'transaction') {
        return Math.abs(n.x - mouseX) <= 105 && Math.abs(n.y - mouseY) <= 34;
      }
      const radius = n.category === 'customer' ? 22 : 19;
      return Math.sqrt((n.x - mouseX) ** 2 + (n.y - mouseY) ** 2) <= radius;
    });

    if (clicked) {
      draggingNodeRef.current = clicked;
      setSelectedNode(clicked);
      if (onNodeSelect) onNodeSelect(clicked);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (draggingNodeRef.current) {
      draggingNodeRef.current.x = mouseX;
      draggingNodeRef.current.y = mouseY;
      return;
    }

    const hover = nodesRef.current.find(n => {
      if (n.category === 'transaction') {
        return Math.abs(n.x - mouseX) <= 105 && Math.abs(n.y - mouseY) <= 34;
      }
      const radius = n.category === 'customer' ? 22 : 19;
      return Math.sqrt((n.x - mouseX) ** 2 + (n.y - mouseY) ** 2) <= radius;
    });
    setHoveredNode(hover || null);
  };

  const handleMouseUpOrLeave = () => {
    draggingNodeRef.current = null;
  };

  return (
    <div className="relative glass-panel rounded-xl overflow-hidden shadow-2xl p-4 border border-slate-800">
      {/* Mode Header & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-bold tracking-wider uppercase text-slate-100 flex items-center gap-2">
            <span>Transaction Investigation Graph</span>
          </h3>

          {/* Mode Switcher */}
          <div className="flex bg-slate-900 rounded p-0.5 border border-slate-800 text-[10px]">
            <button
              onClick={() => setViewMode('investigation')}
              className={`px-2 py-0.5 rounded font-semibold transition-all ${
                viewMode === 'investigation' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Single Investigation View
            </button>
            <button
              onClick={() => setViewMode('global')}
              className={`px-2 py-0.5 rounded font-semibold transition-all ${
                viewMode === 'global' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Global Network
            </button>
          </div>
        </div>
        
        {/* Node & Edge Legend */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-slate-300">
          <span className="flex items-center gap-1 bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> Customer
          </span>
          <span className="flex items-center gap-1 bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block"></span> Product
          </span>
          <span className="flex items-center gap-1 bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span> Merchant
          </span>
          <span className="flex items-center gap-1 bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> IP
          </span>
          <span className="flex items-center gap-1 bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span> Device
          </span>
          <span className="flex items-center gap-1 bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Address
          </span>
          <span className="flex items-center gap-1 bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800 text-rose-400">
            - - Red dashed = Suspicious / Shared
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={750}
        height={height}
        className="w-full rounded-lg bg-slate-950/90 cursor-grab active:cursor-grabbing border border-slate-800/80"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
      />

      {/* Hover Detail Tooltip */}
      {hoveredNode && (
        <div className="absolute bottom-6 left-6 pointer-events-none p-3 rounded-xl border border-slate-700 bg-slate-950/95 text-xs w-56 shadow-2xl animate-fade-in backdrop-blur-md z-10 space-y-1">
          <div className="font-bold text-slate-100 uppercase tracking-wider text-[10px] text-blue-400 flex justify-between">
            <span>{hoveredNode.category.replace('_', ' ')} Node</span>
            <span className="font-mono text-slate-400">L{hoveredNode.layer}</span>
          </div>
          <div className="text-slate-200 font-semibold text-[11px] truncate">{hoveredNode.name}</div>
          <div className="text-[10px] font-mono text-slate-400 truncate">ID: {hoveredNode.id}</div>
          <div className="pt-1 flex justify-between items-center border-t border-slate-800 mt-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Fraud Score:</span>
            <span className={`font-mono font-bold ${hoveredNode.fraud_risk >= 70 ? 'text-red-400' : (hoveredNode.fraud_risk >= 40 ? 'text-amber-400' : 'text-emerald-400')}`}>
              {hoveredNode.fraud_risk.toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
export default GraphVisualizer;
