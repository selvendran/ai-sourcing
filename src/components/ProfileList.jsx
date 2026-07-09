import { useEffect, useState } from 'react';

export function ProfileList({ apiKey, apiUrl }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${apiUrl}/search`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': apiKey 
      },
      body: JSON.stringify({ query: "", limit: 50 })
    })
    .then(res => res.json())
    .then(data => {
      setProfiles(data.results || []);
      setLoading(false);
    })
    .catch(err => {
      console.error("Error fetching profiles:", err);
      setLoading(false);
    });
  }, [apiKey, apiUrl]);

  if (loading) return <div className="text-white p-4">Loading candidates...</div>;

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-xl font-bold text-white">Database ({profiles.length} profiles)</h2>
      {profiles.map((p) => (
        <div key={p.id} className="bg-gray-800 p-4 rounded border border-gray-700 text-white">
          <h3 className="font-bold">{p.name || "Unknown"}</h3>
          <p className="text-sm text-gray-400">{p.title}</p>
          <div className="flex gap-2 mt-2">
            <span className="bg-blue-900 px-2 py-1 rounded text-xs">Score: {Math.round(p.score)}</span>
            <span className="bg-green-900 px-2 py-1 rounded text-xs">{p.source}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
