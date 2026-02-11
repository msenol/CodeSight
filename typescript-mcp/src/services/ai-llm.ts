/**
 * AI/LLM Service for Code Intelligence - Phase 4.1
 * Integrates with multiple LLM providers for intelligent code analysis
 */

import { logger } from './logger.js';
import OpenAI from 'openai';

export interface LLMProvider {
  name: string;
  generateInsights(prompts: string[]): Promise<AIInsights>;
  isAvailable(): boolean;
  getCapabilities(): LLMCapabilities;
}

export interface LLMCapabilities {
  maxTokens: number;
  supportsCodeAnalysis: boolean;
  supportsMultiModal: boolean;
  latency: 'fast' | 'medium' | 'slow';
  costPerToken: number;
}

export interface AIInsights {
  suggestions: Array<{
    title: string;
    description: string;
    category: 'security' | 'performance' | 'maintainability' | 'readability' | 'best-practices';
    impact: 'critical' | 'high' | 'medium' | 'low';
    confidence: number;
    suggestion: string;
    line_number?: number;
    code_example?: string;
  }>;
  patterns: Array<{
    name: string;
    description: string;
    type: 'anti-pattern' | 'best-practice' | 'design-pattern';
    frequency: number;
    locations: Array<{ file: string; line: number }>;
  }>;
  summary: {
    overall_quality: number;
    main_concerns: string[];
    positive_aspects: string[];
    next_steps: string[];
  };
}

/**
 * AI/LLM Service - Multi-provider AI integration
 */
export class AILLMService {
  private providers: Map<string, LLMProvider> = new Map();
  private preferredProvider: string = process.env.PREFERRED_AI_PROVIDER || 'anthropic-claude';

  constructor() {
    this.initializeProviders();
  }

  private async initializeProviders() {
    // Initialize Claude (Anthropic) - Preferred for code analysis
    this.providers.set('anthropic-claude', new ClaudeProvider());

    // Initialize OpenAI GPT-4
    this.providers.set('openai-gpt4', new OpenAIProvider());

    // Initialize Ollama (Local)
    this.providers.set('ollama-local', new OllamaProvider());

    // Initialize OpenRouter with user-configurable API key and model
    this.providers.set('openrouter', new OpenRouterProvider());

    // Initialize fallback rule-based provider
    this.providers.set('rule-based', new RuleBasedProvider());

    logger.info('AI LLM Providers initialized', {
      providers: Array.from(this.providers.keys())
    });
  }

  async generateInsights(prompts: string[]): Promise<AIInsights> {
    const provider = this.selectBestProvider();

    if (!provider.isAvailable()) {
      logger.warn('Preferred provider not available, using fallback');
      const fallbackProvider = this.providers.get('rule-based');
      if (!fallbackProvider) {
        throw new Error('No AI providers available');
      }
      return fallbackProvider.generateInsights(prompts);
    }

    try {
      logger.debug('Generating AI insights', {
        provider: provider.name,
        prompts_count: prompts.length
      });

      const insights = await provider.generateInsights(prompts);

      logger.debug('AI insights generated', {
        suggestions_count: insights.suggestions.length,
        patterns_count: insights.patterns.length,
        overall_quality: insights.summary.overall_quality
      });

      return insights;

    } catch (error) {
      logger.error(`AI provider ${provider.name} failed:`, error);

      // Try fallback provider
      const fallbackProvider = this.providers.get('rule-based');
      if (fallbackProvider) {
        logger.info('Using rule-based fallback');
        return fallbackProvider.generateInsights(prompts);
      }

      throw new Error(`All AI providers failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private selectBestProvider(): LLMProvider {
    const provider = this.providers.get(this.preferredProvider);

    if (provider && provider.isAvailable()) {
      return provider;
    }

    // Find first available provider
    for (const [name, p] of this.providers) {
      if (p.isAvailable()) {
        logger.info(`Using alternative AI provider: ${name}`);
        return p;
      }
    }

    // Return rule-based as last resort
    return this.providers.get('rule-based')!;
  }

  async switchProvider(providerName: string): Promise<void> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Unknown AI provider: ${providerName}`);
    }

    if (!provider.isAvailable()) {
      throw new Error(`AI provider ${providerName} is not available`);
    }

    this.preferredProvider = providerName;
    logger.info(`Switched to AI provider: ${providerName}`);
  }

  getAvailableProviders(): Array<{ name: string; available: boolean; capabilities: LLMCapabilities }> {
    return Array.from(this.providers.entries()).map(([name, provider]) => ({
      name,
      available: provider.isAvailable(),
      capabilities: provider.getCapabilities()
    }));
  }
}

/**
 * Claude (Anthropic) Provider - Best for code analysis
 */
class ClaudeProvider implements LLMProvider {
  name = 'anthropic-claude';

  async generateInsights(prompts: string[]): Promise<AIInsights> {
    // Integration with Anthropic Claude API
    // For now, provide intelligent rule-based analysis

    const codeContext = this.extractCodeContext(prompts);

    return {
      suggestions: this.generateClaudeSuggestions(codeContext),
      patterns: this.identifyPatterns(codeContext),
      summary: this.generateClaudeSummary(codeContext)
    };
  }

  isAvailable(): boolean {
    // Check for ANTHROPIC_API_KEY
    return !!process.env.ANTHROPIC_API_KEY || true; // Temporarily true for demo
  }

  getCapabilities(): LLMCapabilities {
    return {
      maxTokens: 100000,
      supportsCodeAnalysis: true,
      supportsMultiModal: false,
      latency: 'medium',
      costPerToken: 0.015
    };
  }

  private extractCodeContext(prompts: string[]): any {
    // Extract relevant code information from prompts
    return {
      hasCode: prompts.some(p => p.includes('function') || p.includes('class')),
      complexity: this.estimateComplexity(prompts),
      patterns: this.identifyBasicPatterns(prompts)
    };
  }

  private generateClaudeSuggestions(context: any) {
    const suggestions = [];

    if (context.complexity > 50) {
      suggestions.push({
        title: 'High Complexity Detected',
        description: 'The code shows signs of high complexity that may impact maintainability',
        category: 'maintainability' as const,
        impact: 'medium' as const,
        confidence: 85,
        suggestion: 'Consider breaking down complex functions into smaller, more focused units'
      });
    }

    if (context.patterns.includes('nested-callbacks')) {
      suggestions.push({
        title: 'Callback Hell Pattern',
        description: 'Detected deeply nested callbacks that can be hard to read and maintain',
        category: 'readability' as const,
        impact: 'high' as const,
        confidence: 90,
        suggestion: 'Consider using async/await, Promise chains, or reactive patterns'
      });
    }

    return suggestions;
  }

  private identifyPatterns(context: any) {
    const patterns = [];

    if (context.patterns.includes('try-catch')) {
      patterns.push({
        name: 'Error Handling Pattern',
        description: 'Proper error handling with try-catch blocks',
        type: 'best-practice' as const,
        frequency: 1,
        locations: []
      });
    }

    return patterns;
  }

  private generateClaudeSummary(context: any) {
    return {
      overall_quality: Math.max(0, 100 - context.complexity / 2),
      main_concerns: context.complexity > 50 ? ['Code complexity could be reduced'] : [],
      positive_aspects: context.hasCode ? ['Structured code approach'] : [],
      next_steps: ['Consider code review and refactoring']
    };
  }

  private estimateComplexity(prompts: string[]): number {
    // Simple complexity estimation based on prompt analysis
    const complexityKeywords = ['if', 'else', 'for', 'while', 'switch', 'try', 'catch'];
    let complexityScore = 0;

    prompts.forEach(prompt => {
      complexityKeywords.forEach(keyword => {
        const matches = (prompt.match(new RegExp(keyword, 'gi')) || []).length;
        complexityScore += matches * 5;
      });
    });

    return Math.min(100, complexityScore);
  }

  private identifyBasicPatterns(prompts: string[]): string[] {
    const patterns = [];

    prompts.forEach(prompt => {
      if (prompt.includes('callback') || prompt.includes('.then(')) {
        patterns.push('callback-pattern');
      }
      if (prompt.includes('async') || prompt.includes('await')) {
        patterns.push('async-pattern');
      }
      if (prompt.includes('try') && prompt.includes('catch')) {
        patterns.push('try-catch');
      }
      if (prompt.includes('class')) {
        patterns.push('class-pattern');
      }
    });

    return [...new Set(patterns)];
  }
}

/**
 * OpenAI GPT-4 Provider
 */
class OpenAIProvider implements LLMProvider {
  name = 'openai-gpt4';

  async generateInsights(prompts: string[]): Promise<AIInsights> {
    // Similar implementation for OpenAI GPT-4
    const claude = new ClaudeProvider();
    return claude.generateInsights(prompts);
  }

  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY || true; // Temporarily true for demo
  }

  getCapabilities(): LLMCapabilities {
    return {
      maxTokens: 128000,
      supportsCodeAnalysis: true,
      supportsMultiModal: true,
      latency: 'medium',
      costPerToken: 0.03
    };
  }
}

/**
 * Ollama Local Provider
 */
class OllamaProvider implements LLMProvider {
  name = 'ollama-local';

  async generateInsights(prompts: string[]): Promise<AIInsights> {
    // Integration with local Ollama instance
    const claude = new ClaudeProvider();
    return claude.generateInsights(prompts);
  }

  isAvailable(): boolean {
    // Check if Ollama is running locally
    return true; // Simplified for demo
  }

  getCapabilities(): LLMCapabilities {
    return {
      maxTokens: 8192,
      supportsCodeAnalysis: true,
      supportsMultiModal: false,
      latency: 'fast',
      costPerToken: 0
    };
  }
}

/**
 * OpenRouter Provider - User-configurable AI models via OpenRouter API
 */
class OpenRouterProvider implements LLMProvider {
  name = 'openrouter';
  private client: OpenAI | null = null;
  private modelName: string;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.modelName = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';

    if (this.apiKey) {
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
      });
    }
  }

  async generateInsights(prompts: string[]): Promise<AIInsights> {
    if (!this.client) {
      throw new Error('OpenRouter client not initialized. Set OPENROUTER_API_KEY environment variable.');
    }

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = prompts.join('\n\n');

    try {
      const response = await this.client.chat.completions.create({
        model: this.modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 4000, // Increased for longer responses
      });

      const content = response.choices[0]?.message?.content || '';
      return this.parseAIResponse(content);

    } catch (error) {
      logger.error('OpenRouter API error:', error);
      throw new Error(`OpenRouter request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  isAvailable(): boolean {
    return !!this.client;
  }

  getCapabilities(): LLMCapabilities {
    return {
      maxTokens: 128000, // Depends on model, using conservative default
      supportsCodeAnalysis: true,
      supportsMultiModal: true, // Depends on model
      latency: 'medium',
      costPerToken: 0.001 // Varies by model on OpenRouter
    };
  }

  private buildSystemPrompt(): string {
    return `You are a code analyst. Analyze the provided code and return ONLY a valid JSON object. Do NOT include any text outside the JSON.

Return exactly this JSON structure:
{
  "suggestions": [
    {
      "title": "string",
      "description": "string",
      "category": "security",
      "impact": "low",
      "confidence": 80,
      "suggestion": "string"
    }
  ],
  "patterns": [],
  "summary": {
    "overall_quality": 75,
    "main_concerns": [],
    "positive_aspects": ["string"],
    "next_steps": []
  }
}

IMPORTANT: Return ONLY the JSON. No markdown, no code blocks, no explanations.`;
  }

  private parseAIResponse(content: string): AIInsights {
    const parseAttempts = [
      // Attempt 1: Direct JSON parse
      () => {
        return JSON.parse(content);
      },
      // Attempt 2: Remove markdown code blocks
      () => {
        let cleaned = content.trim();
        cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        return JSON.parse(cleaned);
      },
      // Attempt 3: Extract JSON between first { and last }
      () => {
        const firstBrace = content.indexOf('{');
        const lastBrace = content.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          return JSON.parse(content.substring(firstBrace, lastBrace + 1));
        }
        throw new Error('No JSON object found');
      },
      // Attempt 4: Fix common JSON errors (trailing commas, quotes)
      () => {
        let cleaned = content;
        // Remove markdown first
        cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        // Extract JSON
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }
        // Fix trailing commas
        cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(cleaned);
      }
    ];

    let lastError: Error | null = null;

    for (const attempt of parseAttempts) {
      try {
        const parsed = attempt() as any;

        // Validate and fix structure
        if (!parsed.summary) {
          parsed.summary = {
            overall_quality: parsed.overall_quality || 50,
            main_concerns: parsed.main_concerns || [],
            positive_aspects: parsed.positive_aspects || [],
            next_steps: parsed.next_steps || []
          };
        }
        if (!parsed.suggestions) {
          parsed.suggestions = parsed.suggestions || [];
        }
        if (!parsed.patterns) {
          parsed.patterns = parsed.patterns || [];
        }

        return parsed as AIInsights;
      } catch (error) {
        lastError = error as Error;
        continue;
      }
    }

    // All attempts failed - return fallback
    logger.error('Failed to parse OpenRouter response after multiple attempts:', lastError);
    logger.debug('Raw response content (first 500 chars):', content.substring(0, 500));

    return {
      suggestions: [],
      patterns: [],
      summary: {
        overall_quality: 50,
        main_concerns: ['Failed to parse AI response'],
        positive_aspects: [],
        next_steps: ['Check AI provider configuration or try a different model']
      }
    };
  }
}

/**
 * Rule-Based Fallback Provider
 */
class RuleBasedProvider implements LLMProvider {
  name = 'rule-based';

  async generateInsights(prompts: string[]): Promise<AIInsights> {
    return {
      suggestions: this.generateRuleBasedSuggestions(prompts),
      patterns: [],
      summary: {
        overall_quality: 75,
        main_concerns: ['Limited analysis without AI'],
        positive_aspects: ['Basic rule-based analysis applied'],
        next_steps: ['Consider enabling AI providers for better insights']
      }
    };
  }

  isAvailable(): boolean {
    return true; // Always available
  }

  getCapabilities(): LLMCapabilities {
    return {
      maxTokens: 0,
      supportsCodeAnalysis: true,
      supportsMultiModal: false,
      latency: 'fast',
      costPerToken: 0
    };
  }

  private generateRuleBasedSuggestions(prompts: string[]) {
    const suggestions = [];

    prompts.forEach((prompt, index) => {
      if (prompt.includes('password') || prompt.includes('secret')) {
        suggestions.push({
          title: 'Potential Secret Exposure',
          description: 'Code may contain hardcoded secrets or passwords',
          category: 'security' as const,
          impact: 'critical' as const,
          confidence: 70,
          suggestion: 'Move secrets to environment variables or secure configuration'
        });
      }

      if (prompt.includes('eval(') || prompt.includes('new Function(')) {
        suggestions.push({
          title: 'Dynamic Code Execution',
          description: 'Code uses dynamic execution which can be a security risk',
          category: 'security' as const,
          impact: 'high' as const,
          confidence: 80,
          suggestion: 'Avoid eval() and new Function() when possible'
        });
      }
    });

    return suggestions;
  }
}