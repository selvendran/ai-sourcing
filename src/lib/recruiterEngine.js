// src/lib/recruiterEngine.js
export async function getRecruiterVector(env, recruiterLabel) {
  // 1. Fetch the last 50 profiles the recruiter has shortlisted or viewed
  const result = await env.DB.prepare(`
    SELECT profile_id FROM profile_actions 
    WHERE recruiter_label = ? AND action IN ('shortlisted', 'viewed')
    ORDER BY created_at DESC LIMIT 50
  `).bind(recruiterLabel).all();

  // If the recruiter has no history, return an empty vector
  if (!result.results || result.results.length === 0) {
    return { preferred_skills: [], preferred_domain: '' };
  }

  // 2. Fetch the actual skill data from the profiles table
  const profileIds = result.results.map(row => row.profile_id);
  if (profileIds.length === 0) return { preferred_skills: [], preferred_domain: '' };

  const placeholders = profileIds.map(() => '?').join(',');
  const skillResult = await env.DB.prepare(`
    SELECT skills FROM profiles WHERE id IN (${placeholders})
  `).bind(...profileIds).all();

  // 3. Parse the skills and count frequencies
  const skillFreq = {};
  for (const row of skillResult.results) {
    if (!row.skills) continue;
    // Assuming skills are stored as a comma-separated string
    const skills = typeof row.skills === 'string' 
      ? row.skills.split(',').map(s => s.trim().toLowerCase()) 
      : row.skills || [];
    for (const skill of skills) {
      skillFreq[skill] = (skillFreq[skill] || 0) + 1;
    }
  }

  // 4. Sort by frequency and return the top 5
  const topSkills = Object.entries(skillFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(k => k[0]);

  return { 
    preferred_skills: topSkills, 
    preferred_domain: '' // Placeholder for future domain analysis
  };
}
