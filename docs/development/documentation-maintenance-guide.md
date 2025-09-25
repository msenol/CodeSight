# Documentation Maintenance Guide

## Overview

This guide provides comprehensive procedures for maintaining documentation consistency and quality in the Code Intelligence MCP Server project.

## Quick Start

Run the automated consistency check:

```bash
./scripts/check-version-consistency.sh
```

## Documentation Structure

### Core Documentation Files

1. **CLAUDE.md** (< 10KB)
   - AI assistant guidance
   - Critical development rules
   - Project overview
   - Keep concise and focused

2. **README.md**
   - Project setup instructions
   - Quick start guide
   - Architecture overview
   - Docker configuration

3. **Package Configuration**
   - `package.json` - Root project
   - `typescript-mcp/package.json` - MCP server
   - `rust-core/Cargo.toml` - Rust core

### Documentation Directories

```
docs/
├── development/         # Developer guides
│   ├── documentation-maintenance-guide.md
│   └── contribution-guide.md
├── api/                # API documentation
│   └── endpoint-reference.md
├── architecture/       # System design
│   └── system-overview.md
└── CHANGELOG.md       # Version history
```

## Maintenance Procedures

### Daily Checks

1. Run consistency check script
2. Review health score (target: 90+/100)
3. Address any critical (red) issues immediately

### Weekly Reviews

1. Update version references
2. Sync documentation with code changes
3. Review and update API documentation
4. Check for outdated examples

### Monthly Updates

1. Full documentation audit
2. Archive obsolete documentation
3. Update performance benchmarks
4. Review and update diagrams

## Version Management

### Current Version: v0.1.0

Version format: `vMAJOR.MINOR.PATCH[-SUFFIX]`

- **MAJOR**: Breaking changes
- **MINOR**: New features
- **PATCH**: Bug fixes
- **SUFFIX**: dev, alpha, beta, rc

### Version Update Checklist

- [ ] Update package.json (root)
- [ ] Update typescript-mcp/package.json
- [ ] Update rust-core/Cargo.toml
- [ ] Update CLAUDE.md version reference
- [ ] Update README.md version reference
- [ ] Add entry to CHANGELOG.md

## Documentation Standards

### File Size Limits

- **CLAUDE.md**: < 10KB (ideal), < 40KB (max)
- **README.md**: < 20KB
- **API docs**: < 50KB per file

### Writing Style

1. **Concise**: Direct and to the point
2. **Clear**: Simple language, avoid jargon
3. **Consistent**: Use standard formatting
4. **Current**: Always use dynamic dates

### Code Examples

- Test all code examples before documenting
- Use TypeScript/JavaScript for frontend examples
- Use Rust for core engine examples
- Include error handling

### Formatting Guidelines

- Use GitHub-flavored Markdown
- Headers: `#` for main, `##` for sections
- Code blocks: Specify language
- Lists: Use `-` for unordered, `1.` for ordered
- Links: Use relative paths for internal docs

## Quality Metrics

### Health Score Components

1. **Version Consistency** (30%)
   - All files show same version
   - No outdated references

2. **Content Coverage** (25%)
   - All features documented
   - API endpoints documented
   - Test procedures included

3. **Link Validity** (20%)
   - No broken internal links
   - External links verified

4. **Code Accuracy** (15%)
   - Examples tested and working
   - Commands verified

5. **Structure Quality** (10%)
   - Logical organization
   - Consistent formatting

### Target Metrics

- Health Score: ≥ 90/100
- Documentation Coverage: ≥ 80%
- Link Success Rate: 100%
- Example Success Rate: 100%

## Common Issues and Solutions

### Issue: Version Mismatch

**Solution:**
```bash
# Update all version references
npm version 0.1.0-dev --no-git-tag-version
cd typescript-mcp && npm version 0.1.0-dev --no-git-tag-version
# Update rust-core/Cargo.toml manually
```

### Issue: CLAUDE.md Too Large

**Solution:**
1. Move detailed content to specialized docs
2. Keep only critical information
3. Use references to other documents

### Issue: Broken Links

**Solution:**
```bash
# Find broken links
grep -r "\[.*\](" docs/ --include="*.md" | grep -v http
# Verify each link exists
```

### Issue: Outdated Examples

**Solution:**
1. Test all examples in current environment
2. Update with current API/syntax
3. Add version notes if needed

## Automated Tools

### Version Consistency Check

Location: `./scripts/check-version-consistency.sh`

Features:
- Version synchronization check
- Date consistency verification
- File size monitoring
- Link validation
- Health score calculation

### Documentation Generator (Future)

Planned features:
- Auto-generate API docs from code
- Extract JSDoc/RustDoc comments
- Create dependency graphs
- Generate test coverage reports

## Best Practices

1. **Document as You Code**
   - Update docs with each feature
   - Include in PR reviews
   - Test documentation examples

2. **Regular Maintenance**
   - Run checks before commits
   - Weekly documentation reviews
   - Monthly comprehensive audits

3. **Version Control**
   - Commit docs with related code
   - Use meaningful commit messages
   - Tag documentation releases

4. **Collaboration**
   - Request reviews for doc changes
   - Maintain style consistency
   - Share documentation updates

## Troubleshooting

### Script Not Running

```bash
# Make executable
chmod +x scripts/check-version-consistency.sh
# Run with bash explicitly
bash scripts/check-version-consistency.sh
```

### False Positives

- Check exclude patterns in script
- Verify file paths are correct
- Review regex patterns

### Performance Issues

- Limit search scope
- Use specific file patterns
- Exclude build directories

## Resources

- [Markdown Guide](https://www.markdownguide.org/)
- [Semantic Versioning](https://semver.org/)
- [Documentation Best Practices](https://www.writethedocs.org/guide/)

## Contact

For documentation questions or improvements, create an issue in the project repository.