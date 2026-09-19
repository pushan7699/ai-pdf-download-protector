import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import { viewerAPI } from '../services/api.js';

// Worker served from /public/ by Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

// ── Anti-download helpers ────────────────────────────────────────────────────
function blockContextMenu(e) { e.preventDefault(); }
function blockKeyboard(e) {
  if ((e.ctrlKey && ['s','p','u','a'].includes(e.key.toLowerCase())) ||
      e.key === 'F12' || e.key === 'PrintScreen') {
    e.preventDefault();
  }
}

// ── PDF page canvas renderer ─────────────────────────────────────────────────
function PDFPageCanvas({ pdfDoc, scale }) {
  const canvasRef   = useRef(null);
  const renderRef   = useRef(null);
  const [rendering, setRendering] = useState(true);
  const [error, setError]         = useState(false);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;

    const draw = async () => {
      try {
        setRendering(true);
        setError(false);
        if (renderRef.current) {
          try { await renderRef.current.cancel(); } catch (_) {}
        }
        const page     = await pdfDoc.getPage(1); // always page 1 of the single-page doc
        const viewport = page.getViewport({ scale });
        const canvas   = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width  = viewport.width;
        canvas.height = viewport.height;
        const task = page.render({ canvasContext: canvas.getContext('2d'), viewport });
        renderRef.current = task;
        await task.promise;
        if (!cancelled) setRendering(false);
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException' && !cancelled) {
          console.error('Render error:', err);
          setError(true);
          setRendering(false);
        }
      }
    };
    draw();
    return () => { cancelled = true; };
  }, [pdfDoc, scale]);

  if (error) return (
    <div className="flex items-center justify-center h-96 bg-red-50 text-red-500 text-sm rounded">
      Failed to render this page
    </div>
  );

  return (
    <div className="relative select-none shadow-xl rounded-sm overflow-hidden bg-white">
      {rendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10 min-h-96">
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            <span className="text-sm">Rendering…</span>
          </div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', userSelect: 'none', pointerEvents: 'none' }}
        onContextMenu={blockContextMenu}
      />
      {/* Transparent overlay — blocks right-click + drag */}
      <div className="absolute inset-0" onContextMenu={blockContextMenu}
        onDragStart={(e) => e.preventDefault()}
        style={{ zIndex: 20, background: 'transparent', cursor: 'default' }} />
    </div>
  );
}

// ── Main viewer ──────────────────────────────────────────────────────────────
export default function Viewer() {
  const { documentId } = useParams();
  const navigate = useNavigate();

  const [session,      setSession]      = useState(null);
  const [pdfDoc,       setPdfDoc]       = useState(null);
  const [totalPages,   setTotalPages]   = useState(0); // real count from session
  const [currentPage,  setCurrentPage]  = useState(1);
  const [title,        setTitle]        = useState('Document');
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingPage,  setLoadingPage]  = useState(false);
  const [error,        setError]        = useState('');
  const [zoom,         setZoom]         = useState(1.5);
  const [sidebarOpen,  setSidebarOpen]  = useState(false);

  const sessionRef  = useRef(null);
  const containerRef = useRef(null);
  const startedRef  = useRef(false);

  // ── 1. Start session ───────────────────────────────────────────────────────
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let ended = false;

    viewerAPI.startSession(documentId)
      .then(({ data }) => {
        const s = data.data;
        setSession(s);
        sessionRef.current = s;
        setTitle(s.title || 'Document');
        setTotalPages(s.pageCount || 0); // ← real total from backend
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Could not open document.');
      })
      .finally(() => setLoadingSession(false));

    document.addEventListener('contextmenu', blockContextMenu);
    document.addEventListener('keydown', blockKeyboard);
    const onPrint = () => {
      if (sessionRef.current?.sessionToken)
        viewerAPI.reportDownload(sessionRef.current.sessionToken, 'print').catch(() => {});
    };
    window.addEventListener('beforeprint', onPrint);

    return () => {
      document.removeEventListener('contextmenu', blockContextMenu);
      document.removeEventListener('keydown', blockKeyboard);
      window.removeEventListener('beforeprint', onPrint);
      if (sessionRef.current?.sessionToken && !ended) {
        ended = true;
        viewerAPI.endSession(sessionRef.current.sessionToken).catch(() => {});
      }
    };
  }, [documentId]);

  // ── 2. Fetch page PDF from backend and load into PDF.js ───────────────────
  const fetchPage = useCallback(async (pageNum, token) => {
    if (!token) return;
    setLoadingPage(true);
    setPdfDoc(null);
    try {
      const accessToken = localStorage.getItem('access_token') || '';
      // Use VITE_API_URL in production, otherwise relative path (Vite proxy)
      const apiBase = import.meta.env.VITE_API_URL || '';
      const url = `${apiBase}/api/viewer/page/${pageNum}?session_token=${encodeURIComponent(token)}&token=${encodeURIComponent(accessToken)}`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buf  = await resp.arrayBuffer();
      const doc  = await pdfjsLib.getDocument({ data: buf }).promise;
      setPdfDoc(doc);
    } catch (err) {
      console.error('fetchPage error:', err);
      setError('Failed to load page. ' + (err.message || ''));
    } finally {
      setLoadingPage(false);
    }
  }, []);

  // ── 3. When session is ready, load first page ─────────────────────────────
  useEffect(() => {
    if (session?.sessionToken) fetchPage(1, session.sessionToken);
  }, [session, fetchPage]);

  // ── 4. Navigate pages ─────────────────────────────────────────────────────
  const goTo = useCallback((p) => {
    if (!sessionRef.current?.sessionToken) return;
    const page = Math.max(1, Math.min(p, totalPages));
    setCurrentPage(page);
    fetchPage(page, sessionRef.current.sessionToken);
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [totalPages, fetchPage]);

  // ── Loading / error screens ───────────────────────────────────────────────
  if (loadingSession) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 gap-3">
      <svg className="animate-spin w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
      <p className="text-slate-300 text-sm">Opening secure viewer…</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Cannot Open Document</h2>
        <p className="text-slate-500 text-sm mb-6">{error}</p>
        <button onClick={() => navigate('/dashboard')}
          className="bg-blue-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-blue-700 transition-colors">
          Back to Dashboard
        </button>
      </div>
    </div>
  );

  const zoomPct = Math.round(zoom * 100);

  return (
    <div className="min-h-screen flex flex-col bg-slate-800 select-none" onContextMenu={blockContextMenu}>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <header className="bg-slate-900 text-white flex items-center justify-between px-4 py-2.5 shadow-lg z-50 shrink-0">

        {/* Left */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors" title="Back">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
          </button>
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <h1 className="text-sm font-semibold truncate max-w-xs hidden sm:block">{title}</h1>
        </div>

        {/* Center — page nav */}
        <div className="flex items-center gap-2">
          <button onClick={() => goTo(currentPage - 1)} disabled={currentPage <= 1}
            className="p-1.5 rounded text-slate-400 hover:text-white disabled:opacity-30 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <div className="flex items-center gap-1.5 text-sm">
            <input type="number" min={1} max={totalPages} value={currentPage}
              onChange={(e) => goTo(parseInt(e.target.value) || 1)}
              className="w-12 bg-slate-700 text-white text-center rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"/>
            <span className="text-slate-400">/ {totalPages || '…'}</span>
          </div>
          <button onClick={() => goTo(currentPage + 1)} disabled={currentPage >= totalPages}
            className="p-1.5 rounded text-slate-400 hover:text-white disabled:opacity-30 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

        {/* Right — zoom + badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}
              className="text-slate-400 hover:text-white p-1 text-xl leading-none">−</button>
            <span className="text-xs text-slate-400 w-12 text-center">{zoomPct}%</span>
            <button onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))}
              className="text-slate-400 hover:text-white p-1 text-xl leading-none">+</button>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 bg-green-900/60 text-green-400 text-xs px-2.5 py-1 rounded-full border border-green-700/50">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
            </svg>
            AI Protected
          </div>
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar — page list */}
        {sidebarOpen && (
          <aside className="w-52 bg-slate-900 border-r border-slate-700 overflow-y-auto shrink-0">
            <div className="p-3">
              <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide mb-3">Pages</p>
              <div className="space-y-1">
                {[...Array(totalPages)].map((_, i) => (
                  <button key={i+1} onClick={() => goTo(i+1)}
                    className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                      currentPage === i+1 ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}>
                    Page {i+1}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* Canvas area */}
        <div ref={containerRef} className="flex-1 overflow-y-auto flex justify-center py-8 px-4">
          <div style={{ width: `${Math.round(zoom * 600)}px`, maxWidth: '95vw' }}>

            {loadingPage ? (
              <div className="flex flex-col items-center justify-center h-96 text-slate-400 gap-3">
                <svg className="animate-spin w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                <span className="text-sm text-slate-400">Loading page {currentPage}…</span>
              </div>
            ) : pdfDoc ? (
              <PDFPageCanvas key={`${currentPage}-${zoom}`} pdfDoc={pdfDoc} scale={zoom} />
            ) : null}

            {/* Bottom navigation */}
            {totalPages > 1 && !loadingPage && (
              <div className="flex items-center justify-center gap-4 mt-5">
                <button onClick={() => goTo(currentPage - 1)} disabled={currentPage <= 1}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white disabled:opacity-30 rounded-lg text-sm transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                  </svg>
                  Previous
                </button>
                <span className="text-slate-400 text-sm font-medium">
                  Page {currentPage} of {totalPages}
                </span>
                <button onClick={() => goTo(currentPage + 1)} disabled={currentPage >= totalPages}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white disabled:opacity-30 rounded-lg text-sm transition-colors">
                  Next
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-500 text-xs text-center py-2 border-t border-slate-700 shrink-0">
        🔒 Watermarked & AI-monitored. Every page view is logged. Downloading is detected.
      </footer>
    </div>
  );
}
