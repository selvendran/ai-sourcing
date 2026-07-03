import React, { useState } from 'react';
import './App.css';

export default function SourcingAgent() {
  const [passcode, setPasscode] = useState('');
  const [jdText, setJdText] = useState('');
  const [blacklist, setBlacklist] = useState('');
  const [prioritizeImmediate, setPrioritizeImmediate] = useState(false);
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('');
  const [percent, setPercent] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showControls, setShowControls] = useState(false);

  const runAgent = async () => {
    if (!jdText) return alert('Paste a Job Description to get started.');
    if (!passcode) return alert('Enter your Team Passcode.');

    setStatus('Analyzing JD Structure...');
    setPercent(5);
    setIsProcessing(true);
    setResults([]);

    try {
      const response = await fetch('http://localhost:3001/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          jdText, 
          passcode, 
          blacklist: blacklist.split(',').map(s => s.trim()),
          prioritizeImmediate 
        }),
      });

      if (response.status === 401) {
        setStatus('Unauthorized: Invalid Passcode.');
        setIsProcessing(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value, { stream: true }).split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'status') {
              setStatus(data.message);
              setPercent(data.percent || 0);
            } else if (data.type === 'result') {
              setResults(data.results || []);
              setStatus('Ready! We found your top matches.');
              setPercent(100);
            } else if (data.type === 'error') {
              setStatus(`Error: ${data.message}`);
              setIsProcessing(false);
            }
          } catch {}
        }
      }
    } catch (error) {
      setStatus('Network error. Is the backend running?');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="app-container">
      <div className="central-column">
        
        {/* Header */}
        <div className="header">
          <div className="logo-marker"></div>
          <h1 className="brand-title">Sourcer</h1>
        </div>

        {/* The Main Input Area */}
        <div className="input-area">
          <textarea 
            className="jd-input" 
            placeholder="Paste the Job Description here..." 
            value={jdText} 
            onChange={(e) => setJdText(e.target.value)}
          />
        </div>

        {/* The Advanced Controls (Accordion) */}
        <div className="controls-toggle" onClick={() => setShowControls(!showControls)}>
          <span className={`toggle-arrow ${showControls ? 'open' : 'closed'}`}>▶</span> 
          <span>Advanced Recruitment Settings</span>
        </div>
        
        {showControls && (
          <div className="control-panel">
            <div className="input-group">
              <label>Team Passcode</label>
              <input type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Blacklist Keywords (comma separated)</label>
              <input type="text" placeholder="e.g. Intern, Fresher, Trainee" value={blacklist} onChange={(e) => setBlacklist(e.target.value)} />
            </div>
            <div className="input-group checkbox-group">
              <label>
                <input type="checkbox" checked={prioritizeImmediate} onChange={(e) => setPrioritizeImmediate(e.target.checked)} />
                Prioritize Immediate Joiners
              </label>
            </div>
          </div>
        )}

        {/* The Trigger Button */}
        <div className="action-area">
          <button 
            className={`search-btn ${isProcessing ? 'processing' : ''}`} 
            onClick={runAgent} 
            disabled={isProcessing}
          >
            {isProcessing ? 'Searching...' : 'Find Candidates'}
          </button>
        </div>

        {/* Processing Status & Progress */}
        {(isProcessing || percent > 0) && (
          <div className="status-area">
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${percent}%` }}></div></div>
            <p className="status-text">{status}</p>
          </div>
        )}

        {/* The Results Feed */}
        <div className="results-feed">
          {results.map((candidate, index) => (
            <div key={index} className="candidate-card">
              <div className="card-top">
                <div className="candidate-info">
                  <h3 className="candidate-name">{candidate.name || 'Unknown Profile'}</h3>
                  <p className="candidate-title">{candidate.title || 'Candidate'}</p>
                </div>
                <div className="score-pill">{candidate.score}/100</div>
              </div>
              <div className="card-reasoning">
                <p>{candidate.reasoning || 'Matched based on AI analysis.'}</p>
              </div>
              <div className="card-actions">
                <a href={candidate.link} target="_blank" rel="noopener noreferrer" className="view-profile-btn">
                  View Candidate Profile →
                </a>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
