'use client';

import { useState } from 'react';

const STORAGE_PREFIX = 'research-synthesizer:';

type SeedStatus = 'idle' | 'loading' | 'success' | 'error';

export default function DemoSeedPage() {
  const [status, setStatus] = useState<SeedStatus>('idle');
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState<Record<string, number>>({});

  async function handleSeed() {
    setStatus('loading');
    setMessage('Fetching seed data...');

    try {
      // Fetch seed_data.json from the demo/fixtures directory
      // This file is served statically — copy it to public/ or use an API route
      const resp = await fetch('/api/demo/seed');
      if (!resp.ok) {
        throw new Error(`Failed to fetch seed data: ${resp.status}`);
      }
      const seedData = await resp.json();

      const counts: Record<string, number> = {};

      // Seed patients
      if (seedData.patients) {
        localStorage.setItem(
          `${STORAGE_PREFIX}patients`,
          JSON.stringify(seedData.patients)
        );
        counts.patients = seedData.patients.length;
      }

      // Seed case sessions
      if (seedData.caseSessions) {
        localStorage.setItem(
          `${STORAGE_PREFIX}case-sessions`,
          JSON.stringify(seedData.caseSessions)
        );
        // Set first session as current
        if (seedData.caseSessions.length > 0) {
          localStorage.setItem(
            `${STORAGE_PREFIX}current-case-session`,
            JSON.stringify(seedData.caseSessions[0].id)
          );
        }
        counts.caseSessions = seedData.caseSessions.length;
      }

      // Seed released visit summaries
      if (seedData.releasedSummaries) {
        localStorage.setItem(
          `${STORAGE_PREFIX}released-summaries`,
          JSON.stringify(seedData.releasedSummaries)
        );
        counts.visitSummaries = seedData.releasedSummaries.length;
      }

      // Seed referral notifications
      if (seedData.referralNotifications) {
        localStorage.setItem(
          `${STORAGE_PREFIX}referral-notifications`,
          JSON.stringify(seedData.referralNotifications)
        );
        counts.referralNotifications = seedData.referralNotifications.length;
      }

      setStats(counts);
      setStatus('success');
      setMessage('Demo data seeded successfully! Reload the app to see the data.');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  function handleClear() {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    setStats({});
    setMessage(`Cleared ${keysToRemove.length} localStorage keys.`);
    setStatus('idle');
  }

  function handleSeedFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setStatus('loading');
      setMessage('Reading file...');

      try {
        const text = await file.text();
        const seedData = JSON.parse(text);

        const counts: Record<string, number> = {};

        if (seedData.patients) {
          localStorage.setItem(`${STORAGE_PREFIX}patients`, JSON.stringify(seedData.patients));
          counts.patients = seedData.patients.length;
        }
        if (seedData.caseSessions) {
          localStorage.setItem(`${STORAGE_PREFIX}case-sessions`, JSON.stringify(seedData.caseSessions));
          if (seedData.caseSessions.length > 0) {
            localStorage.setItem(`${STORAGE_PREFIX}current-case-session`, JSON.stringify(seedData.caseSessions[0].id));
          }
          counts.caseSessions = seedData.caseSessions.length;
        }
        if (seedData.releasedSummaries) {
          localStorage.setItem(`${STORAGE_PREFIX}released-summaries`, JSON.stringify(seedData.releasedSummaries));
          counts.visitSummaries = seedData.releasedSummaries.length;
        }

        setStats(counts);
        setStatus('success');
        setMessage('Seeded from file! Reload the app to see the data.');
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Failed to parse JSON');
      }
    };
    input.click();
  }

  return (
    <div style={{ maxWidth: 600, margin: '60px auto', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Demo Data Seeder</h1>
      <p style={{ color: '#666', marginTop: 8 }}>
        Populates localStorage with pre-collected clinical case data for demo recordings.
      </p>

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button
          onClick={handleSeed}
          disabled={status === 'loading'}
          style={{
            padding: '10px 20px',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: status === 'loading' ? 'wait' : 'pointer',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {status === 'loading' ? 'Seeding...' : 'Seed from API'}
        </button>

        <button
          onClick={handleSeedFromFile}
          disabled={status === 'loading'}
          style={{
            padding: '10px 20px',
            background: '#059669',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Seed from File
        </button>

        <button
          onClick={handleClear}
          style={{
            padding: '10px 20px',
            background: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Clear All
        </button>
      </div>

      {message && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 8,
            background: status === 'error' ? '#fef2f2' : status === 'success' ? '#f0fdf4' : '#f5f5f5',
            border: `1px solid ${status === 'error' ? '#fca5a5' : status === 'success' ? '#86efac' : '#d4d4d4'}`,
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>{message}</p>
          {Object.keys(stats).length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              {Object.entries(stats).map(([key, count]) => (
                <li key={key}>{key}: {count}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div style={{ marginTop: 32, padding: 16, background: '#f9fafb', borderRadius: 8, fontSize: 13 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>How to use:</h3>
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
          <li>Run <code>python demo/seed_all.py</code> to collect backend data</li>
          <li>Run <code>python demo/build_seed_bundle.py</code> to build seed_data.json</li>
          <li>Click <strong>Seed from File</strong> and select <code>demo/fixtures/seed_data.json</code></li>
          <li>Navigate to <code>/case</code> to see the seeded data</li>
        </ol>
      </div>
    </div>
  );
}
