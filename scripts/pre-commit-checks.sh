#!/bin/bash

# Code Intelligence MCP - Pre-commit Checks
# Comprehensive validation before committing

set -e

echo "🔍 Running pre-commit checks for Code Intelligence MCP..."

# 1. Version consistency check
echo "📦 Checking version consistency..."
./scripts/check-version-consistency.sh

# 2. TypeScript type checking
echo "📝 Running TypeScript type check..."
npm run check

# 3. Linting
echo "🎨 Running linter..."
npm run lint

# 4. Unit tests
echo "🧪 Running unit tests..."
npm run test:unit

# 5. Check for Rust changes
if git diff --staged --name-only | grep -q "rust-core/"; then
    echo "🦀 Rust files changed, running Rust tests..."
    cd rust-core
    cargo fmt --check
    cargo test
    cd ..
fi

# 6. Check for MCP protocol changes
if git diff --staged --name-only | grep -q "typescript-mcp/"; then
    echo "🔌 MCP protocol changed, running contract tests..."
    npm run test:contract
fi

# 7. Check for skipped tests
echo "🚫 Checking for skipped tests..."
if grep -r "\.skip\|\.only\|xit\|fit" --include="*.spec.ts" --include="*.test.ts" --exclude-dir=node_modules . > /dev/null; then
    echo "⚠️ Warning: Found skipped or focused tests"
    grep -r "\.skip\|\.only\|xit\|fit" --include="*.spec.ts" --include="*.test.ts" --exclude-dir=node_modules . | head -5
fi

if grep -r "#\[ignore\]" rust-core/ --include="*.rs" > /dev/null 2>&1; then
    echo "⚠️ Warning: Found ignored Rust tests"
    grep -r "#\[ignore\]" rust-core/ --include="*.rs" | head -5
fi

# 8. Documentation size check
echo "📚 Checking documentation size..."
if [ -f "CLAUDE.md" ]; then
    SIZE=$(wc -c < CLAUDE.md)
    if [ $SIZE -gt 40000 ]; then
        echo "⚠️ Warning: CLAUDE.md exceeds 40,000 characters (current: $SIZE)"
    fi
fi

echo "✅ Pre-commit checks completed successfully!"