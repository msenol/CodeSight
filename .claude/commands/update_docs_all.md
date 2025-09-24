# Code Intelligence MCP Server - Dokümantasyon Denetimi ve Yenileme

## Görev

Code Intelligence MCP Server projesinin tüm dokümantasyonunu kapsamlı şekilde gözden geçir, tutarlılığı sağla ve gerekli iyileştirmeleri yap.

## 🔧 Öncelikli Adım: Otomatik Kontrol

**İlk olarak mevcut automated tool'u çalıştır:**

```bash
./scripts/check-version-consistency.sh
```

Bu script şunları kontrol eder:

- Version consistency across main files
- Outdated version references
- Date consistency
- CLAUDE.md size monitoring (ideal: 10-15KB, max: 40KB)
- Critical documentation links
- TypeScript MCP and Rust Core specific checks
- Color-coded health score report

## 📁 Proje Dokümantasyon Yapısı

**Ana Dosyalar:**
- `CLAUDE.md` - AI assistant için proje kılavuzu (10KB altında tutulmalı)
- `README.md` - Proje genel bakış ve kurulum
- `package.json` - Root package configuration
- `typescript-mcp/package.json` - MCP server configuration
- `rust-core/Cargo.toml` - Rust core configuration

**Dokümantasyon Dizini:**
- `/docs/` - Detaylı dokümantasyon
- `/docs/api/` - API referansları
- `/docs/development/` - Geliştirici kılavuzları
- `/docs/architecture/` - Mimari dokümantasyon

## İşlem Adımları

### Phase 1: Automated Consistency Check

1. **Version Consistency Script Çalıştır**
   ```bash
   ./scripts/check-version-consistency.sh
   ```
   - Çıktı analizi: 🟢 Green = OK, 🟡 Yellow = Review needed, 🔴 Red = Critical
   - Health Score: Target 90+/100

2. **Immediate Action Required** (Red errors)
   - Version inconsistency in main files
   - CLAUDE.md exceeding 40KB limit
   - Missing critical documentation files

### Phase 2: Content Review

1. **Project-Specific Standards Verification**
   - **Version**: v0.1.0-dev (development phase)
   - **Architecture**: TypeScript MCP + Rust Core + React Frontend
   - **Ports**: 8080 (WebSocket), 4000 (API), 5173 (Frontend)
   - **Database**: SQLite (dev) / PostgreSQL (prod)

2. **Key Files Priority Check**
   - **CLAUDE.md** - Keep under 10KB, focus on critical rules
   - **README.md** - Ensure setup instructions are accurate
   - **typescript-mcp/README.md** - MCP specific documentation
   - **rust-core/README.md** - Rust core documentation

3. **MCP Integration Documentation**
   - Verify MCP tools documentation is current:
     - `search_code` - Natural language search
     - `explain_function` - Function explanation
     - `find_references` - Symbol references
     - `trace_data_flow` - Data flow analysis
     - `analyze_security` - Security analysis
     - `get_api_endpoints` - API discovery
     - `check_complexity` - Code complexity

4. **Testing Documentation**
   - Contract tests in `typescript-mcp/tests/contract/`
   - Performance benchmarks in `rust-core/benches/`
   - Load tests in `tests/load/`

### Phase 2.5: Enhanced Analysis with MCP Tools

5. **Semantic Documentation Discovery**:
   ```bash
   # Use MCP search to find documentation patterns
   mcp__mcp-repl__searchcode "documentation TODO outdated deprecated"
   mcp__mcp-repl__searchcode "API endpoints routes handlers"
   ```

6. **Code-Documentation Validation**:
   ```bash
   # Validate that documented code examples work
   mcp__mcp-repl__executenodejs "
     // Test documentation code samples
     const fs = require('fs');
     const path = require('path');

     // Check if documented paths exist
     const paths = [
       'typescript-mcp/src/index.ts',
       'rust-core/src/lib.rs',
       'api/server.ts'
     ];

     paths.forEach(p => {
       if (fs.existsSync(p)) {
         console.log('✅', p, 'exists');
       } else {
         console.log('❌', p, 'missing');
       }
     });
   "
   ```

7. **AST-Based Documentation Coverage**:
   ```bash
   # Find undocumented functions and classes
   mcp__mcp-repl__astgrep_search --pattern "function $NAME($$$) { $$$ }" --workingDirectory "."
   mcp__mcp-repl__astgrep_search --pattern "export class $NAME" --workingDirectory "."
   ```

### Phase 3: Structural Assessment

8. **Documentation Health Metrics**
   - Version Consistency: 30%
   - Architecture Accuracy: 25%
   - API Coverage: 20%
   - Test Documentation: 15%
   - Setup Instructions: 10%

9. **Performance Target Verification**
   - Small projects (<1K files): <5s indexing
   - Medium projects (1K-10K): <30s indexing
   - Large projects (10K-100K): <5min indexing

## 🎯 Priority Actions

### 🔴 Critical (Immediate)
- Fix version mismatches in package.json files
- Optimize CLAUDE.md size if over 10KB
- Ensure all MCP tools are documented
- Verify Docker configuration is current

### 🟡 Important (This Week)
- Update API endpoint documentation
- Sync Rust and TypeScript version numbers
- Document any new MCP contract tests
- Review and update performance benchmarks

### 🟢 Maintenance (Regular)
- Keep test documentation current
- Update code examples in docs
- Review architecture diagrams
- Maintain changelog

## 🛠️ Available Tools

1. **Automated Scripts**
   - `./scripts/check-version-consistency.sh` - Main consistency checker

2. **MCP Tools for Analysis**
   - `mcp__mcp-repl__searchcode` - Semantic code search
   - `mcp__mcp-repl__astgrep_search` - AST pattern matching
   - `mcp__mcp-repl__executenodejs` - Validate code examples

3. **Documentation Standards**
   - Follow semantic versioning (currently v0.1.0-dev)
   - Use ISO date format (YYYY-MM-DD)
   - Keep CLAUDE.md concise (<10KB)
   - Document all public APIs

## 📊 Expected Output

### 1. Health Check Report
```
🔍 Code Intelligence MCP Server Version Consistency Check
=========================================================
Documentation Health Score: 95/100

✅ Version consistency: OK
✅ CLAUDE.md size: 9.7KB (optimal)
⚠️  2 outdated references found
✅ All critical files present
```

### 2. Actions Taken
- Updated version to v0.1.0-dev across all files
- Optimized CLAUDE.md to under 10KB
- Created missing documentation files
- Fixed broken internal links
- Updated MCP tool descriptions

### 3. Files Modified
- `CLAUDE.md` - Reduced size, updated version
- `README.md` - Fixed setup instructions
- `package.json` - Version sync
- `typescript-mcp/package.json` - Version sync
- `rust-core/Cargo.toml` - Version sync

## 🎯 Success Criteria

- 🟢 Health Score ≥ 90/100
- 🟢 All versions synchronized to v0.1.0-dev
- 🟢 CLAUDE.md < 10KB
- 🟢 Zero broken documentation links
- 🟢 All MCP tools documented
- 🟢 Contract tests documented
- 🟢 Setup instructions verified working