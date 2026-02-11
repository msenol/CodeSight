/**
 * AI Helper Utilities
 *
 * Shared utilities for AI-powered tools to promote DRY principles.
 */

/**
 * Deduplicate AI suggestions by title and category
 *
 * This prevents duplicate suggestions from appearing in AI tool results,
 * which can happen when AI models return similar recommendations.
 *
 * @param suggestions - Array of AI suggestion objects
 * @returns Deduplicated array of suggestions
 */
export function deduplicateSuggestions(suggestions: any[]): any[] {
  if (!Array.isArray(suggestions)) {
    return [];
  }

  const seen = new Set<string>();
  return suggestions.filter(s => {
    const key = `${s.title || s.name || 'unknown'}-${s.category || s.type || 'general'}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Normalize AI suggestion object structure
 *
 * Ensures all suggestions have consistent field names for better deduplication.
 *
 * @param suggestion - Raw suggestion object from AI
 * @returns Normalized suggestion object
 */
export function normalizeSuggestion(suggestion: any): any {
  return {
    title: suggestion.title || suggestion.name || 'Unnamed Issue',
    description: suggestion.description || suggestion.message || '',
    category: suggestion.category || suggestion.type || 'general',
    severity: suggestion.severity || suggestion.impact || 'medium',
    confidence: suggestion.confidence || 80,
    suggestion: suggestion.suggestion || suggestion.recommendation || '',
    line_number: suggestion.line_number || suggestion.line || 0,
    code_example: suggestion.code_example || suggestion.example || '',
  };
}

/**
 * Fix line numbers in AI results
 *
 * Some AI tools return :0 for line numbers. This function attempts
 * to extract actual line numbers from the code snippet or context.
 *
 * @param suggestions - Array of AI suggestions
 * @param codeSnippet - Optional code snippet to analyze
 * @returns Array of suggestions with fixed line numbers
 */
export function fixLineNumbers(suggestions: any[], codeSnippet?: string): any[] {
  if (!Array.isArray(suggestions)) {
    return [];
  }

  return suggestions.map(s => {
    // If line number is 0 or undefined, try to extract from code
    if ((!s.line_number || s.line_number === 0) && codeSnippet) {
      // Try to find the relevant line in the code snippet
      const lines = codeSnippet.split('\n');
      const searchText = s.title || s.name || '';

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(searchText.substring(0, 10))) {
          return { ...s, line_number: i + 1 };
        }
      }
    }

    return s;
  });
}
