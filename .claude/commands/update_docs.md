# Documentation Update Command for Code Intelligence MCP Server

## Purpose
Automate documentation updates after code changes, ensuring comprehensive and accurate documentation for the Code Intelligence MCP Server project.

## 🔍 Documentation Update Strategy

### 1. Automated Documentation Analysis

Use the specialized agent for enterprise-level documentation updates:

```bash
# Use documentation architect for comprehensive doc updates
Task(
  description="Update Code Intelligence docs",
  prompt="Review and update all project documentation after recent changes, ensure enterprise-level standards for MCP server documentation, fix broken references, maintain coherent structure for TypeScript/Rust hybrid architecture",
  subagent_type="general-purpose"
)
```

The agent will:
- Update README.md with latest features and API changes
- Fix broken references in specs/ directory
- Ensure docs/ structure is coherent
- Update MCP protocol documentation
- Maintain architecture diagrams accuracy
- Update API documentation

### 2. Enhanced Documentation Analysis (with MCP-REPL)

**🚀 Semantic Documentation Discovery:**

```bash
# Find documentation patterns in TypeScript MCP
mcp__mcp-repl__searchcode(
  query="MCP protocol documentation tools resources API",
  workingDirectory="F:/Development/Projects/ProjectAra/typescript-mcp"
)

# Find documentation patterns in Rust core
mcp__mcp-repl__searchcode(
  query="documentation examples /// doc comments",
  workingDirectory="F:/Development/Projects/ProjectAra/rust-core"
)
```

**🔍 Code-Documentation Consistency Check:**

```bash
# Verify TypeScript MCP examples work correctly
mcp__mcp-repl__executenodejs(
  code=`
    const fs = require('fs');
    const path = require('path');

    // Read and validate MCP tool examples from docs
    const docsPath = path.join(process.cwd(), 'specs/001-code-ntelligence-mcp');
    const contractsPath = path.join(process.cwd(), 'typescript-mcp/tests/contract');

    // Validate that documented tools match contract tests
    const contractTests = [
      'test_search_code.ts',
      'test_explain_function.ts',
      'test_find_references.ts',
      'test_trace_data_flow.ts',
      'test_analyze_security.ts',
      'test_get_api_endpoints.ts',
      'test_check_complexity.ts'
    ];

    contractTests.forEach(test => {
      const testPath = path.join(contractsPath, test);
      if (fs.existsSync(testPath)) {
        console.log('✅ Contract test exists:', test);
      } else {
        console.error('❌ Missing contract test:', test);
      }
    });
  `,
  workingDirectory="F:/Development/Projects/ProjectAra"
)
```

**📊 Structural Documentation Analysis:**

```bash
# Analyze documentation structure for MCP tools
mcp__mcp-repl__astgrep_enhanced_search(
  pattern="export function $TOOL_NAME($$$ARGS) { $$$ }",
  workingDirectory="F:/Development/Projects/ProjectAra/typescript-mcp",
  includeMetadata=true
)

# Find Rust documentation patterns
mcp__mcp-repl__astgrep_enhanced_search(
  pattern="/// $DOC_COMMENT\npub fn $FUNC_NAME($$$ARGS) { $$$ }",
  workingDirectory="F:/Development/Projects/ProjectAra/rust-core",
  language="rust"
)
```

### 3. Documentation Validation Checklist

**Core Documentation Files:**
- [ ] README.md - Main project documentation
- [ ] CLAUDE.md - Claude Code specific instructions
- [ ] specs/001-code-ntelligence-mcp/spec.md - Feature specification
- [ ] specs/001-code-ntelligence-mcp/quickstart.md - Quick start guide
- [ ] typescript-mcp/README.md - TypeScript MCP documentation
- [ ] rust-core/README.md - Rust core documentation

**API Documentation:**
- [ ] MCP Protocol tools documentation
- [ ] REST API endpoints (port 4000)
- [ ] WebSocket endpoints (port 8080)
- [ ] FFI bridge documentation

**Architecture Documentation:**
- [ ] System architecture diagram
- [ ] Data flow diagrams
- [ ] Component interaction diagrams
- [ ] Database schema documentation

### 4. Automated Documentation Generation

**Generate TypeScript API Documentation:**
```bash
cd typescript-mcp
npx typedoc --out ../docs/api/typescript src/
```

**Generate Rust Documentation:**
```bash
cd rust-core
cargo doc --no-deps --document-private-items
cp -r target/doc ../docs/api/rust
```

**Generate MCP Tools Documentation:**
```bash
mcp__mcp-repl__executenodejs(
  code=`
    const fs = require('fs');
    const path = require('path');

    // Extract MCP tools from contract tests
    const contractsPath = 'typescript-mcp/tests/contract';
    const tools = [];

    const files = fs.readdirSync(contractsPath);
    files.forEach(file => {
      if (file.startsWith('test_') && file.endsWith('.ts')) {
        const toolName = file.replace('test_', '').replace('.ts', '');
        tools.push({
          name: toolName,
          file: file,
          description: getToolDescription(toolName)
        });
      }
    });

    // Generate markdown documentation
    let markdown = '# MCP Tools Documentation\\n\\n';
    tools.forEach(tool => {
      markdown += \`## \${tool.name}\\n\\n\`;
      markdown += \`\${tool.description}\\n\\n\`;
      markdown += \`Contract Test: \\\`\${tool.file}\\\`\\n\\n\`;
    });

    fs.writeFileSync('docs/mcp-tools.md', markdown);
    console.log('✅ Generated MCP tools documentation');

    function getToolDescription(name) {
      const descriptions = {
        'search_code': 'Natural language code search across the codebase',
        'explain_function': 'Explain what a specific function does',
        'find_references': 'Find all references to a symbol',
        'trace_data_flow': 'Trace data flow through the code',
        'analyze_security': 'Analyze code for security vulnerabilities',
        'get_api_endpoints': 'List all API endpoints in the codebase',
        'check_complexity': 'Analyze code complexity metrics'
      };
      return descriptions[name] || 'Tool description pending';
    }
  `,
  workingDirectory="F:/Development/Projects/ProjectAra"
)
```

### 5. Documentation Linting and Validation

**Lint Markdown Files:**
```bash
npx markdownlint "**/*.md" --fix
```

**Check for Broken Links:**
```bash
npx markdown-link-check README.md
npx markdown-link-check specs/**/*.md
```

**Validate Code Examples:**
```bash
# Extract and test code examples from markdown
mcp__mcp-repl__executenodejs(
  code=`
    const fs = require('fs');
    const path = require('path');

    function extractCodeBlocks(markdown) {
      const codeBlockRegex = /\\\`\\\`\\\`(javascript|typescript|js|ts)\\n([\\s\\S]*?)\\n\\\`\\\`\\\`/g;
      const blocks = [];
      let match;
      while ((match = codeBlockRegex.exec(markdown)) !== null) {
        blocks.push({
          language: match[1],
          code: match[2]
        });
      }
      return blocks;
    }

    // Test README.md examples
    const readme = fs.readFileSync('README.md', 'utf8');
    const codeBlocks = extractCodeBlocks(readme);

    console.log(\`Found \${codeBlocks.length} code blocks in README.md\`);

    codeBlocks.forEach((block, index) => {
      try {
        // Basic syntax check
        if (block.language === 'javascript' || block.language === 'js') {
          new Function(block.code);
          console.log(\`✅ Code block \${index + 1} is valid\`);
        }
      } catch (error) {
        console.error(\`❌ Code block \${index + 1} has syntax error:\`, error.message);
      }
    });
  `,
  workingDirectory="F:/Development/Projects/ProjectAra"
)
```

### 6. Performance Documentation Update

**Update Performance Benchmarks:**
```bash
# Run and document Rust benchmarks
cd rust-core
cargo bench > ../docs/performance/rust-benchmarks.txt

# Run and document TypeScript performance
cd ../typescript-mcp
npm run test:performance > ../docs/performance/typescript-benchmarks.txt
```

### 7. Version and Changelog Management

**Update Version Documentation:**
```bash
mcp__mcp-repl__executenodejs(
  code=`
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const tsPkg = JSON.parse(fs.readFileSync('typescript-mcp/package.json', 'utf8'));

    console.log('Current versions:');
    console.log('Main package:', pkg.version);
    console.log('TypeScript MCP:', tsPkg.version);

    // Update CHANGELOG.md with version info
    const date = new Date().toISOString().split('T')[0];
    const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');

    if (!changelog.includes(pkg.version)) {
      const newEntry = \`## [\${pkg.version}] - \${date}\\n\\n### Added\\n- [Add changes here]\\n\\n\`;
      const updatedChangelog = changelog.replace('# Changelog\\n\\n', \`# Changelog\\n\\n\${newEntry}\`);
      fs.writeFileSync('CHANGELOG.md', updatedChangelog);
      console.log('✅ Updated CHANGELOG.md');
    }
  `,
  workingDirectory="F:/Development/Projects/ProjectAra"
)
```

## 📋 Documentation Update Workflow

1. **Pre-Update Analysis:**
   - Run semantic search to find outdated docs
   - Check for broken links and references
   - Identify missing documentation

2. **Update Documentation:**
   - Update API documentation
   - Update architecture diagrams
   - Fix code examples
   - Update configuration examples

3. **Validation:**
   - Lint all markdown files
   - Test code examples
   - Verify links work
   - Check cross-references

4. **Generate Documentation:**
   - Generate API docs from code
   - Create MCP tools reference
   - Update performance benchmarks

5. **Final Review:**
   - Ensure CLAUDE.md is up to date
   - Verify README completeness
   - Check specs alignment with implementation

## 🎯 Quick Commands

```bash
# Full documentation update
npm run docs:update

# Generate API documentation
npm run docs:generate

# Validate documentation
npm run docs:validate

# Fix documentation issues
npm run docs:fix
```

## 📝 Notes

- Always update CLAUDE.md when adding new development practices
- Keep README.md as the main entry point
- Maintain specs/ directory for detailed technical documentation
- Use docs/ directory for generated documentation
- Follow Markdown best practices and linting rules
- Ensure all code examples are tested and working