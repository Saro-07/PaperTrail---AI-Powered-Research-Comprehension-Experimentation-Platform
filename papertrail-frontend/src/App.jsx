import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Plot from 'react-plotly.js';
import IdeaTree from './Ideatree';
import CodeSandbox from './CodeSandbox';
import './App.css';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// Built-in authentic specimen for instant demonstration & quick review
const SAMPLE_PAPER = {
  title: 'Focal Loss for Dense Object Detection',
  citation: 'Tsung-Yi Lin, Priya Goyal, Ross Girshick, Kaiming He, Piotr Dollár (ICCV 2017)',
  markdown: '# Focal Loss for Dense Object Detection\n\nBy Tsung-Yi Lin et al.\n...',
  mathSpec: {
    title: 'Modulated Focal Loss Function',
    latex_formula: 'FL(p_t) = -\\alpha_t (1 - p_t)^\\gamma \\log(p_t)',
    concept_explanation:
      'Focal Loss dynamically modulates the standard cross-entropy loss by multiplying it with a factor (1 - pt)^γ. As an easy background candidate becomes well-classified (pt → 1), the modulating factor drops toward zero, suppressing trivial gradients and focusing the optimizer on hard, ambiguous foreground examples.',
    parameters: [
      {
        name: 'gamma',
        symbol: '\\gamma',
        min_val: 0.0,
        max_val: 5.0,
        default_val: 2.0,
        step: 0.1,
        description: 'Focusing parameter: γ=0 yields standard cross entropy. As γ increases, well-classified examples are suppressed by orders of magnitude.',
      },
      {
        name: 'alpha',
        symbol: '\\alpha_t',
        min_val: 0.05,
        max_val: 1.0,
        default_val: 0.25,
        step: 0.05,
        description: 'Class balancing weight: scales the rare foreground class relative to the overwhelming background negatives.',
      },
    ],
    plot_labels: {
      title: 'Loss vs. Probability of Ground Truth Class (p_t)',
      x_label: 'Probability of Ground Truth Class (p_t)',
      y_label: 'Focal Loss FL(p_t)',
    },
    python_formula_function: `import numpy as np
def compute_curve(gamma, alpha):
    pt = np.linspace(0.01, 0.99, 100)
    loss = -alpha * np.power(1.0 - pt, gamma) * np.log(pt)
    return pt.tolist(), loss.tolist()`,
  },
  ideaTreeSpec: {
    nodes: [
      {
        node_id: '1',
        stage: 'Prior Baseline',
        title: 'Two-Stage Detectors & Cross Entropy',
        summary: 'State-of-the-art detectors (Faster R-CNN) separated proposal generation from classification, using a first stage to discard trivial background samples before applying standard cross entropy.',
        connected_to: ['2'],
      },
      {
        node_id: '2',
        stage: 'Bottleneck Identified',
        title: 'Extreme Class Imbalance in One-Stage Detectors',
        summary: 'One-stage detectors (YOLO, SSD) evaluate ~100k dense candidate anchors per image. With 99.9% being trivial background negatives, cumulative minor errors flood and degrade gradient descent.',
        connected_to: ['3'],
      },
      {
        node_id: '3',
        stage: 'Core Novelty',
        title: 'Modulated Focal Loss with Focusing Factor (1-p_t)^γ',
        summary: 'Introduced a continuous down-weighting factor (1 - pt)^γ that diminishes loss on well-classified examples by up to 100x without requiring complex hard-example mining or two-stage heuristics.',
        connected_to: ['4'],
      },
      {
        node_id: '4',
        stage: 'Impact',
        title: 'RetinaNet Outperforms All Two-Stage Architectures',
        summary: 'Powered by Focal Loss, RetinaNet matched the inference speed of single-stage systems while surpassing the accuracy of complex two-stage pipelines on the COCO benchmark (39.1 AP).',
        connected_to: [],
      },
    ],
  },
  algorithmSpec: {
    algorithm_name: 'Vectorized Focal Loss Execution',
    original_pseudocode: `Algorithm: Focal Loss Forward Pass
Input: logits y_pred ∈ ℝᴺ, binary targets y ∈ {0, 1}ᴺ, focusing parameter γ, balancing factor α
1. Compute sigmoid probabilities: p = 1 / (1 + exp(-y_pred))
2. Compute class-aligned probability:
     p_t = p if y == 1 else (1 - p)
3. Compute balancing factor:
     α_t = α if y == 1 else (1 - α)
4. Compute modulating weight:
     modulating_factor = (1 - p_t)^γ
5. Compute raw cross-entropy:
     ce_loss = -log(clip(p_t, 1e-7, 1.0))
6. Compute modulated loss:
     loss = α_t * modulating_factor * ce_loss
Output: scalar mean(loss)`,
    standalone_python_code: `# Focal Loss vs. Standard Cross Entropy Simulation
import numpy as np

def evaluate_detector_batch(num_samples=1000, gamma=2.0, alpha=0.25):
    np.random.seed(42)
    
    # 10 true foreground objects (1%), 990 background negatives (99%)
    targets = np.zeros(num_samples, dtype=int)
    targets[:10] = 1
    
    # Easy negatives have strong negative logits
    logits = np.random.normal(-4.0, 0.8, size=num_samples)
    logits[:10] = np.random.normal(2.5, 0.5, size=10) # Hard foreground
    
    probs = 1.0 / (1.0 + np.exp(-logits))
    p_t = np.where(targets == 1, probs, 1.0 - probs)
    alpha_t = np.where(targets == 1, alpha, 1.0 - alpha)
    
    # Modulated Focal Loss vs Standard Cross Entropy
    ce_loss = -np.log(np.clip(p_t, 1e-7, 1.0))
    focal_loss = alpha_t * np.power(1.0 - p_t, gamma) * ce_loss
    
    return {
        "ce_total": float(np.sum(ce_loss)),
        "ce_bg": float(np.sum(ce_loss[10:])),
        "fl_total": float(np.sum(focal_loss)),
        "fl_bg": float(np.sum(focal_loss[10:])),
        "foreground_ratio": float(np.sum(focal_loss[:10]) / np.sum(focal_loss) * 100)
    }

results = evaluate_detector_batch(gamma=2.0, alpha=0.25)
print(f"Batch Size: 1,000 anchor boxes (10 objects, 990 background)")
print(f"Standard CE: Total={results['ce_total']:.2f} | Background accounts for {results['ce_bg']:.2f}")
print(f"Focal Loss:  Total={results['fl_total']:.2f} | Background reduced to {results['fl_bg']:.2f}")
print(f">> Foreground Gradient Concentration: {results['foreground_ratio']:.1f}% of entire batch loss!")`,
    input_parameters: [],
  },
};

function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('math');
  const [isDragging, setIsDragging] = useState(false);

  const [markdown, setMarkdown] = useState(null);
  const [paperTitle, setPaperTitle] = useState('');
  const [paperCitation, setPaperCitation] = useState('');

  const [mathSpec, setMathSpec] = useState(null);
  const [paramValues, setParamValues] = useState({});
  const [plotData, setPlotData] = useState(null);
  const [plotLoading, setPlotLoading] = useState(false);

  const [ideaTreeSpec, setIdeaTreeSpec] = useState(null);
  const [ideaTreeLoading, setIdeaTreeLoading] = useState(false);

  const [algorithmSpec, setAlgorithmSpec] = useState(null);
  const [algorithmLoading, setAlgorithmLoading] = useState(false);
  const [isSampleMode, setIsSampleMode] = useState(false);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPaperTitle(selected.name.replace(/\.pdf$/i, ''));
      setPaperCitation('Uploaded PDF Document');
      setIsSampleMode(false);
      setError(null);
      setMarkdown(null);
      setMathSpec(null);
      setPlotData(null);
      setIdeaTreeSpec(null);
      setAlgorithmSpec(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
      setPaperTitle(dropped.name.replace(/\.pdf$/i, ''));
      setPaperCitation('Uploaded PDF Document');
      setIsSampleMode(false);
      setError(null);
      setMarkdown(null);
      setMathSpec(null);
      setPlotData(null);
      setIdeaTreeSpec(null);
      setAlgorithmSpec(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please choose or drop a PDF research paper first.');
      return;
    }

    setLoading(true);
    setError(null);
    setMathSpec(null);
    setPlotData(null);
    setIdeaTreeSpec(null);
    setAlgorithmSpec(null);
    setIsSampleMode(false);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const parseResponse = await axios.post(`${BACKEND_URL}/parse-pdf`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const parsedMarkdown = parseResponse.data.markdown;
      setMarkdown(parsedMarkdown);

      const extractResponse = await axios.post(`${BACKEND_URL}/extract-math`, {
        markdown: parsedMarkdown,
      });
      const spec = extractResponse.data;
      setMathSpec(spec);

      const initialValues = {};
      spec.parameters.forEach((p) => {
        initialValues[p.name] = p.default_val;
      });
      setParamValues(initialValues);
    } catch (err) {
      const message = err.response?.data?.detail || err.message || 'Something went wrong during extraction.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Instant Specimen Loader for immediate review
  const handleLoadSample = () => {
    setError(null);
    setIsSampleMode(true);
    setFile(null);
    setPaperTitle(SAMPLE_PAPER.title);
    setPaperCitation(SAMPLE_PAPER.citation);
    setMarkdown(SAMPLE_PAPER.markdown);
    setMathSpec(SAMPLE_PAPER.mathSpec);
    setIdeaTreeSpec(SAMPLE_PAPER.ideaTreeSpec);
    setAlgorithmSpec(SAMPLE_PAPER.algorithmSpec);

    const initialValues = {};
    SAMPLE_PAPER.mathSpec.parameters.forEach((p) => {
      initialValues[p.name] = p.default_val;
    });
    setParamValues(initialValues);

    // Initial plot calculation
    const gamma = initialValues.gamma ?? 2.0;
    const alpha = initialValues.alpha ?? 0.25;
    const x = [];
    const y = [];
    for (let pt = 0.01; pt <= 0.99; pt += 0.01) {
      x.push(parseFloat(pt.toFixed(2)));
      const loss = -alpha * Math.pow(1.0 - pt, gamma) * Math.log(pt);
      y.push(parseFloat(loss.toFixed(4)));
    }
    setPlotData({ x, y });
    setActiveTab('math');
  };

  const handleReset = () => {
    setFile(null);
    setMarkdown(null);
    setMathSpec(null);
    setPlotData(null);
    setIdeaTreeSpec(null);
    setAlgorithmSpec(null);
    setIsSampleMode(false);
    setError(null);
    setActiveTab('math');
  };

  const fetchPlot = useCallback(async () => {
    if (!mathSpec) return;

    if (isSampleMode) {
      // Direct high-performance evaluation for sample specimen
      const gamma = paramValues.gamma ?? 2.0;
      const alpha = paramValues.alpha ?? 0.25;
      const x = [];
      const y = [];
      for (let pt = 0.01; pt <= 0.99; pt += 0.01) {
        x.push(parseFloat(pt.toFixed(2)));
        const loss = -alpha * Math.pow(1.0 - pt, gamma) * Math.log(pt);
        y.push(parseFloat(loss.toFixed(4)));
      }
      setPlotData({ x, y });
      return;
    }

    setPlotLoading(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/evaluate-formula`, {
        python_formula_function: mathSpec.python_formula_function,
        parameters: paramValues,
      });
      setPlotData(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to evaluate formula.');
    } finally {
      setPlotLoading(false);
    }
  }, [mathSpec, paramValues, isSampleMode]);

  useEffect(() => {
    if (mathSpec && Object.keys(paramValues).length > 0) {
      fetchPlot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mathSpec, paramValues]);

  const handleTabChange = async (tab) => {
    setActiveTab(tab);

    if (tab === 'ideatree' && !ideaTreeSpec && markdown && !isSampleMode) {
      setIdeaTreeLoading(true);
      setError(null);
      try {
        const response = await axios.post(`${BACKEND_URL}/extract-idea-tree`, {
          markdown,
        });
        setIdeaTreeSpec(response.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to extract idea tree.');
      } finally {
        setIdeaTreeLoading(false);
      }
    }

    if (tab === 'codesandbox' && !algorithmSpec && markdown && !isSampleMode) {
      setAlgorithmLoading(true);
      setError(null);
      try {
        const response = await axios.post(`${BACKEND_URL}/extract-algorithm`, {
          markdown,
        });
        setAlgorithmSpec(response.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to extract algorithm.');
      } finally {
        setAlgorithmLoading(false);
      }
    }
  };

  const handleSliderChange = (paramName, value) => {
    setParamValues((prev) => ({ ...prev, [paramName]: parseFloat(value) }));
  };

  return (
    <div className="pt-atmosphere">
      <div className="pt-app">
        {/* LANDING VIEW (When no paper is loaded) */}
        {!markdown && (
          <div className="pt-landing-view">
            {/* Header */}
            <header className="pt-masthead">
              <h1 className="pt-main-title">PaperTrail</h1>
              <p className="pt-main-subtitle">
                Automated research paper workbench: extract formulations into reactive models, trace concept genealogies, and execute validated algorithm translations.
              </p>
            </header>

            {error && (
              <div className="pt-error-banner">
                <span className="pt-error-icon">!</span>
                <div>
                  <strong>Processing Error:</strong> {error}
                </div>
              </div>
            )}

            {/* Side-by-side Desktop Grid: Left = Upload, Right = 3 Modules */}
            <div className="pt-landing-split">
              {/* Left Column: Upload Apparatus */}
              <div className="pt-landing-col pt-upload-col">
                <div className="pt-section-header-row">
                  <span className="pt-step-badge">1</span>
                  <h2 className="pt-step-title">Upload Research Paper</h2>
                </div>

                <div className="pt-upload-apparatus">
                  <label
                    className={`pt-folio-dropzone ${isDragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <input type="file" accept="application/pdf" onChange={handleFileChange} />

                    <div className="pt-dropzone-inner">
                      <div className="pt-dropzone-icon-ring">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <path d="M12 18v-6" />
                          <path d="M9 15l3-3 3 3" />
                        </svg>
                      </div>

                      {file ? (
                        <div className="pt-file-loaded">
                          <span className="pt-file-status">READY FOR EXTRACTION</span>
                          <p className="pt-file-title">{file.name}</p>
                          <span className="pt-file-meta">{(file.size / 1024).toFixed(1)} KB • Document Bound</span>
                        </div>
                      ) : (
                        <div className="pt-file-prompt">
                          <p className="pt-drop-callout">Select or drag & drop paper (PDF)</p>
                          <p className="pt-drop-subtext">Automated extraction for equations, lineage & algorithms</p>
                          <div className="pt-drop-tags">
                            <span className="pt-tag-pill">arXiv</span>
                            <span className="pt-tag-pill">IEEE</span>
                            <span className="pt-tag-pill">NeurIPS</span>
                            <span className="pt-tag-pill">Nature</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </label>

                  <div className="pt-upload-actions">
                    <button
                      className="pt-btn pt-btn-primary"
                      onClick={handleUpload}
                      disabled={loading || !file}
                    >
                      {loading ? (
                        <>
                          <span className="pt-btn-spinner" />
                          <span>Analyzing Paper…</span>
                        </>
                      ) : (
                        <>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          <span>Analyze & Extract Paper</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="pt-btn-specimen"
                      onClick={handleLoadSample}
                      title="Load verified benchmark paper"
                    >
                      <span>Or test verified benchmark: <strong>Focal Loss (ICCV 2017)</strong></span>
                      <span className="pt-arrow">→</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Analytical Workbench Modules */}
              <div className="pt-landing-col pt-modules-col">
                <div className="pt-section-header-row">
                  <span className="pt-step-badge">2</span>
                  <h2 className="pt-step-title">Analytical Workbench Modules</h2>
                </div>

                <div className="pt-illuminations-grid-compact">
                  {/* Module 1: Math Simulator */}
                  <div className="pt-illumination-card compact">
                    <div className="pt-plate-header">
                      <div className="pt-module-badge math">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 4h16l-7 8 7 8H4" />
                        </svg>
                        <span>Math Simulator</span>
                      </div>
                      <span className="pt-plate-step-num">01</span>
                    </div>
                    <h3 className="pt-plate-title">1. Mathematical Formulation</h3>
                    <p className="pt-plate-desc">
                      Extracts central equations into reactive parameter models with real-time sliders and dynamic Plotly response curves.
                    </p>
                  </div>

                  {/* Module 2: Idea Tree */}
                  <div className="pt-illumination-card compact">
                    <div className="pt-plate-header">
                      <div className="pt-module-badge tree">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="6" height="6" rx="1" />
                          <rect x="15" y="15" width="6" height="6" rx="1" />
                          <path d="M6 9v3a3 3 0 0 0 3 3h6" />
                        </svg>
                        <span>Idea Tree</span>
                      </div>
                      <span className="pt-plate-step-num">02</span>
                    </div>
                    <h3 className="pt-plate-title">2. Concept Lineage Flow</h3>
                    <p className="pt-plate-desc">
                      Deconstructs the paper into a 4-stage lineage: prior baseline, identified friction, novelty, and empirical resolution.
                    </p>
                  </div>

                  {/* Module 3: Code Sandbox */}
                  <div className="pt-illumination-card compact">
                    <div className="pt-plate-header">
                      <div className="pt-module-badge code">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="4 17 10 11 4 5" />
                          <line x1="12" y1="19" x2="20" y2="19" />
                        </svg>
                        <span>Code Sandbox</span>
                      </div>
                      <span className="pt-plate-step-num">03</span>
                    </div>
                    <h3 className="pt-plate-title">3. Executable Algorithm</h3>
                    <p className="pt-plate-desc">
                      Translates paper pseudocode into executable Python code, simulating algorithms with live numerical telemetry.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ACTIVE WORKSPACE (When paper is loaded) */}
        {markdown && (
          <div className="pt-folio-display">
            {/* Slim Top Navigation Bar */}
            <header className="pt-top-navbar">
              <div className="pt-navbar-left">
                <span className="pt-navbar-brand">PaperTrail</span>
                <span className="pt-navbar-sep">/</span>
                <span className="pt-doc-badge">VERIFIED SPECIMEN</span>
                <span className="pt-navbar-doc-title" title={paperTitle || 'Research Manuscript'}>
                  {paperTitle || 'Research Manuscript'}
                </span>
                {paperCitation && <span className="pt-navbar-doc-citation">{paperCitation}</span>}
              </div>

              <div className="pt-navbar-right">
                <button className="pt-btn-return" onClick={handleReset} title="Upload a different paper">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                  <span>Upload Another Paper</span>
                </button>
              </div>
            </header>

            {/* Distinct Tab Navigation with Colored Icon Badges */}
            <nav className="pt-archival-tabs" role="tablist">
              <button
                className={`pt-tab-btn math-tab ${activeTab === 'math' ? 'active' : ''}`}
                onClick={() => handleTabChange('math')}
                role="tab"
                aria-selected={activeTab === 'math'}
              >
                <span className="pt-tab-badge math">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16l-7 8 7 8H4" />
                  </svg>
                </span>
                <span className="pt-tab-step">1.</span>
                <span className="pt-tab-title">Math Simulator</span>
              </button>

              <button
                className={`pt-tab-btn tree-tab ${activeTab === 'ideatree' ? 'active' : ''}`}
                onClick={() => handleTabChange('ideatree')}
                role="tab"
                aria-selected={activeTab === 'ideatree'}
              >
                <span className="pt-tab-badge tree">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="6" height="6" rx="1" />
                    <rect x="15" y="15" width="6" height="6" rx="1" />
                    <path d="M6 9v3a3 3 0 0 0 3 3h6" />
                  </svg>
                </span>
                <span className="pt-tab-step">2.</span>
                <span className="pt-tab-title">Idea Tree</span>
              </button>

              <button
                className={`pt-tab-btn code-tab ${activeTab === 'codesandbox' ? 'active' : ''}`}
                onClick={() => handleTabChange('codesandbox')}
                role="tab"
                aria-selected={activeTab === 'codesandbox'}
              >
                <span className="pt-tab-badge code">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 17 10 11 4 5" />
                    <line x1="12" y1="19" x2="20" y2="19" />
                  </svg>
                </span>
                <span className="pt-tab-step">3.</span>
                <span className="pt-tab-title">Code Sandbox</span>
              </button>
            </nav>

            {/* Document Content Sheet */}
            <main className="pt-parchment-sheet">
              {/* TAB 1: MATH SIMULATOR */}
              {activeTab === 'math' && (
                <div className="pt-section-pane pt-math-pane">
                  {mathSpec ? (
                    <div>
                      {/* Compact Header: Title + Formula in an integrated row */}
                      <div className="pt-math-top-row">
                        <div className="pt-pane-intro">
                          <span className="pt-section-subhead">Section 1.0 · Mathematical Formulation</span>
                          <h2 className="pt-pane-title">{mathSpec.title}</h2>
                        </div>

                        {/* Formula Block */}
                        <div className="pt-illuminated-formula-block compact">
                          <span className="pt-formula-label">CORE MATHEMATICAL EQUATION</span>
                          <div className="pt-formula-content">{mathSpec.latex_formula}</div>
                        </div>
                      </div>

                      <div className="pt-concept-exegesis compact">
                        <p>{mathSpec.concept_explanation}</p>
                      </div>

                      {/* Sliders & Plot Split Apparatus */}
                      <div className="pt-math-apparatus-grid">
                        {/* Parameters Column */}
                        <div className="pt-parameters-column">
                          <div className="pt-param-column-header">
                            <span className="pt-section-subhead">Section 1.1 · Interactive Parameters</span>
                            <h3 className="pt-column-heading">Parameter Controls</h3>
                          </div>

                          <div className="pt-sliders-list">
                            {mathSpec.parameters.map((param) => (
                              <div key={param.name} className="pt-brass-param-card compact">
                                <div className="pt-param-header">
                                  <div className="pt-param-name-group">
                                    <span className="pt-param-symbol">{param.symbol}</span>
                                    <span className="pt-param-title">{param.name}</span>
                                  </div>
                                  <span className="pt-param-numeric-badge">
                                    {paramValues[param.name] ?? param.default_val}
                                  </span>
                                </div>

                                <div className="pt-slider-track-wrap">
                                  <input
                                    className="pt-brass-slider"
                                    type="range"
                                    min={param.min_val}
                                    max={param.max_val}
                                    step={param.step}
                                    value={paramValues[param.name] ?? param.default_val}
                                    onChange={(e) => handleSliderChange(param.name, e.target.value)}
                                  />
                                </div>

                                <div className="pt-param-range-labels">
                                  <span>Min: {param.min_val}</span>
                                  <span>Max: {param.max_val}</span>
                                </div>

                                <p className="pt-param-annotation">{param.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Live Plotly Visual Column */}
                        <div className="pt-plot-column">
                          <div className="pt-plot-column-header">
                            <span className="pt-section-subhead">Section 1.2 · Numerical Simulation</span>
                            <h3 className="pt-column-heading">
                              Dynamic Response Curve
                              {plotLoading && <span className="pt-plot-recomputing"> • Updating…</span>}
                            </h3>
                          </div>

                          <div className="pt-plot-frame">
                            {plotData ? (
                              <Plot
                                data={[
                                  {
                                    x: plotData.x,
                                    y: plotData.y,
                                    type: 'scatter',
                                    mode: 'lines',
                                    line: { color: '#ea580c', width: 3 },
                                    name: 'Analytical Response',
                                  },
                                ]}
                                layout={{
                                  title: {
                                    text: mathSpec.plot_labels?.title || 'Parametric Response',
                                    font: { family: 'Inter, sans-serif', size: 15, color: '#0f172a' },
                                  },
                                  xaxis: {
                                    title: {
                                      text: mathSpec.plot_labels?.x_label || 'x',
                                      font: { family: 'Inter, sans-serif', size: 12, color: '#475569' },
                                    },
                                    gridcolor: '#f1f5f9',
                                    zerolinecolor: '#cbd5e1',
                                    tickfont: { family: 'Inter, sans-serif', size: 11, color: '#64748b' },
                                  },
                                  yaxis: {
                                    title: {
                                      text: mathSpec.plot_labels?.y_label || 'y',
                                      font: { family: 'Inter, sans-serif', size: 12, color: '#475569' },
                                    },
                                    gridcolor: '#f1f5f9',
                                    zerolinecolor: '#cbd5e1',
                                    tickfont: { family: 'Inter, sans-serif', size: 11, color: '#64748b' },
                                  },
                                  autosize: true,
                                  margin: { t: 38, l: 48, r: 24, b: 38 },
                                  paper_bgcolor: '#ffffff',
                                  plot_bgcolor: '#f8fafc',
                                }}
                                style={{ width: '100%', height: '360px' }}
                                useResizeHandler
                                config={{ displayModeBar: false, responsive: true }}
                              />
                            ) : (
                              <div className="pt-plot-placeholder">
                                <span>Generating dynamic plot…</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-pane-loading">
                      <span className="pt-btn-spinner" />
                      <p>Deriving mathematical specification from manuscript…</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: IDEA TREE */}
              {activeTab === 'ideatree' && (
                <div className="pt-section-pane pt-tree-pane">
                  <div className="pt-pane-intro">
                    <span className="pt-section-subhead">Section 2.0 · Concept Lineage</span>
                    <h2 className="pt-pane-title">Concept Lineage & Idea Tree</h2>
                  </div>

                  {ideaTreeLoading && (
                    <div className="pt-pane-loading">
                      <span className="pt-btn-spinner" />
                      <p>Constructing the paper's genealogical flowchart…</p>
                    </div>
                  )}

                  {ideaTreeSpec && <IdeaTree spec={ideaTreeSpec} />}
                </div>
              )}

              {/* TAB 3: CODE SANDBOX */}
              {activeTab === 'codesandbox' && (
                <div className="pt-section-pane pt-sandbox-pane">
                  {algorithmLoading && (
                    <div className="pt-pane-loading">
                      <span className="pt-btn-spinner" />
                      <p>Synthesizing runnable Python implementation from paper pseudocode…</p>
                    </div>
                  )}

                  {algorithmSpec && <CodeSandbox spec={algorithmSpec} />}
                </div>
              )}
            </main>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;