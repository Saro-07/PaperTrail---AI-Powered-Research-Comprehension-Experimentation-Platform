import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    fontFamily: 'Inter, -apple-system, sans-serif',
    primaryColor: '#ffffff',
    primaryBorderColor: '#0d9488',
    primaryTextColor: '#0f172a',
    lineColor: '#94a3b8',
    secondaryColor: '#f8fafc',
    tertiaryColor: '#f1f5f9',
  },
});

const STAGE_CONFIG = {
  'Prior Baseline': {
    color: '#0d9488',
    bg: '#f0fdfa',
    border: '#0d9488',
    badgeBg: 'rgba(13, 148, 136, 0.12)',
    label: 'Prior Baseline',
    desc: 'Existing dogma & foundations',
    icon: '🏛️',
  },
  'Bottleneck Identified': {
    color: '#e11d48',
    bg: '#fff1f2',
    border: '#e11d48',
    badgeBg: 'rgba(225, 29, 72, 0.12)',
    label: 'Bottleneck',
    desc: 'The point of failure or friction',
    icon: '⚠️',
  },
  'Core Novelty': {
    color: '#4f46e5',
    bg: '#eef2ff',
    border: '#4f46e5',
    badgeBg: 'rgba(79, 70, 229, 0.12)',
    label: 'Core Novelty',
    desc: 'The key breakthrough mechanism',
    icon: '💡',
  },
  Impact: {
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#16a34a',
    badgeBg: 'rgba(22, 163, 74, 0.12)',
    label: 'Impact',
    desc: 'Empirical gains & resolution',
    icon: '📈',
  },
};

const STAGE_STYLE = {
  'Prior Baseline': 'fill:#f0fdfa,stroke:#0d9488,stroke-width:2px,rx:6px,ry:6px',
  'Bottleneck Identified': 'fill:#fff1f2,stroke:#e11d48,stroke-width:2px,rx:6px,ry:6px',
  'Core Novelty': 'fill:#eef2ff,stroke:#4f46e5,stroke-width:2px,rx:6px,ry:6px',
  Impact: 'fill:#f0fdf4,stroke:#16a34a,stroke-width:2px,rx:6px,ry:6px',
};

function buildMermaidDefinition(nodes) {
  const lines = ['graph TD'];

  nodes.forEach((node, index) => {
    const safeTitle = node.title.replace(/"/g, "'");
    lines.push(`  N${node.node_id}["${index + 1}. ${safeTitle}"]`);
  });

  nodes.forEach((node) => {
    node.connected_to.forEach((targetId) => {
      lines.push(`  N${node.node_id} --> N${targetId}`);
    });
  });

  nodes.forEach((node) => {
    const style = STAGE_STYLE[node.stage] || 'fill:#f3f4f6,stroke:#6b7280';
    lines.push(`  style N${node.node_id} ${style}`);
  });

  return lines.join('\n');
}

function IdeaTree({ spec }) {
  const mermaidContainerRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [renderError, setRenderError] = useState(null);
  const [viewMode, setViewMode] = useState('flowchart'); // 'flowchart' | 'mermaid'
  const [isPlayingTour, setIsPlayingTour] = useState(false);
  const [activeStageFilter, setActiveStageFilter] = useState(null);

  const nodes = spec?.nodes || [];

  // Set default selected node
  useEffect(() => {
    if (nodes.length > 0 && !selectedNode) {
      setSelectedNode(nodes[0]);
    }
  }, [nodes, selectedNode]);

  // Mermaid Render (fallback / toggle view)
  useEffect(() => {
    if (!spec || !mermaidContainerRef.current || viewMode !== 'mermaid') return;

    const definition = buildMermaidDefinition(nodes);
    const diagramId = `idea-tree-raw-${Date.now()}`;

    mermaid
      .render(diagramId, definition)
      .then(({ svg }) => {
        if (mermaidContainerRef.current) {
          mermaidContainerRef.current.innerHTML = svg;
          const nodeElements = mermaidContainerRef.current.querySelectorAll('.node');
          nodeElements.forEach((el, index) => {
            const node = nodes[index];
            if (node) {
              el.style.cursor = 'pointer';
              el.addEventListener('click', () => setSelectedNode(node));
            }
          });
        }
      })
      .catch((err) => {
        setRenderError(err.message || 'Failed to render Mermaid diagram.');
      });
  }, [spec, nodes, viewMode]);

  // Automated Narrative Tour animation
  useEffect(() => {
    if (!isPlayingTour || nodes.length === 0) return;

    const interval = setInterval(() => {
      setSelectedNode((prev) => {
        const currentIndex = nodes.findIndex((n) => n.node_id === prev?.node_id);
        const nextIndex = (currentIndex + 1) % nodes.length;
        return nodes[nextIndex];
      });
    }, 4200);

    return () => clearInterval(interval);
  }, [isPlayingTour, nodes]);

  const toggleTour = () => {
    setIsPlayingTour((prev) => !prev);
  };

  const handleSelectNode = (node) => {
    setSelectedNode(node);
    // don't pause tour abruptly, or allow user inspection
  };

  const handleNextNode = () => {
    if (!selectedNode || nodes.length === 0) return;
    const currentIndex = nodes.findIndex((n) => n.node_id === selectedNode.node_id);
    const nextIndex = (currentIndex + 1) % nodes.length;
    setSelectedNode(nodes[nextIndex]);
  };

  const handlePrevNode = () => {
    if (!selectedNode || nodes.length === 0) return;
    const currentIndex = nodes.findIndex((n) => n.node_id === selectedNode.node_id);
    const prevIndex = (currentIndex - 1 + nodes.length) % nodes.length;
    setSelectedNode(nodes[prevIndex]);
  };

  if (!spec) return null;

  const currentStage = selectedNode ? STAGE_CONFIG[selectedNode.stage] || {} : null;
  const currentIndex = selectedNode ? nodes.findIndex((n) => n.node_id === selectedNode.node_id) : 0;

  return (
    <div className="pt-ideatree-container">
      {/* Top Toolbar: Stage Legend & Actions */}
      <div className="pt-ideatree-toolbar">
        {/* Stage Legend Pills */}
        <div className="pt-stage-legend">
          <span className="pt-legend-title">CONCEPT STAGES:</span>
          <div className="pt-legend-items">
            {Object.entries(STAGE_CONFIG).map(([key, config]) => {
              const isFiltered = activeStageFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`pt-legend-pill-btn ${isFiltered ? 'filter-active' : ''}`}
                  style={{ '--stage-color': config.color }}
                  onClick={() => setActiveStageFilter(isFiltered ? null : key)}
                  title={`Filter by stage: ${config.label}`}
                >
                  <span className="pt-legend-dot" />
                  <span className="pt-legend-name">{config.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Animation & View Mode Controls */}
        <div className="pt-ideatree-actions">
          <button
            type="button"
            className={`pt-tour-btn ${isPlayingTour ? 'touring' : ''}`}
            onClick={toggleTour}
            title="Walk through the concept lineage step-by-step"
          >
            {isPlayingTour ? (
              <>
                <span className="pt-pulse-indicator" />
                <span>Pause Concept Tour</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>Play Concept Tour</span>
              </>
            )}
          </button>

          <div className="pt-view-toggle">
            <button
              type="button"
              className={`pt-toggle-btn ${viewMode === 'flowchart' ? 'active' : ''}`}
              onClick={() => setViewMode('flowchart')}
            >
              Interactive Tree
            </button>
            <button
              type="button"
              className={`pt-toggle-btn ${viewMode === 'mermaid' ? 'active' : ''}`}
              onClick={() => setViewMode('mermaid')}
            >
              Mermaid Raw
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: INTERACTIVE FLOWCHART (HORIZONTAL PIPELINE) */}
      {viewMode === 'flowchart' && (
        <div className="pt-interactive-flowchart-board">
          <div className="pt-flowchart-grid">
            {nodes.map((node, index) => {
              const isSelected = selectedNode?.node_id === node.node_id;
              const stageData = STAGE_CONFIG[node.stage] || { color: '#4f46e5', label: node.stage };
              const isDimmed = activeStageFilter && activeStageFilter !== node.stage;
              const hasNext = index < nodes.length - 1;

              return (
                <div key={node.node_id} className="pt-flow-step-col">
                  {/* Interactive Node Card */}
                  <div
                    className={`pt-flow-node-card ${isSelected ? 'active-node' : ''} ${isDimmed ? 'dimmed' : ''}`}
                    style={{ '--node-accent': stageData.color }}
                    onClick={() => handleSelectNode(node)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleSelectNode(node);
                    }}
                  >
                    <div className="pt-flow-node-header">
                      <span className="pt-node-step-pill">
                        <span className="pt-step-digit">0{index + 1}</span>
                      </span>
                      <span className="pt-node-stage-tag" style={{ color: stageData.color, background: stageData.badgeBg }}>
                        {node.stage}
                      </span>
                    </div>

                    <h4 className="pt-node-card-title">{node.title}</h4>

                    <p className="pt-node-card-snippet">
                      {node.summary.length > 95 ? `${node.summary.substring(0, 95)}…` : node.summary}
                    </p>

                    <div className="pt-node-footer">
                      <span className="pt-click-inspect">
                        {isSelected ? 'Active Selection' : 'Inspect →'}
                      </span>
                    </div>

                    {/* Animated Pulse Ring if Currently Playing in Tour */}
                    {isSelected && isPlayingTour && <div className="pt-tour-pulse-ring" />}
                  </div>

                  {/* Horizontal Arrow Indicator */}
                  {hasNext && (
                    <div className="pt-flow-arrow-indicator" aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: MERMAID DIAGRAM */}
      {viewMode === 'mermaid' && (
        <div className="pt-diagram-mat">
          {renderError && <div className="pt-note">{renderError}</div>}
          <div className="pt-diagram-canvas" ref={mermaidContainerRef} />
        </div>
      )}

      {/* Explication Gloss / Commentary Panel */}
      {selectedNode && (
        <div
          className="pt-ideatree-exegesis"
          style={{ '--accent-color': currentStage?.color || '#0d9488' }}
        >
          <div className="pt-exegesis-header">
            <div className="pt-exegesis-left">
              <span className="pt-exegesis-num">STAGE 0{currentIndex + 1} OF 0{nodes.length}</span>
              <span className="pt-exegesis-stage-badge">
                {selectedNode.stage}
              </span>
            </div>

            <div className="pt-exegesis-controls">
              <button
                type="button"
                className="pt-nav-step-btn"
                onClick={handlePrevNode}
                title="Previous step in narrative"
              >
                ← Prev
              </button>
              <button
                type="button"
                className="pt-nav-step-btn"
                onClick={handleNextNode}
                title="Next step in narrative"
              >
                Next →
              </button>
              <span className="pt-exegesis-ornament">Concept Breakdown</span>
            </div>
          </div>

          <h4 className="pt-exegesis-title">{selectedNode.title}</h4>
          <p className="pt-exegesis-body">{selectedNode.summary}</p>
        </div>
      )}
    </div>
  );
}

export default IdeaTree;