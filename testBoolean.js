import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const GROQ_KEY = process.env.GROQ_API_KEY;

async function run() {
  // --- CHANGE THIS TEXT to test different JDs ---
  const jdText = `Senior Full Stack Engineer with Python and React experience`;
  // ----------------------------------------------

  const prompt = `Write a simple Google X-Ray boolean string for sourcing candidates on LinkedIn.
Rules:
1. Start with: site:linkedin.com/in
2. Use the job title in quotes: "{title}"
3. Use location: if present.
4. Combine skills with AND and OR.
5. Return ONLY the plain string. No explanations. No markdown.

Job Description: ${jdText}`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1
    })
  });

  const data = await res.json();
  const booleanString = data.choices[0].message.content.trim();

  console.log('\n=== GENERATED X-RAY STRING ===');
  console.log(booleanString);
  console.log('==============================\n');
  console.log('Copy the string above and paste it into Google to verify results.');
}

run().catch(console.error);
