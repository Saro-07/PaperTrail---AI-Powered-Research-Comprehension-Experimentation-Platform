import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * High-performance typography renderer for LaTeX formulas and parameter symbols.
 */
export default function MathView({ math, displayMode = false, className = '' }) {
  const renderedHtml = useMemo(() => {
    if (!math) return '';
    try {
      const cleanMath = String(math).trim();
      return katex.renderToString(cleanMath, {
        displayMode,
        throwOnError: false,
      });
    } catch {
      return String(math);
    }
  }, [math, displayMode]);

  return (
    <span
      className={`pt-math-rendered ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}
