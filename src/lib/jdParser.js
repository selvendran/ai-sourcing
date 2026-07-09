import { getRecruiterVector } from './recruiterEngine.js';

export const PLATFORM_CONFIGS = {
  linkedin: { label: "LinkedIn", site: "site:linkedin.com/in", exclude: "-jobs -dir -resume" },
  github: { label: "GitHub", site: "site:github.com", exclude: "-jobs -orgs -topics" },
  stackoverflow: { label: "Stack Overflow", site: "site:stackoverflow.com/users", exclude: "" },
  twitter: { label: "X / Twitter", site: "(site:twitter.com OR site:x.com)", exclude: "-status -search" },
  dribbble: { label: "Dribbble", site: "site:dribbble.com", exclude: "-shots -jobs" },
  wellfound: { label: "Wellfound", site: "site:wellfound.com/u", exclude: "" }
};

function extractMinExperience(jdText) {
  const timeMatches = jdText.match(/(\d+)\+?\s*(?:years|year|yrs|yr)/gi);
  if (timeMatches && timeMatches.length > 0) {
    const years = timeMatches.map((m) => parseInt(m.match(/\d+/)[0], 10));
    return Math.max(...years);
  }
  return 3;
}

function generateTenureString(minExperience) {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - (minExperience + 5);
  const endYear = currentYear - minExperience + 1;
  const years = [];
  for (let y = startYear; y <= endYear; y++) years.push(y.toString());
  return `(${years.map((y) => `"${y}"`).join(" OR ")})`;
}

function buildSmartTechString(jdText) {
  // Master list of technologies to look for
  const masterTechList = [
    "python", "java", "ruby", "golang", "go", "c#", "node.js", 
    "javascript", "typescript", "react", "vue", "angular", "next.js", "tailwind",
    "distributed", "large scale", "low latency", "in-memory cache", "fault tolerant", "event processing", "recommendation engine", "behavior analysis",
    "sql", "postgresql", "mysql", "mongodb", "redis", "dynamodb", "kafka", "graphql", "rest",
    "aws", "gcp", "azure", "docker", "kubernetes", "terraform", "ci/cd", "datadog"
  ];

  const foundTech = masterTechList.filter(tech => {
    const regex = new RegExp(`\\b${tech.replace(/\./g, '\\.')}\\b`, 'i');
    return regex.test(jdText);
  });

  // Dynamically categorize only what we found in the JD
  const categories = {
    backend: foundTech.filter(t => ["python", "java", "ruby", "golang", "go", "c#", "node.js"].includes(t)),
    frontend: foundTech.filter(t => ["javascript", "typescript", "react", "vue", "angular", "next.js", "tailwind"].includes(t)),
    architecture: foundTech.filter(t => ["distributed", "large scale", "low latency", "in-memory cache", "fault tolerant", "event processing", "recommendation engine", "behavior analysis"].includes(t)),
    data: foundTech.filter(t => ["sql", "postgresql", "mysql", "mongodb", "redis", "dynamodb", "kafka", "graphql", "rest"].includes(t))
  };

  const fullstackRequirements = [];
  
  // Enforce Backend AND Frontend
  if (categories.backend.length > 0 && categories.frontend.length > 0) {
    fullstackRequirements.push(`("${categories.backend.join('" OR "')}") AND ("${categories.frontend.join('" OR "')}")`);
  } else if (categories.backend.length > 0 || categories.frontend.length > 0) {
    const combined = [...categories.backend, ...categories.frontend];
    fullstackRequirements.push(`("${combined.join('" OR "')}")`);
  }

  // Add architecture and data as mandatory AND requirements
  if (categories.architecture.length > 0) fullstackRequirements.push(`("${categories.architecture.join('" OR "')}")`);
  if (categories.data.length > 0) fullstackRequirements.push(`("${categories.data.join('" OR "')}")`);

  return fullstackRequirements.join(" AND ");
}

export function buildSearchString(jdText, platform) {
  if (!platform || !PLATFORM_CONFIGS[platform]) platform = "linkedin";
  
  const minExp = extractMinExperience(jdText);
  const smartTech = buildSmartTechString(jdText);
  
  const baseTitle = '("Engineer" OR "Developer" OR "Software")';
  const platformString = PLATFORM_CONFIGS[platform].site;
  const negativeFilters = PLATFORM_CONFIGS[platform].exclude || '';
  
  const queryParts = [platformString];
  if (platform === "linkedin") queryParts.push(generateTenureString(minExp));
  
  queryParts.push(baseTitle);
  if (smartTech) queryParts.push(smartTech);
  queryParts.push(negativeFilters);

  return queryParts.join(" AND ");
}

export async function parseJD(env, jdText, recruiterLabel) {
  const vector = await getRecruiterVector(env, recruiterLabel);
  const queries = {};
  for (const platformKey of Object.keys(PLATFORM_CONFIGS)) {
    queries[platformKey] = {
      label: PLATFORM_CONFIGS[platformKey].label,
      query: buildSearchString(jdText, platformKey)
    };
  }
  return { queries, recruiter_vector: vector };
}