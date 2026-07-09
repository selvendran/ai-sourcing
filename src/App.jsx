import React, { useState, useRef } from 'react';
import './App.css';

const API_KEY = import.meta.env.VITE_SOURCING_API_KEY;
const WORKER_URL = 'https://sourcing-engine.sourcing-engine.workers.dev';

const PLATFORMS = [
  { value: 'internal', label: '🔍 Internal Database (Ranked AI)' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'github', label: 'GitHub' },
  { value: 'stackoverflow', label: 'Stack Overflow' },
  { value: 'twitter', label: 'X / Twitter' },
  { value: 'dribbble', label: 'Dribbble' },
  { value: 'wellfound', label: 'Wellfound' },
  { value: 'xing', label: 'Xing' },
  { value: 'coroflot', label: 'Coroflot' },
  { value: 'googlesites', label: 'Google Sites' },
  { value: 'scholar', label: 'Google Scholar' }
];

export default function SourcingAgent() {
  const [jdText, setJdText] = useState('');
  const [blacklist, setBlacklist] = useState('');
  const [prioritizeImmediate, setPrioritizeImmediate] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState('internal');
  const [queries, setQueries] = useState({});
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [candidateActions, setCandidateActions] = useState({});
  const abortControllerRef = useRef(null);

  const isInputEmpty = jdText.trim().length === 0;

  const loadAllProfiles = async () => {
    setIsProcessing(true);
    setStatus('Loading all profiles from database...');
    setResults([]);
    try {
      const response = await fetch(`${WORKER_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ query: "" })
      });
      const data = await response.json();
      setResults(data.results || []);
      setStatus(data.results?.length ? `Loaded ${data.results.length} profiles.` : 'No profiles found.');
    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const searchInternalDB = async () => {
    if (isInputEmpty) return;
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStatus('🔍 Running Semantic Vector Search & AI Re-ranking...');
    setIsProcessing(true);
    setResults([]);
    setQueries({});

    try {
      const response = await fetch(`${WORKER_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ 
          query: jdText.trim(),
          blacklist: blacklist ? blacklist.split(',').map(s => s.trim()).filter(Boolean) : [],
          prioritizeImmediate 
        }),
        signal: controller.signal
      });
      
      if (response.status === 401) throw new Error('Invalid or revoked API key.');
      if (response.status === 429) throw new Error('Rate limit exceeded. Please wait.');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      setResults(data.results || []);
      setStatus(data.results?.length ? '✅ Dynamic ranking complete.' : '⚠️ No matches found in DB.');
    } catch (error) {
      if (error.name !== 'AbortError') setStatus(`❌ ${error.message}`);
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const generateExternalSearch = async () => {
    if (isInputEmpty) return;
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStatus('⚡ Generating X-Ray Strings...');
    setIsProcessing(true);
    setResults([]);
    setQueries({});

    try {
      const response = await fetch(`${WORKER_URL}/generate-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ jd: jdText.trim() }),
        signal: controller.signal
      });
      
      if (response.status === 401) throw new Error('Invalid or revoked API key.');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      setQueries(data.queries || {});
      setStatus('✅ X-Ray Strings generated. Click the links below to hunt.');
    } catch (error) {
      if (error.name !== 'AbortError') setStatus(`❌ ${error.message}`);
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const recordAction = async (profileId, action) => {
    if (!API_KEY || !profileId) return;
    try {
      const res = await fetch(`${WORKER_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ profile_id: profileId, action, search_query: jdText.trim() }),
      });
      if (res.ok) setCandidateActions(prev => ({ ...prev, [profileId]: action }));
    } catch { }
  };

  return (
    <div className="app-container" style={{ background: '#ffffff', minHeight: '100vh' }}>
      <div className="central-column" style={{ maxWidth: '820px', width: '100%', padding: '40px 20px', margin: '0 auto' }}>
        <div className="header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
          <div className="logo-marker" style={{ width: '24px', height: '24px', background: 'linear-gradient(135deg, #6a5acd, #00bfff)', borderRadius: '50%' }}></div>
          <h1 className="brand-title" style={{ fontWeight: '600', fontSize: '24px', letterSpacing: '-0.5px', color: '#111111' }}>Sourcer</h1>
        </div>

        <div className="input-area" style={{ width: '100%', marginBottom: '16px' }}>
          <textarea 
            className="jd-input" 
            placeholder="Paste a Job Description here..." 
            value={jdText} 
            onChange={e => setJdText(e.target.value)} 
            style={{ width: '100%', minHeight: '120px', padding: '16px', borderRadius: '12px', background: '#ffffff', color: '#000000', border: '1px solid #d1d5db', fontSize: '15px', lineHeight: '1.6', resize: 'vertical', outline: 'none' }}
          />
        </div>

        <div className="controls-toggle" onClick={() => setShowControls(!showControls)} style={{ cursor: 'pointer', color: '#6b7280', fontSize: '13px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-block', transition: 'transform 0.2s', fontSize: '10px', transform: showControls ? 'rotate(90deg)' : 'none' }}>▶</span>
          <span>Advanced Recruitment Settings</span>
        </div>

        {showControls && (
          <div className="control-panel" style={{ width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="input-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '600' }}>Blacklist Keywords (comma separated)</label>
              <input type="text" placeholder="e.g. Intern, Fresher, Trainee" value={blacklist} onChange={(e) => setBlacklist(e.target.value)} style={{ background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 12px', color: '#111111', fontSize: '14px', outline: 'none' }} />
            </div>
            <div className="input-group checkbox-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontSize: '12px', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={prioritizeImmediate} onChange={(e) => setPrioritizeImmediate(e.target.checked)} />
                Prioritize Immediate Joiners
              </label>
            </div>
          </div>
        )}

        <div className="platform-selector" style={{ width: '100%', margin: '16px 0' }}>
          <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '6px' }}>Select Target Source</label>
          <select value={selectedPlatform} onChange={e => setSelectedPlatform(e.target.value)} style={{ width: '100%', padding: '12px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', color: '#111111', outline: 'none' }}>
            {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        <div className="action-area" style={{ width: '100%', marginBottom: '24px' }}>
          {selectedPlatform === 'internal' ? (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className={`search-btn ${isProcessing ? 'processing' : ''}`} onClick={searchInternalDB} disabled={isProcessing || isInputEmpty} style={{ flex: 1, padding: '16px', border: 'none', borderRadius: '12px', background: 'linear-gradient(135deg, #6a5acd 0%, #00bfff 100%)', color: '#ffffff', fontSize: '16px', fontWeight: '600', cursor: isInputEmpty ? 'not-allowed' : 'pointer', opacity: isInputEmpty ? 0.5 : 1 }}>
                {isProcessing ? 'Searching...' : 'Search'}
              </button>
              {/* HIDDEN FOR TESTING: View All Button */}
              <button onClick={loadAllProfiles} disabled={isProcessing} style={{ display: 'none' }}>
                View All
              </button>
            </div>
          ) : (
            <button className={`search-btn ${isProcessing ? 'processing' : ''}`} onClick={generateExternalSearch} disabled={isProcessing || isInputEmpty} style={{ width: '100%', padding: '16px', border: 'none', borderRadius: '12px', background: 'linear-gradient(135deg, #6a5acd 0%, #00bfff 100%)', color: '#ffffff', fontSize: '18px', fontWeight: '600', cursor: isInputEmpty ? 'not-allowed' : 'pointer', opacity: isInputEmpty ? 0.5 : 1 }}>
              {isProcessing ? 'Generating...' : 'Generate External X-Ray'}
            </button>
          )}
        </div>

        {status && (
          <div className="status-area" style={{ width: '100%', textAlign: 'center', marginBottom: '24px' }}>
            <p className="status-text" style={{ color: '#6b7280', fontSize: '14px', fontWeight: '500' }}>{status}</p>
          </div>
        )}

        {selectedPlatform === 'internal' && results.length > 0 && (
          <div className="results-feed" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {results.map((c, i) => {
              const currentAction = candidateActions[c.id];
              return (
                <div key={i} className="candidate-card" style={{ background: '#1a1d24', border: '1px solid #333333', borderRadius: '12px', padding: '20px' }}>
                  <div className="card-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div className="candidate-info">
                      <h3 className="candidate-name" style={{ color: '#ffffff', margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600' }}>{c.name}</h3>
                      <p className="candidate-title" style={{ color: '#8b8f9a', margin: 0, fontSize: '14px' }}>{c.title || 'Candidate'} • {c.source}</p>
                    </div>
                    <div className="score-pill" style={{ background: '#6a5acd', color: '#ffffff', padding: '4px 12px', borderRadius: '100px', fontSize: '14px', fontWeight: '600' }}>{c.score}/100</div>
                  </div>
                  <div className="card-reasoning" style={{ fontSize: '14px', lineHeight: '1.5', color: '#e1e5ec', marginBottom: '16px' }}>
                    <p style={{ margin: '0 0 8px 0' }}><strong style={{ color: '#ffffff' }}>Skills:</strong> {c.skills || 'None extracted'}</p>
                    <p style={{ margin: 0 }}><strong style={{ color: '#ffffff' }}>Reasoning:</strong> {c.reasoning}</p>
                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#8b8f9a' }}>Ranking Source: {c.type || 'AI'}</p>
                  </div>
                  <div className="card-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => recordAction(c.id, 'shortlisted')} disabled={currentAction === 'shortlisted'} style={{ background: currentAction === 'shortlisted' ? '#6a5acd' : 'linear-gradient(135deg, #6a5acd 0%, #00bfff 100%)', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', fontWeight: '500', cursor: currentAction === 'shortlisted' ? 'default' : 'pointer' }}>
                        {currentAction === 'shortlisted' ? '✓ Shortlisted' : '👍 Shortlist'}
                      </button>
                      <button onClick={() => recordAction(c.id, 'rejected')} disabled={currentAction === 'rejected'} style={{ background: currentAction === 'rejected' ? '#2a2f3a' : 'linear-gradient(135deg, #6a5acd 0%, #00bfff 100%)', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', fontWeight: '500', cursor: currentAction === 'rejected' ? 'default' : 'pointer' }}>
                        {currentAction === 'rejected' ? '✓ Passed' : '👎 Pass'}
                      </button>
                    </div>
                    {c.url ? (
                      <a href={c.url} target="_blank" rel="noopener noreferrer" onClick={() => recordAction(c.id, 'viewed')} style={{ color: '#00bfff', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>View Profile →</a>
                    ) : (
                      <span style={{ color: '#8b8f9a', fontSize: '14px', opacity: 0.5 }}>No link available</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedPlatform !== 'internal' && Object.keys(queries).length > 0 && queries[selectedPlatform] && (
          <div style={{ width: '100%', marginTop: '20px', padding: '20px', background: '#1a1d24', border: '1px solid #333333', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '16px', color: '#ffffff', marginBottom: '8px' }}>Hunt on {queries[selectedPlatform].label}:</h3>
            <p style={{ fontSize: '13px', color: '#8b8f9a', marginBottom: '16px' }}><em>The background extension will silently auto-ingest any profiles you view from these links.</em></p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <a href={`https://www.google.com/search?q=${encodeURIComponent(queries[selectedPlatform]?.query)}`} target="_blank" rel="noreferrer" style={{ flex: '1', textAlign: 'center', padding: '10px', background: 'linear-gradient(135deg, #6a5acd, #00bfff)', color: '#ffffff', textDecoration: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px' }}>Open in Google</a>
              <a href={`https://www.bing.com/search?q=${encodeURIComponent(queries[selectedPlatform]?.query)}`} target="_blank" rel="noreferrer" style={{ flex: '1', textAlign: 'center', padding: '10px', background: '#2a2f3a', color: '#ffffff', textDecoration: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', border: '1px solid #333333' }}>Open in Bing</a>
            </div>
            <div style={{ marginTop: '16px', padding: '12px', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 6px 0' }}>Generated X-Ray Query:</p>
              <code style={{ fontSize: '12px', color: '#00bfff', wordBreak: 'break-all', fontFamily: 'monospace' }}>{queries[selectedPlatform]?.query}</code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
