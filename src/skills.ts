interface SkillKeyword {
  skills: string[];
  words: string[];
}

interface SkillMatch {
  word: string;
  skills: string[];
}

interface SkillSuggestion {
  skills: string[];
  matches: SkillMatch[];
}

export const SKILL_KEYWORDS: SkillKeyword[] = [
  { skills: ['qa-tester'], words: ['test', 'qa', 'check ui', 'verify', 'screenshot', 'visual'] },
  { skills: ['en-ua-auditor'], words: ['translat', 'i18n', 'string', 'locali', 'uk/en', 'en/uk'] },
  { skills: ['ui-ux-design', 'frontend-design'], words: ['design', 'ui', 'ux', 'layout', 'style', 'css', 'visual', 'polish'] },
  { skills: ['senior-frontend'], words: ['component', 'page', 'react', 'hook', 'feature', 'form', 'modal', 'sidebar', 'button'] },
  { skills: ['databases', 'backend-development'], words: ['schema', 'database', 'table', 'migration', 'rls', 'sql', 'supabase'] },
  { skills: ['backend-development'], words: ['api', 'auth', 'storage', 'bucket', 'rpc', 'policy'] },
  { skills: ['video-recorder'], words: ['video', 'demo', 'record', 'playwright'] },
  { skills: ['debugging'], words: ['debug', 'fix', 'bug', 'broken', 'crash', 'error'] },
  { skills: ['refactoring-expert'], words: ['refactor', 'cleanup', 'extract', 'simplif'] },
];

export function suggestSkills(text: string): SkillSuggestion {
  if (!text) return { skills: [], matches: [] };
  const lower = text.toLowerCase();
  const matched = new Set<string>();
  const matchedWords: SkillMatch[] = [];
  for (const { skills, words } of SKILL_KEYWORDS) {
    const hits = words.filter(w => lower.includes(w));
    if (hits.length > 0) {
      skills.forEach(s => matched.add(s));
      matchedWords.push(...hits.map(w => ({ word: w, skills })));
    }
  }
  return { skills: [...matched], matches: matchedWords };
}
