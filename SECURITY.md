# Security Policy

## Pre-Commit Security Hooks

This project uses Husky pre-commit hooks to prevent accidental commits of sensitive data.

### Automated Security Checks

The pre-commit hook automatically scans for:

- ✅ API keys (Groq, OpenAI, Anthropic, OpenRouter, etc.)
- ✅ Access tokens
- ✅ Private keys (RSA, EC, DSA, OPENSSH)
- ✅ AWS credentials
- ✅ GitHub/GitLab tokens
- ✅ .mcp.json files (contains API keys)
- ✅ .env files with secrets

### Installation

```bash
cd typescript-mcp
npm install
npm run prepare  # Sets up Husky hooks
```

### Manual Security Scan

```bash
# Run security scan manually
npm run security:check

# Or from project root
node typescript-mcp/scripts/security-scan.js
```

## Protected Files

The following files are automatically blocked from commits:

| File Pattern | Reason |
|-------------|---------|
| `.mcp.json` | Contains API keys |
| `.env` | Environment secrets |
| `.env.local` | Local environment |
| `.env.*.local` | Environment overrides |
| `*.pem` | Private keys |
| `*.key` | Encryption keys |
| `credentials.json` | Service account credentials |

## If You Accidentally Committed Secrets

1. **Revoke the secret immediately**
2. **Remove from git history:**
   ```bash
   git filter-branch -f --index-filter \
     "git rm --cached --ignore-unmatch path/to/secret" \
     --prune-empty --tag-name-filter cat -- --all
   git push origin --force
   ```
3. **Create new secret** and update your configuration

## Security Best Practices

1. **Use environment variables** for all secrets
2. **Never commit** `.env` files
3. **Use `.env.example`** with placeholder values
4. **Rotate secrets** regularly
5. **Use separate keys** for development and production

## Reporting Security Issues

If you discover a security vulnerability, please:

1. Do not open a public issue
2. Email: security@codesight.dev (if available)
3. Allow 48 hours for response

## Detected Patterns

The security scanner checks for these patterns:

```javascript
// API Keys
- api_key = "..."
- apikey = "..."
- GROQ_API_KEY = "sk-..."
- OPENAI_API_KEY = "sk-..."
- ANTHROPIC_API_KEY = "sk-ant-..."
- OPENROUTER_API_KEY = "sk-or-v1-..."

// Tokens
- access_token = "..."
- github_token = "ghp_..."
- gitlab_token = "glpat-..."

// Private Keys
- -----BEGIN PRIVATE KEY-----
- -----BEGIN RSA PRIVATE KEY-----

// Cloud Credentials
- AWS_SECRET_ACCESS_KEY
```

## CI/CD Integration

Add security scanning to your CI/CD pipeline:

```yaml
# GitHub Actions example
- name: Security Scan
  run: |
    cd typescript-mcp
    npm run security:check
```

## Questions?

For security-related questions, contact the maintainers.
