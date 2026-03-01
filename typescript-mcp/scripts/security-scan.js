#!/usr/bin/env node

/**
 * Security scanning script for detecting secrets and API keys
 * Can be run manually or as part of CI/CD pipeline
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

const SECRET_PATTERNS = [
  { name: 'API Key', regex: /api[_-]?key\s*[=:]\s*['"][a-zA-Z0-9]{20,}['"]/gi },
  { name: 'Secret Key', regex: /secret[_-]?key\s*[=:]\s*['"][a-zA-Z0-9]{20,}['"]/gi },
  { name: 'Access Token', regex: /access[_-]?token\s*[=:]\s*['"][a-zA-Z0-9]{20,}['"]/gi },
  { name: 'Private Key', regex: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/gi },
  { name: 'AWS Secret', regex: /AWS[_-]?SECRET[_-]?ACCESS[_-]?KEY\s*[=:]\s*['"][A-Za-z0-9/+=]{40}['"]/gi },
  { name: 'Groq API Key', regex: /GROQ_API_KEY\s*[=:]\s*['"]sk-[a-zA-Z0-9]{20,}['"]/gi },
  { name: 'OpenAI API Key', regex: /OPENAI_API_KEY\s*[=:]\s*['"]sk-[a-zA-Z0-9]{20,}['"]/gi },
  { name: 'Anthropic API Key', regex: /ANTHROPIC_API_KEY\s*[=:]\s*['"]sk-ant-[a-zA-Z0-9]{20,}['"]/gi },
  { name: 'OpenRouter API Key', regex: /OPENROUTER_API_KEY\s*[=:]\s*['"]sk-or-v1-[a-zA-Z0-9]{20,}['"]/gi },
  { name: 'Context7 API Key', regex: /ctx7sk-[a-zA-Z0-9_-]{20,}/gi },
  { name: 'Reference API Key', regex: /ref-[a-zA-Z0-9_-]{20,}/gi },
  { name: 'GitHub Token', regex: /ghp_[a-zA-Z0-9]{36}/gi },
  { name: 'GitLab Token', regex: /glpat-[a-zA-Z0-9]{20,}/gi },
];

const EXCLUDED_DIRS = [
  'node_modules',
  'dist',
  'build',
  '.git',
  'coverage',
  'target',
  '__pycache__',
];

const EXCLUDED_FILES = [
  '.env.example',
  'security-scan.js',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
];

function shouldExclude(dirPath) {
  return EXCLUDED_DIRS.some(excluded => dirPath.includes(excluded));
}

function scanFile(filePath, rootDir) {
  const relativePath = relative(rootDir, filePath);
  
  if (EXCLUDED_FILES.includes(relativePath)) {
    return [];
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const findings = [];

    for (const pattern of SECRET_PATTERNS) {
      const matches = content.matchAll(pattern.regex);
      for (const match of matches) {
        findings.push({
          file: relativePath,
          type: pattern.name,
          line: content.substring(0, match.index).split('\n').length,
          match: match[0].substring(0, 50) + '...',
        });
      }
    }

    return findings;
  } catch (error) {
    return [];
  }
}

function scanDirectory(dirPath, rootDir) {
  let findings = [];

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (!shouldExclude(fullPath)) {
          findings = findings.concat(scanDirectory(fullPath, rootDir));
        }
      } else if (entry.isFile()) {
        findings = findings.concat(scanFile(fullPath, rootDir));
      }
    }
  } catch (error) {
    console.error(`${YELLOW}Warning: Cannot scan ${dirPath}${RESET}`);
  }

  return findings;
}

function main() {
  console.log('🔒 CodeSight Security Scanner');
  console.log('==============================\n');

  const rootDir = process.cwd();
  const findings = scanDirectory(rootDir, rootDir);

  if (findings.length === 0) {
    console.log(`${GREEN}✅ No secrets detected!${RESET}\n`);
    process.exit(0);
  }

  console.log(`${RED}❌ POTENTIAL SECRETS DETECTED:${RESET}\n`);
  
  for (const finding of findings) {
    console.log(`${YELLOW}File:${RESET} ${finding.file}`);
    console.log(`${YELLOW}Type:${RESET} ${finding.type}`);
    console.log(`${YELLOW}Line:${RESET} ${finding.line}`);
    console.log(`${YELLOW}Match:${RESET} ${finding.match}`);
    console.log('---');
  }

  console.log(`\n${RED}Total findings: ${findings.length}${RESET}`);
  console.log(`\n${YELLOW}Action Required:${RESET} Remove these secrets before committing!`);
  console.log(`${YELLOW}Tip:${RESET} Use .env files and add them to .gitignore\n`);

  process.exit(1);
}

main();
