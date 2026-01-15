/**
 * SMART Text Highlighter
 * Highlights SMART elements in action text with color coding
 */

export type HighlightType = 'specific' | 'measurable' | 'achievable' | 'relevant' | 'timebound' | 'weak' | 'normal';

export interface HighlightedSegment {
  text: string;
  type: HighlightType;
  start: number;
  end: number;
}

// Patterns for each SMART criterion
const PATTERNS: Record<Exclude<HighlightType, 'normal'>, RegExp[]> = {
  specific: [
    /\b([A-Z][a-z]+)\s+(will|agreed|has agreed|have agreed|is going to|shall)\b/gi,
    /\b(at|in|to|from|via|through)\s+[A-Za-z0-9\s]+(?:centre|center|library|office|website|online)\b/gi,
    /\b(apply|submit|attend|complete|register|create|update|search|contact|call|email|visit|speak|meet|write|prepare|research)\b/gi,
  ],
  measurable: [
    /\b(\d+)\s*(applications?|interviews?|contacts?|calls?|jobs?|opportunities|employers?|CVs?|hours?|minutes?|days?|weeks?)\b/gi,
    /\b(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})\b/g,
    /\b(\d{1,2})(st|nd|rd|th)?\s*(of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi,
    /\b(by|before|within)\s+\d+\s*(days?|weeks?|months?)\b/gi,
  ],
  achievable: [
    /\b(agreed|discussed|realistic|achievable|committed|confirmed|understood|willing)\b/gi,
    /\b(with support|help from|assistance|guidance|together|advisor will)\b/gi,
    /\b(commits? to|undertakes? to|pledges? to|promises? to|has agreed to)\b/gi,
  ],
  relevant: [
    /\b(barrier|challenge|obstacle|employment|job|work|career|role|position|opportunity)\b/gi,
    /\b(help|enable|allow|support|improve|increase|enhance|develop|build|gain|acquire|address|overcome|resolve)\b/gi,
  ],
  timebound: [
    /\b(by|before|until|within|no later than)\s+(\d|next|this|end of)[^\n,]*/gi,
    /\breview(ed)?\s*(in|on|at|within|after)?\s*(\d+\s*)?(days?|weeks?|months?|next)?/gi,
    /\b(today|tomorrow|this week|next week|this month|next month|immediate)\b/gi,
  ],
  weak: [
    /\b(try|maybe|might|possibly|consider|hope|attempt|think about|look into|explore)\b/gi,
    /\b(should be|could be|would be|may be|might be)\b/gi,
    /\b(if possible|when possible|as soon as|sometime|eventually|at some point)\b/gi,
  ],
};

// Colors for each type
export const HIGHLIGHT_COLORS: Record<HighlightType, { bg: string; text: string; border: string }> = {
  specific: { bg: 'bg-green-500/20', text: 'text-green-700 dark:text-green-400', border: 'border-green-500/30' },
  measurable: { bg: 'bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-500/30' },
  achievable: { bg: 'bg-purple-500/20', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-500/30' },
  relevant: { bg: 'bg-orange-500/20', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-500/30' },
  timebound: { bg: 'bg-cyan-500/20', text: 'text-cyan-700 dark:text-cyan-400', border: 'border-cyan-500/30' },
  weak: { bg: 'bg-red-500/20', text: 'text-red-700 dark:text-red-400', border: 'border-red-500/30' },
  normal: { bg: '', text: '', border: '' },
};

export const HIGHLIGHT_LABELS: Record<Exclude<HighlightType, 'normal'>, string> = {
  specific: 'Specific',
  measurable: 'Measurable',
  achievable: 'Achievable',
  relevant: 'Relevant',
  timebound: 'Time-bound',
  weak: 'Weak Language',
};

interface Match {
  start: number;
  end: number;
  type: HighlightType;
  text: string;
}

export function highlightSmartElements(text: string): HighlightedSegment[] {
  if (!text) return [];
  
  const matches: Match[] = [];
  
  // Find all matches for each pattern type
  for (const [type, patterns] of Object.entries(PATTERNS) as [Exclude<HighlightType, 'normal'>, RegExp[]][]) {
    for (const pattern of patterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          type,
          text: match[0],
        });
      }
    }
  }
  
  // Sort by start position
  matches.sort((a, b) => a.start - b.start);
  
  // Remove overlapping matches (keep first/highest priority)
  const filteredMatches: Match[] = [];
  let lastEnd = 0;
  
  for (const match of matches) {
    if (match.start >= lastEnd) {
      filteredMatches.push(match);
      lastEnd = match.end;
    }
  }
  
  // Build segments
  const segments: HighlightedSegment[] = [];
  let currentIndex = 0;
  
  for (const match of filteredMatches) {
    // Add normal text before this match
    if (match.start > currentIndex) {
      segments.push({
        text: text.slice(currentIndex, match.start),
        type: 'normal',
        start: currentIndex,
        end: match.start,
      });
    }
    
    // Add the matched segment
    segments.push({
      text: match.text,
      type: match.type,
      start: match.start,
      end: match.end,
    });
    
    currentIndex = match.end;
  }
  
  // Add remaining text
  if (currentIndex < text.length) {
    segments.push({
      text: text.slice(currentIndex),
      type: 'normal',
      start: currentIndex,
      end: text.length,
    });
  }
  
  return segments;
}

export function getMatchesByType(text: string): Record<Exclude<HighlightType, 'normal'>, string[]> {
  const result: Record<Exclude<HighlightType, 'normal'>, string[]> = {
    specific: [],
    measurable: [],
    achievable: [],
    relevant: [],
    timebound: [],
    weak: [],
  };
  
  for (const [type, patterns] of Object.entries(PATTERNS) as [Exclude<HighlightType, 'normal'>, RegExp[]][]) {
    for (const pattern of patterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = regex.exec(text)) !== null) {
        if (!result[type].includes(match[0].toLowerCase())) {
          result[type].push(match[0]);
        }
      }
    }
  }
  
  return result;
}
