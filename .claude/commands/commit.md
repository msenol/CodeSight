# Git Commit İşlemleri - Code Intelligence MCP Project

## Görev

Code Intelligence MCP projesindeki değişiklikleri analiz et ve uygun commit stratejisi ile işle.

## 🔍 Smart Commit Context with Agent Integration

### Pre-Commit Analysis with Agents

Before committing, use specialized agents to ensure code quality:

```bash
# 1. First, verify test coverage AND test execution for changes
Task(description="Verify test coverage and execution",
     prompt="Analyze staged changes, ensure comprehensive test coverage exists for modified files, and verify related tests pass without failures",
     subagent_type="test-coverage-analyzer")

# 2. Run tests for modified modules - ProjectAra specific test commands
# Unit tests for TypeScript/React
npm run test:unit
# Contract tests for MCP protocol compliance
npm run test:contract
# Integration tests if API changes
npm run test:integration

# 3. Check for any skipped or disabled tests in both TypeScript and Rust
grep -r "\.skip\|\.only\|xit\|fit" --include="*.spec.ts" --include="*.test.ts" --exclude-dir=node_modules .
grep -r "#\[ignore\]" rust-core/ --include="*.rs"

# 4. Analyze commit history for patterns (manual)
git log --oneline --grep="feat(" --grep="fix(" --grep="docs(" --grep="refactor(" -n 20

# Search for related historical changes in git history
git log --oneline --all --grep="[feature/module]" -n 10
git log --oneline --all -S "[changed-functionality]" -n 5

# Find commit message conventions from recent commits
git log --oneline -n 50 | grep -E "(feat|fix|docs|refactor|chore|style|test|perf):"

# 5. Check for breaking change patterns
git log --grep="BREAKING CHANGE" --grep="BC:" --oneline -n 10
```

### Enhanced Smart Change Analysis (with MCP-REPL)

Using agents, semantic search, and systematic analysis:

**🚀 Semantic Commit Pattern Discovery:**

```bash
# Intelligent commit pattern analysis
mcp__mcp-repl__searchcode "commit patterns [feature_type] best practices conventions"
mcp__mcp-repl__searchcode "similar changes [module_name] historical implementation"
```

**🔍 Code Change Structural Analysis:**

```bash
# Analyze code changes with AST patterns
mcp__mcp-repl__astgrep_search --pattern "export const $NAME = ($$$PROPS) => { $$$ }"
mcp__mcp-repl__astgrep_search --pattern "interface $NAME { $$$PROPS }"
```

**📊 Systematic Commit Strategy Documentation:**

```bash
# Document commit analysis and strategy
mcp__mcp-repl__sequentialthinking [
  "Analyzed staged changes: 8 files across 3 modules (backend, frontend, types)",
  "Identified change type: Feature addition with breaking changes to API",
  "Found similar historical commits: feat(api): add user preferences v0.8.24",
  "Commit strategy: Single atomic commit with proper BREAKING CHANGE notation",
  "Test coverage verified: 12 new tests added, coverage maintained at 100%"
]
```

Combined approach ensures comprehensive commit readiness:

- Agent identifies missing tests and suggests test templates
- Agent fixes code quality issues automatically
- **Semantic search** finds related modules and past implementations
- **Systematic documentation** tracks commit strategy and reasoning

## İşlem Adımları

### 1. Dosya Analizi ve Filtreleme

```bash
# Check current git status
git status --porcelain

# Run version consistency check for ProjectAra
./scripts/check-version-consistency.sh

# Run comprehensive pre-commit checks
./scripts/pre-commit-checks.sh

# Check TypeScript types
npm run check

# Run linter
npm run lint
```

- Tüm değişiklikleri kategorize et (Added, Modified, Deleted, Renamed)
- **Hook System Integration**: Pre-commit hooks will automatically validate:
  - Chakra UI v3 compliance (`@tms/ui` import enforcement)
  - Code quality and formatting
  - Documentation consistency
- Aşağıdaki dosyaları ASLA commit etme:
  - `.tmp/`, `temp/`, `.trae/tmp/`, `typescript-mcp/.tmp/` klasörlerindeki tüm dosyalar
  - `*.test.*`, `*.spec.*` test dosyaları (eğer test implementasyonu değilse)
  - `.env`, `.env.local` gibi environment dosyaları
  - `node_modules/`, `dist/`, `build/` klasörleri
  - `*.log`, `*.tmp`, `*.cache` uzantılı dosyalar
  - IDE config dosyaları (`.idea/`, `.vscode/settings.json`)
  - Hook configuration changes without approval

### 2. Değişiklik Gruplandırması

```bash
# Use manual analysis to understand change patterns in ProjectAra
grep -r "import.*[changed-file]" . --include="*.ts" --include="*.tsx" --include="*.rs"
find . -name "*.ts" -o -name "*.tsx" -o -name "*.rs" | xargs grep -l "[modified-module]"

# Find dependencies of modified modules
grep -r "from.*[modified-module]" . --include="*.ts" --include="*.tsx"
find . -name "package.json" -o -name "Cargo.toml" | xargs grep -l "[modified-package]"
```

Değişiklikleri mantıksal gruplara ayır:

- **Feature**: Yeni özellik eklemeleri
- **Fix**: Bug düzeltmeleri
- **Refactor**: Kod iyileştirmeleri (davranış değişikliği olmadan)
- **Docs**: Dokümantasyon güncellemeleri
- **Style**: Formatting, missing semi-colons, etc.
- **Test**: Test eklemeleri veya düzeltmeleri
- **Chore**: Build process, auxiliary tools, libraries güncellemeleri
- **Perf**: Performance iyileştirmeleri

### 3. Commit Stratejisi Belirleme

- Tek bir mantıksal değişiklik = Tek commit
- Farklı modüllere ait değişiklikler = Ayrı commitler
- Büyük feature = Ana commit + destekleyici commitler

### 4. Agent-Driven Quality Checks

Before finalizing commits, agents will help identify issues:

```bash
# Enhanced test verification for ProjectAra
Task(description="Comprehensive test verification",
     prompt="1. Check test coverage for staged changes in TypeScript and Rust
             2. Run unit tests (npm test) and Rust tests (cargo test)
             3. Run contract tests if MCP protocol changes detected
             4. Verify no tests are skipped or disabled
             5. Check performance benchmarks if Rust core modified",
     subagent_type="test-coverage-analyzer")

# ProjectAra specific test execution
# TypeScript/React tests
npm run test:unit
# Rust core tests if rust files changed
if git diff --staged --name-only | grep -q "rust-core/"; then
  cd rust-core && cargo test && cd ..
fi
# Contract tests if MCP changes
if git diff --staged --name-only | grep -q "typescript-mcp/"; then
  npm run test:contract
fi
```

**Test Scope Note:**

- Only tests related to staged changes are validated
- Tests from unchanged modules are OUT OF SCOPE
- Focus is on ensuring modified code doesn't break its own tests
- Existing failing tests in other modules don't block commits

### 5. Emin Olamadığın Durumlar İçin Sorgulama

Aşağıdaki durumlarda kullanıcıya mutlaka sor:

- Generated dosyalar (örn: `package-lock.json` yanında `package.json` değişikliği yoksa)
- Migration dosyaları (veritabanı şema değişiklikleri)
- Config dosyalarındaki değişiklikler (`.claude/`, `docker-compose.yml`)
- Hook configuration modifications (`.claude/hooks/`, `.claude/settings.local.json`)
- Binary dosyalar (images, PDFs, etc.)
- Büyük dosyalar (> 1MB)
- Documentation size approaching limits (CLAUDE.md > 38,000 chars)
- Direct Chakra UI imports instead of @tms/ui (agents will auto-fix this)
- **RULE 15 RED FLAGS** (agents will detect and fix):
  - TODO/FIXME comments with "temporary" or "workaround"
  - Hardcoded values that should be configurable
  - Duplicated code across multiple files
  - Disabled tests or eslint-disable comments
  - "Quick fix" or "hotfix" in commit messages without proper solution

### 6. Commit Mesajı Formatı

Conventional Commits formatını kullan:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Örnekler:

```
feat(mcp): add natural language code search capability

- Implement semantic search using Rust core engine
- Add MCP protocol tool for search_code
- Integrate Tantivy indexing for performance

BREAKING CHANGE: Requires Rust core compilation
```

## Çıktı Formatı

### 1. Değişiklik Özeti

````
📊 Değişiklik Analizi:
- Toplam dosya: X
- Eklenen: X dosya
- Değiştirilen: X dosya
- Silinen: X dosya

🔍 Manual Code Analysis Insights:
```bash
# Related changes found in ProjectAra
grep -r "[specific-pattern]" . --include="*.ts" --include="*.tsx" --include="*.rs"
git log --oneline -S "[changed-functionality]" -n 5
````

- Similar past commits: [list of patterns found in git history]
- Affected test files: [discovered through file system search]
- Related documentation: [found via grep and find commands]

📁 Etkilenen Modüller:

- rust-core/crates/search/
- typescript-mcp/src/tools/
- api/routes/
- src/components/

```

### 2. Commit Planı

```

🎯 Önerilen Commit Stratejisi:

Commit 1: feat(search): implement semantic code search engine

- rust-core/crates/search/src/engine.rs
- rust-core/crates/indexer/src/lib.rs
- typescript-mcp/src/tools/search_code.ts

Commit 2: docs(mcp): update MCP integration guide

- docs/quickstart/claude-desktop.md
- typescript-mcp/README.md

Commit 3: test(contract): add MCP protocol compliance tests

- typescript-mcp/tests/contract/test_search_code.ts
- rust-core/crates/search/src/tests.rs

```

### 3. Dikkat Edilmesi Gerekenler

```

⚠️ Uyarılar:

- [ ] Cargo.lock değişikliği var, Cargo.toml kontrolü gerekli
- [ ] Docker image rebuild gerekebilir
- [ ] .env.example dosyası güncellendi, güvenlik kontrolü yapılmalı
- [ ] Migration dosyası eklenmiş, database backup önerilir

```

### 4. Kullanıcı Onayı İsteme

```

❓ Emin olamadığım dosyalar:

1. rust-core/Cargo.toml
   - Yeni dependency eklenmiş (tantivy)
   - Commit etmeli miyim? (E/H)

2. .tmp/search-index/
   - Geçici index dosyaları
   - Commit etmeli miyim? (E/H)

````

## ⚡ Performance ve Timeout Çözümleri

### Hook Timeout Problemi Yaşanırsa

```bash
# 1. Cache temizle ve tekrar dene
npm run cache:clear
git commit -m "message"

# 2. Önce lint sorunlarını düzelt
npm run lint:fix
git add -u
git commit -m "message"

# 3. Daha az dosya ile commit yap
git add specific-files
git commit -m "message"

# 4. RULE 15: Emergency bypass YASAKLANMIŞTIR
# Acil durumlar için bile proper solution gerekli
# Hook fail ediyorsa, sorunu ÇÖZÜN, bypass etmeyin
````

### Performance İpuçları

- **Optimal dosya sayısı**: 5-15 dosya per commit
- **20+ dosya**: Commit'leri böl veya `npm run lint:fix` önceden çalıştır
- **Cache sağlığı**: Periyodik olarak `npm run cache:clear`
- **Timeout süresi**: 60 saniye (otomatik timeout koruması)

## Güvenlik Kontrol Listesi

Commit öncesi mutlaka kontrol et:

- [ ] Hassas bilgi içermiyor (API keys, passwords, tokens)
- [ ] Gereksiz console.log() kalmamış
- [ ] TODO/FIXME commentleri uygun
- [ ] Test dosyaları sadece test implementasyonu içeriyor
- [ ] Büyük binary dosyalar yok (Git LFS gerekebilir)
- [ ] **Değişen modüllerin testleri geçiyor** (sadece staged dosyalarla ilgili testler)
- [ ] **Atlanmış testler yok** (.skip, .only, xit, fit)
- [ ] **Test coverage korunuyor veya artıyor**
- [ ] **Yorumlanmış test kodu yok**

## 🔧 Troubleshooting

### "Pre-commit hook timeout" Hatası

1. **İlk deneme**: `npm run cache:clear`
2. **Çok dosya varsa**: Commit'i böl veya `npm run lint:fix` kullan
3. **Acil durum**: `HUSKY_BYPASS=1` kullan (sonra düzelt!)
4. **Detaylı bilgi**: `/docs/development/commit-hook-optimization.md`

### "ESLint cache corrupted" Hatası

```bash
rm -rf node_modules/.cache/eslint
rm -rf node_modules/.cache/prettier
npm run lint:fix
```

## Özel Kurallar (Code Intelligence MCP Projesi İçin)

1. **Version Güncellemesi**:
   - CLAUDE.md, README.md veya package.json'da version değişikliği varsa Semantic Versioning kontrolü yap
   - v0.1.0-dev formatında, production-ready olmadığını belirt
   - ./scripts/check-version-consistency.sh ile tutarlılığı doğrula
2. **Tarih Kullanımı**:
   - Dokümanlarda hardcoded tarih yerine `mcp__time__get_datetime` kullanıldığını doğrula
   - Automated script ile date consistency kontrolü
3. **Modül Bağımlılıkları**:
   - TypeScript-Rust FFI bridge değişikliklerinde uyumluluk kontrolü
   - rust-core/ ve typescript-mcp/ arasındaki bağımlılıkları doğrula
   - Docker container'ları arasındaki iletişimi kontrol et
4. **Docker/Config Dosyaları**:
   - docker-compose.yml değişikliklerinde PostgreSQL ve Redis bağlantılarını kontrol et
   - SQLite (dev) ve PostgreSQL (prod) config uyumluluğunu doğrula
   - Container'lar arası iletişim portlarını kontrol et (8080 WebSocket, 4000 REST API)
5. **Performance Targets**:
   - Small projects (<1K files): <5s indexing kontrolü
   - Query response time <200ms target'ını benchmark'larla doğrula
   - Memory profiling sonuçlarını değerlendir (npm run test:memory)
6. **Documentation Health**:
   - CLAUDE.md size limit kontrolü (40,000 karakter)
   - docs/ klasöründeki alt dokümantasyonları güncelle
   - MCP protocol documentation'ı typescript-mcp/docs/ içinde tut
   - README.md'de quickstart guide'ın çalıştığını doğrula

## Komut Örnekleri - Code Intelligence MCP

```bash
# 1. Run comprehensive pre-commit checks for ProjectAra
./scripts/pre-commit-checks.sh

# 2. Agent workflow for additional validation
Task(description="Pre-commit validation",
     prompt="Analyze staged changes for Code Intelligence MCP project compliance",
     subagent_type="test-coverage-analyzer")

# 3. Run tests for staged files - ProjectAra multi-layer testing
# TypeScript tests
npm run test:typescript
# Rust tests if applicable
if git diff --staged --name-only | grep -q "rust-core/"; then
  npm run test:rust
fi

# 4. Check for skipped tests in staged files
git diff --staged --name-only | grep -E "\.(spec|test)\.(ts|tsx)$" | xargs grep -l "\.skip\|\.only\|xit\|fit" || echo "✅ No skipped tests found"

# 5. Fix all code issues before staging - ProjectAra multi-language
Task(description="Pre-commit code fixes",
     prompt="Fix TypeScript, ESLint issues and Rust format issues according to Rule 15",
     subagent_type="lint-typescript-fixer")

# Rust formatting if needed
if git diff --staged --name-only | grep -q "rust-core/"; then
  cd rust-core && cargo fmt && cd ..
fi

# 6. Stage and commit workflow for ProjectAra
git diff --staged --name-only
# Example: Stage Rust core changes
git add rust-core/crates/search/*.rs
# Example: Stage MCP protocol changes
git add typescript-mcp/src/tools/*.ts
git add -p  # Interactive staging

# 7. Final test verification before commit - ProjectAra comprehensive testing
npm run test:unit
# Performance benchmarks if Rust changes
if git diff --staged --name-only | grep -q "rust-core/"; then
  echo "Consider running: npm run test:benchmarks"
fi

# 8. Commit with confidence
git commit -m "feat(mcp): implement semantic code search"

# 9. If recurring issues found, create rules
Task(description="Create validation rules",
     prompt="Create hook rules for patterns found in this commit session",
     subagent_type="hook-rule-generator")

# Test specific components manually if needed
# TypeScript MCP tools
npm run test:contract -- test_search_code.ts
# Rust core components
cd rust-core && cargo test -p search && cd ..
```

## 🚀 Yeni Commit Scripts

```bash
# Type checking
npm run check

# Lint sorunlarını kontrol et
npm run lint

# Rust format check
cd rust-core && cargo fmt --check

# RULE 15: Force commit KULLANILAMAZ
# Proper fix required for all situations
```

## 🚨 RULE 15: Commit Standards

**HER COMMIT RULE 15'E UYGUN OLMALI**:

1. **NO Workarounds in Commits**
   - ❌ "Quick fix for failing test"
   - ✅ "fix(auth): resolve token validation edge case"

2. **NO Temporary Solutions**
   - ❌ Commented out code "for later"
   - ✅ Proper implementation or removal

3. **NO Partial Implementations**
   - ❌ "WIP: half done feature"
   - ✅ Complete, working increments

4. **NO Technical Debt**
   - ❌ "TODO: refactor this later"
   - ✅ Clean code from the start

5. **DRY Principle Check**
   - Code duplication = commit rejected
   - Extract shared logic BEFORE committing

6. **Test Integrity**
   - ❌ Atlanmış veya devre dışı testler (.skip, .only, xit, fit)
   - ✅ Commit öncesi değişen modüllerin testleri geçiyor
   - ❌ Test coverage düşüşü
   - ✅ Coverage korunuyor veya artıyor
   - ❌ Yorumlanmış test kodu
   - ✅ Temiz, çalışan test implementasyonları

**Pre-Commit Checklist**:

- [ ] No hardcoded values
- [ ] No code duplication
- [ ] No disabled tests
- [ ] No TODO/FIXME for workarounds
- [ ] All changes are production-ready
- [ ] **Related tests pass** (npm test --findRelatedTests for modified files)
- [ ] **No skipped tests** (.skip, .only, xit, fit)
- [ ] **Test coverage maintained or improved**
