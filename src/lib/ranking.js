// src/lib/ranking.js

export async function rankProfiles(env, query, profiles) {
  const rankingsById = new Map();

  // If there's no query, return default scores
  if (!query || query.trim().length === 0) {
    for (const p of profiles) {
      rankingsById.set(p.id, {
        id: p.id,
        score: 50,
        industry_fit: 50,
        complexity_score: 50,
        experience_years: 0,
        reasoning: 'No query provided for ranking.'
      });
    }
    return rankingsById;
  }

  // Build the ranking prompt
  const rankPrompt = `You are a senior technical recruiter. Analyze these profiles against this job description: "${query}".

For each profile, return a JSON object with:
- id (exactly as provided)
- score (0-100, overall match)
- industry_fit (0-100, how closely their company/industry matches the JD)
- complexity_score (0-100, based on keywords like architected, scaled, led, built, designed, managed)
- experience_years (numeric, based on years of relevant experience)
- reasoning (short 1-2 sentence explanation)

Profiles:
${JSON.stringify(profiles.map(p => ({ id: p.id, name: p.name, title: p.title, source: p.source, text: (p.text || '').slice(0, 2000) })))}

Return ONLY a valid JSON array. Do not wrap it in markdown. Do not add any extra text.`;

  try {
    // Call Workers AI with a 5-second timeout
    const aiRes = await Promise.race([
      env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'user', content: rankPrompt }]
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 5000))
    ]);

    const raw = aiRes.response;
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      for (const r of parsed) {
        if (r && typeof r.id === 'string') {
          rankingsById.set(r.id, {
            id: r.id,
            score: Math.min(100, Math.max(0, r.score || 50)),
            industry_fit: Math.min(100, Math.max(0, r.industry_fit || 50)),
            complexity_score: Math.min(100, Math.max(0, r.complexity_score || 50)),
            experience_years: Math.max(0, r.experience_years || 0),
            reasoning: r.reasoning || 'Matched based on AI analysis.'
          });
        }
      }
    }
  } catch (err) {
    // AI ranking failed — fall back to keyword overlap
    console.error('AI ranking failed, using keyword fallback:', err.message);
  }

  // Fallback: any profile without a ranking gets a keyword overlap score
  const jdWords = new Set((query || '').toLowerCase().split(/\W+/).filter(w => w.length > 2));
  
  for (const p of profiles) {
    if (!rankingsById.has(p.id)) {
      const pw = new Set((p.text || p.name || '').toLowerCase().split(/\W+/).filter(w => w.length > 2));
      const overlap = [...jdWords].filter(w => pw.has(w)).length;
      const totalJdWords = jdWords.size || 1;
      const score = Math.min(100, Math.max(0, Math.round((overlap / totalJdWords) * 100)));
      
      rankingsById.set(p.id, {
        id: p.id,
        score,
        industry_fit: 50,
        complexity_score: 50,
        experience_years: 0,
        reasoning: 'Keyword match fallback (AI unavailable or omitted this profile).'
      });
    }
  }

  return rankingsById;
}
