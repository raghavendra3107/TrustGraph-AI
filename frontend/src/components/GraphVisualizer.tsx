import React, { useRef, useEffect, useState } from 'react';
import type { GraphData, GraphNode } from '../types';

interface GraphVisualizerProps {
  graphData: GraphData;
  height?: number;
  onNodeSelect?: (node: GraphNode) => void;
}

interface PhysicsNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export const GraphVisualizer: React.FC<GraphVisualizerProps> = ({ 
  graphData, 
  height = 400, 
  onNodeSelect 
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredNode, setHoveredNode] = useState<PhysicsNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<PhysicsNode | null>(null);
  const nodesRef = useRef<PhysicsNode[]>([]);
  const draggingNodeRef = useRef<PhysicsNode | null>(null);
  
  // Transform graphData to physics nodes on change
  useEffect(() => {
    const initializedNodes = graphData.nodes.map((node, i) => {
      // Find existing coordinates if re-rendering, otherwise space randomly
      const existing = nodesRef.current.find(n => n.id === node.id);
      const angle = (i / graphData.nodes.length) * Math.PI * 2;
      const radius = 120 + Math.random() * 50;
      
      return {
        ...node,
        x: existing?.x ?? (400 + Math.cos(angle) * radius),
        y: existing?.y ?? (200 + Math.sin(angle) * radius),
        vx: 0,
        vy: 0
      };
    });
    nodesRef.current = initializedNodes;
  }, [graphData]);

  // Run Physics & Simulation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const runSimulation = () => {
      const nodes = nodesRef.current;
      const edges = graphData.edges;
      const width = canvas.width;
      const heightVal = canvas.height;

      // 1. Apply Forces
      // Repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          
          if (dist < 250) {
            // Repulsion force
            const force = (250 - dist) * 0.05;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            
            if (n1 !== draggingNodeRef.current) {
              n1.vx -= fx;
              n1.vy -= fy;
            }
            if (n2 !== draggingNodeRef.current) {
              n2.vx += fx;
              n2.vy += fy;
            }
          }
        }
      }

      // Attraction along edges (spring forces)
      edges.forEach(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        if (!sourceNode || !targetNode) return;

        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        
        // Target distance for link is 120
        const desiredDist = 120;
        const force = (dist - desiredDist) * 0.03 * edge.weight;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (sourceNode !== draggingNodeRef.current) {
          sourceNode.vx += fx;
          sourceNode.vy += fy;
        }
        if (targetNode !== draggingNodeRef.current) {
          targetNode.vx -= fx;
          targetNode.vy -= fy;
        }
      });

      // Gravity force pulling towards canvas center
      const centerX = width / 2;
      const centerY = heightVal / 2;
      nodes.forEach(node => {
        if (node === draggingNodeRef.current) return;
        const dx = centerX - node.x;
        const dy = centerY - node.y;
        node.vx += dx * 0.005;
        node.vy += dy * 0.005;
      });

      // 2. Update Positions with damping
      nodes.forEach(node => {
        if (node === draggingNodeRef.current) return;
        node.x += node.vx;
        node.y += node.vy;
        
        // Damping
        node.vx *= 0.82;
        node.vy *= 0.82;

        // Keep boundaries
        node.x = Math.max(25, Math.min(width - 25, node.x));
        node.y = Math.max(25, Math.min(heightVal - 25, node.y));
      });

      // 3. Draw Canvas
      ctx.clearRect(0, 0, width, heightVal);

      // Draw Edges (Lines)
      edges.forEach(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        if (!sourceNode || !targetNode) return;

        ctx.beginPath();
        ctx.moveTo(sourceNode.x, sourceNode.y);
        ctx.lineTo(targetNode.x, targetNode.y);
        
        // Highlight edge color depending on transaction fraud score
        const isHighRisk = (sourceNode.fraud_risk > 60 || targetNode.fraud_risk > 60);
        ctx.strokeStyle = isHighRisk ? 'rgba(239, 68, 68, 0.45)' : 'rgba(148, 163, 184, 0.2)';
        ctx.lineWidth = isHighRisk ? 2.5 : 1.2;
        ctx.stroke();

        // Draw edge label in middle of connection
        if (isHighRisk || edge.label.startsWith("shared_")) {
          const midX = (sourceNode.x + targetNode.x) / 2;
          const midY = (sourceNode.y + targetNode.y) / 2;
          ctx.font = '9px monospace';
          ctx.fillStyle = edge.label.startsWith("shared_") ? '#f87171' : '#94a3b8';
          ctx.textAlign = 'center';
          ctx.fillText(edge.label, midX, midY - 4);
        }
      });

      // Draw Nodes (Circles)
      nodes.forEach(node => {
        ctx.beginPath();
        // Base node radius
        const radius = node.label === 'transaction' ? 22 : 18;
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);

        // Styling based on node type
        let fillStyle = '#3b82f6'; // User (Blue)
        let strokeStyle = '#60a5fa';
        
        if (node.label === 'transaction') {
          // Dark red for high risk, light for low
          if (node.fraud_risk >= 70) {
            fillStyle = '#ef4444'; // Critical (Red)
            strokeStyle = '#f87171';
          } else if (node.fraud_risk >= 40) {
            fillStyle = '#f59e0b'; // Medium (Orange)
            strokeStyle = '#fbbf24';
          } else {
            fillStyle = '#10b981'; // Low (Green)
            strokeStyle = '#34d399';
          }
        } else if (node.label === 'device') {
          fillStyle = '#8b5cf6'; // Violet
          strokeStyle = '#a78bfa';
        } else if (node.label === 'card') {
          fillStyle = '#ec4899'; // Pink
          strokeStyle = '#f472b6';
        } else if (node.label === 'address') {
          fillStyle = '#eab308'; // Yellow
          strokeStyle = '#facc15';
        }

        // Draw shadow effect for selected/hovered nodes
        const isHovered = hoveredNode && hoveredNode.id === node.id;
        const isSelected = selectedNode && selectedNode.id === node.id;
        
        if (isHovered || isSelected) {
          ctx.shadowBlur = 18;
          ctx.shadowColor = strokeStyle;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = fillStyle;
        ctx.fill();
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = isSelected ? 4 : 2;
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset

        // Draw node name label
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.fillText(node.name.length > 14 ? `${node.name.substring(0, 12)}..` : node.name, node.x, node.y + 4);

        // Subtitle (Node Type)
        ctx.font = '7px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText(node.label.toUpperCase(), node.x, node.y - 8);
      });

      animationId = requestAnimationFrame(runSimulation);
    };

    animationId = requestAnimationFrame(runSimulation);
    return () => cancelAnimationFrame(animationId);
  }, [graphData, hoveredNode, selectedNode]);

  // Handle Dragging & Selection Click
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Check hit test
    const clickedNode = nodesRef.current.find(node => {
      const dx = node.x - mouseX;
      const dy = node.y - mouseY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const radius = node.label === 'transaction' ? 22 : 18;
      return distance <= radius;
    });

    if (clickedNode) {
      draggingNodeRef.current = clickedNode;
      setSelectedNode(clickedNode);
      if (onNodeSelect) {
        onNodeSelect(clickedNode);
      }
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

    // Check hover
    const hover = nodesRef.current.find(node => {
      const dx = node.x - mouseX;
      const dy = node.y - mouseY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const radius = node.label === 'transaction' ? 22 : 18;
      return distance <= radius;
    });

    setHoveredNode(hover || null);
  };

  const handleMouseUpOrLeave = () => {
    draggingNodeRef.current = null;
  };

  return (
    <div className="relative glass-panel rounded-xl overflow-hidden shadow-2xl p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold tracking-wide uppercase text-slate-400">
          Fraud Ring Investigation Network
        </h3>
        <div className="flex gap-4 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span> User
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span> Risk Tx
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-violet-500"></span> Device
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-pink-500"></span> Card
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-yellow-500"></span> Address
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={750}
        height={height}
        className="w-full rounded bg-slate-900/60 cursor-grab active:cursor-grabbing border border-slate-800/40"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
      />

      {hoveredNode && (
        <div className="absolute bottom-6 left-6 pointer-events-none p-3 rounded-lg border border-white/10 bg-slate-950/90 text-xs w-48 shadow-xl animate-fade-in backdrop-blur-md">
          <div className="font-bold text-slate-200 capitalize">{hoveredNode.label} Details</div>
          <div className="text-[10px] text-slate-400 truncate mt-1">ID: {hoveredNode.id}</div>
          <div className="text-[10px] text-slate-400 truncate">Val: {hoveredNode.name}</div>
          <div className="mt-2 flex justify-between items-center">
            <span className="text-[10px] uppercase font-semibold text-slate-400">Entity Risk:</span>
            <span className={`font-semibold ${hoveredNode.fraud_risk >= 70 ? 'text-red-400' : (hoveredNode.fraud_risk >= 40 ? 'text-yellow-400' : 'text-emerald-400')}`}>
              {hoveredNode.fraud_risk.toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
export default GraphVisualizer;
