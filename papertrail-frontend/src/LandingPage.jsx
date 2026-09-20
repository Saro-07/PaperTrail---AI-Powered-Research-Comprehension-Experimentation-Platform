import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

export default function LandingPage() {
  return (
    <div className="lp-container">
      {/* ---------- Top Navigation Bar ---------- */}
      <header className="lp-navbar">
        <div className="lp-nav-inner">
          <div className="lp-brand-group">
            <Link to="/" className="lp-brand-link">
              <span className="lp-brand-dot" />
              <span className="lp-brand-name">PaperTrail</span>
            </Link>
          </div>

          <nav className="lp-nav-menu">
            <a href="#about" className="lp-nav-item">About</a>
            <a href="#how-it-works" className="lp-nav-item">How It Works</a>
            <a href="#modules" className="lp-nav-item">Modules</a>
          </nav>

          <div className="lp-nav-actions">
            <Link to="/app" className="lp-btn-nav">
              <span>Launch Workbench</span>
              <span className="lp-nav-arrow">→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ---------- Hero Section ---------- */}
      <section className="lp-hero">
        <div className="lp-hero-content">
          <h1 className="lp-hero-title">
            PaperTrail
          </h1>

          <p className="lp-hero-tagline">
            Turn any research paper into something you can interact with — not just read.
          </p>

          <p className="lp-hero-subtext">
            Deconstruct complex publications into reactive parameter simulations, concept genealogies, and executable algorithmic sandboxes in seconds.
          </p>

          <div className="lp-hero-cta-group">
            <Link to="/app" className="lp-btn-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>Launch Workbench</span>
            </Link>
            <Link to="/app" className="lp-btn-secondary">
              <span>Try Benchmark Specimen (Focal Loss)</span>
              <span className="lp-arrow">→</span>
            </Link>
          </div>

          <div className="lp-hero-trust-row">
            <span className="lp-trust-item">
              <span className="lp-trust-check">✓</span> Works with arXiv, IEEE & NeurIPS PDFs
            </span>
            <span className="lp-trust-item">
              <span className="lp-trust-check">✓</span> Real-Time Numerical Sliders
            </span>
            <span className="lp-trust-item">
              <span className="lp-trust-check">✓</span> Executable In-Browser Python
            </span>
          </div>
        </div>

        {/* Hero Interactive Preview Mockup */}
        <div className="lp-hero-preview-board">
          <div className="lp-preview-window">
            <div className="lp-preview-topbar">
              <div className="lp-preview-dots">
                <span className="dot red" />
                <span className="dot yellow" />
                <span className="dot green" />
              </div>
              <div className="lp-preview-url">papertrail.workbench / focal-loss-iccv2017</div>
              <span className="lp-preview-status">VERIFIED SPECIMEN</span>
            </div>

            <div className="lp-preview-tabs">
              <div className="lp-preview-tab active math">
                <span className="lp-tab-dot math" />
                <span>1. Math Simulator</span>
              </div>
              <div className="lp-preview-tab tree">
                <span className="lp-tab-dot tree" />
                <span>2. Idea Tree</span>
              </div>
              <div className="lp-preview-tab code">
                <span className="lp-tab-dot code" />
                <span>3. Code Sandbox</span>
              </div>
            </div>

            <div className="lp-preview-body">
              <div className="lp-preview-col left">
                <div className="lp-preview-math-box">
                  <span className="lp-prev-badge">CORE FORMULATION</span>
                  <code>FL(p_t) = -\alpha_t (1 - p_t)^\gamma \log(p_t)</code>
                </div>
                <div className="lp-preview-slider">
                  <div className="lp-prev-slider-label">
                    <span>Modulating Factor (\gamma)</span>
                    <span className="lp-prev-val">2.0</span>
                  </div>
                  <div className="lp-prev-slider-track">
                    <div className="lp-prev-slider-fill" style={{ width: '40%' }} />
                    <div className="lp-prev-slider-thumb" style={{ left: '40%' }} />
                  </div>
                </div>
                <div className="lp-preview-slider">
                  <div className="lp-prev-slider-label">
                    <span>Class Weight (\alpha_t)</span>
                    <span className="lp-prev-val">0.25</span>
                  </div>
                  <div className="lp-prev-slider-track">
                    <div className="lp-prev-slider-fill" style={{ width: '25%' }} />
                    <div className="lp-prev-slider-thumb" style={{ left: '25%' }} />
                  </div>
                </div>
              </div>

              <div className="lp-preview-col right">
                <div className="lp-preview-chart-card">
                  <div className="lp-chart-header">
                    <span className="lp-chart-title">Dynamic Loss Response Curve</span>
                    <span className="lp-live-badge">Live Plotly</span>
                  </div>
                  <div className="lp-chart-svg-wrap">
                    <svg viewBox="0 0 300 130" className="lp-mock-curve">
                      <path
                        d="M 15,10 Q 50,110 285,115"
                        fill="none"
                        stroke="#ea580c"
                        strokeWidth="3.5"
                      />
                      <line x1="15" y1="115" x2="285" y2="115" stroke="#cbd5e1" strokeWidth="1" />
                      <line x1="15" y1="10" x2="15" y2="115" stroke="#cbd5e1" strokeWidth="1" />
                      <circle cx="120" cy="72" r="5" fill="#ea580c" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- What is PaperTrail Section ---------- */}
      <section id="about" className="lp-section lp-about-section">
        <div className="lp-section-header">
          <span className="lp-section-eyebrow">The Paradigm Shift</span>
          <h2 className="lp-section-title">What is PaperTrail?</h2>
          <p className="lp-section-subtitle">
            Scientific progress is bottlenecked by static documents. PaperTrail turns inert academic publications into reactive, explorable knowledge systems.
          </p>
        </div>

        <div className="lp-compare-grid">
          {/* Problem Card */}
          <div className="lp-compare-card problem">
            <div className="lp-card-header">
              <span className="lp-card-indicator problem">✕</span>
              <h3 className="lp-card-title">The Problem: Static Academic PDFs</h3>
            </div>
            <p className="lp-card-intro">
              Research papers have been distributed as static PDFs for over thirty years. They conceal intuition behind dense notation, unexecutable pseudocode, and fixed diagrams that cannot be probed or tested.
            </p>
            <ul className="lp-feature-list">
              <li>
                <strong>Buried Formulations:</strong> Key equations are locked in static text without visible parameter sensitivity.
              </li>
              <li>
                <strong>Opaque Narratives:</strong> Understanding how novelty connects to prior baselines requires hours of literature tracing.
              </li>
              <li>
                <strong>Unexecutable Algorithms:</strong> Pseudocode often contains implicit syntax discrepancies and cannot be verified on the spot.
              </li>
            </ul>
          </div>

          {/* Solution Card */}
          <div className="lp-compare-card solution">
            <div className="lp-card-header">
              <span className="lp-card-indicator solution">✓</span>
              <h3 className="lp-card-title">The Solution: The PaperTrail Workbench</h3>
            </div>
            <p className="lp-card-intro">
              PaperTrail parses research papers through an intelligent multi-agent pipeline, instantly extracting the central equation, conceptual narrative, and underlying algorithm into explorable, reactive interfaces.
            </p>
            <ul className="lp-feature-list">
              <li>
                <strong>Reactive Math Models:</strong> Drag real-time sliders to immediately see how mathematical parameters shape response curves.
              </li>
              <li>
                <strong>4-Stage Concept Lineage:</strong> Deconstruct paper breakthroughs from prior dogma to the identified friction and resolution.
              </li>
              <li>
                <strong>Validated Python Sandbox:</strong> Execute verified algorithm implementations with numerical telemetry in real time.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ---------- How It Works Section ---------- */}
      <section id="how-it-works" className="lp-section lp-hiw-section">
        <div className="lp-section-header">
          <span className="lp-section-eyebrow">Streamlined Workflow</span>
          <h2 className="lp-section-title">How It Works</h2>
          <p className="lp-section-subtitle">
            From raw publication PDF to a fully interactive analytical workbench in three automated steps.
          </p>
        </div>

        <div className="lp-hiw-grid">
          {/* Step 1 */}
          <div className="lp-hiw-card">
            <div className="lp-hiw-step-header">
              <span className="lp-hiw-number">01</span>
              <span className="lp-hiw-pill">Step 1</span>
            </div>
            <div className="lp-hiw-icon-box">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </div>
            <h3 className="lp-hiw-card-title">Upload Research PDF</h3>
            <p className="lp-hiw-card-desc">
              Drop in any academic paper PDF from arXiv, IEEE, NeurIPS, or Nature, or click one of our verified benchmark specimens to start instantly.
            </p>
          </div>

          {/* Step 2 */}
          <div className="lp-hiw-card">
            <div className="lp-hiw-step-header">
              <span className="lp-hiw-number">02</span>
              <span className="lp-hiw-pill">Step 2</span>
            </div>
            <div className="lp-hiw-icon-box">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <h3 className="lp-hiw-card-title">AI Pipeline Extraction</h3>
            <p className="lp-hiw-card-desc">
              An AI pipeline analyzes the document structure, isolates core mathematical equations, maps the 4-stage narrative arc, and synthesizes runnable algorithm code.
            </p>
          </div>

          {/* Step 3 */}
          <div className="lp-hiw-card">
            <div className="lp-hiw-step-header">
              <span className="lp-hiw-number">03</span>
              <span className="lp-hiw-pill">Step 3</span>
            </div>
            <div className="lp-hiw-icon-box">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <h3 className="lp-hiw-card-title">Interactive Exploration</h3>
            <p className="lp-hiw-card-desc">
              Explore the results across three specialized tabs: drag sliders on the live equation, navigate the concept story, and execute the algorithm with real telemetry.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Three Ways to Explore Section ---------- */}
      <section id="modules" className="lp-section lp-modules-section">
        <div className="lp-section-header">
          <span className="lp-section-eyebrow">Analytical Workbench</span>
          <h2 className="lp-section-title">Three Ways to Explore</h2>
          <p className="lp-section-subtitle">
            Every paper is synthesized into three synchronized analytical modules.
          </p>
        </div>

        <div className="lp-modules-grid">
          {/* Module 1: Math Simulator */}
          <div className="lp-module-card math-module">
            <div className="lp-module-header">
              <div className="lp-module-badge math">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16l-7 8 7 8H4" />
                </svg>
                <span>Math Simulator</span>
              </div>
              <span className="lp-module-num">01</span>
            </div>

            <h3 className="lp-module-title">1. Mathematical Formulation</h3>
            <p className="lp-module-desc">
              Extracts central equations into reactive parameter models with real-time sliders and dynamic Plotly response curves.
            </p>

            <div className="lp-module-preview math-preview">
              <div className="lp-mini-spec">
                <span className="lp-mini-label">REACTIVE FORMULATION</span>
                <code>FL(p_t) = -(1 - p_t)^\gamma \log(p_t)</code>
              </div>
              <div className="lp-mini-features">
                <span>• Real-time parameter sliders</span>
                <span>• Live Plotly curvature telemetry</span>
                <span>• Concept sensitivity inspection</span>
              </div>
            </div>
          </div>

          {/* Module 2: Idea Tree */}
          <div className="lp-module-card tree-module">
            <div className="lp-module-header">
              <div className="lp-module-badge tree">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                <span>Idea Tree</span>
              </div>
              <span className="lp-module-num">02</span>
            </div>

            <h3 className="lp-module-title">2. Concept Lineage Flow</h3>
            <p className="lp-module-desc">
              Deconstructs the paper into a 4-stage lineage: prior baseline, identified friction, novelty, and empirical resolution.
            </p>

            <div className="lp-module-preview tree-preview">
              <div className="lp-mini-pipeline">
                <span className="lp-pipe-node">Prior Baseline</span>
                <span className="lp-pipe-arrow">→</span>
                <span className="lp-pipe-node">Bottleneck</span>
                <span className="lp-pipe-arrow">→</span>
                <span className="lp-pipe-node">Novelty</span>
                <span className="lp-pipe-arrow">→</span>
                <span className="lp-pipe-node">Impact</span>
              </div>
              <div className="lp-mini-features">
                <span>• Interactive horizontal flowchart</span>
                <span>• Deep-dive node explication gloss</span>
                <span>• Automated guided concept tour</span>
              </div>
            </div>
          </div>

          {/* Module 3: Code Sandbox */}
          <div className="lp-module-card code-module">
            <div className="lp-module-header">
              <div className="lp-module-badge code">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
                <span>Code Sandbox</span>
              </div>
              <span className="lp-module-num">03</span>
            </div>

            <h3 className="lp-module-title">3. Executable Algorithm</h3>
            <p className="lp-module-desc">
              Translates paper pseudocode into executable Python code, simulating algorithms with live numerical telemetry.
            </p>

            <div className="lp-module-preview code-preview">
              <div className="lp-mini-terminal">
                <span className="lp-term-line">&gt; python -m sandbox.simulate</span>
                <span className="lp-term-out">Batch: 1,000 samples | Total Loss: 0.07</span>
              </div>
              <div className="lp-mini-features">
                <span>• Dual pseudocode & Python register</span>
                <span>• Automated syntax validation</span>
                <span>• Live standard out console</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Final Call to Action ---------- */}
      <section className="lp-cta-banner">
        <div className="lp-cta-inner">
          <h2 className="lp-cta-title">
            Ready to explore research beyond static text?
          </h2>
          <p className="lp-cta-subtitle">
            Upload your paper PDF or test our pre-parsed benchmark paper right in your browser.
          </p>
          <div className="lp-cta-buttons">
            <Link to="/app" className="lp-btn-cta-primary">
              <span>Launch PaperTrail Workbench</span>
              <span className="lp-arrow">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-left">
            <span className="lp-footer-brand">PaperTrail</span>
            <span className="lp-footer-sep">·</span>
            <span className="lp-footer-credit">
              AI-Powered Research Workbench · Powered by Groq & Llama
            </span>
          </div>

          <div className="lp-footer-right">
            <Link to="/app" className="lp-footer-link">Workbench App</Link>
            <a href="#about" className="lp-footer-link">About</a>
            <a href="#how-it-works" className="lp-footer-link">How It Works</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
