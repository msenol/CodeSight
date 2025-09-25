#\!/bin/bash
# Version Consistency Check Script
echo "🔍 Code Intelligence MCP Server Version Consistency Check"
echo "========================================================="

# Check versions
echo ""
echo "📦 Package Versions:"
grep -m1 "\"version\"" package.json 2>nul || echo "Root package.json not found"
grep -m1 "\"version\"" typescript-mcp/package.json 2>nul || echo "TypeScript MCP not found"

# Check CLAUDE.md size
echo ""
echo "📄 Documentation Health:"
for /f "usebackq" %%A in (`dir /b CLAUDE.md`) do set size=%%~zA
echo CLAUDE.md size check

# Check critical files
echo ""
echo "📚 Critical Documentation:"
if exist README.md (echo ✅ README.md exists) else (echo ❌ README.md missing)
if exist CHANGELOG.md (echo ✅ CHANGELOG.md exists) else (echo ❌ CHANGELOG.md missing)
if exist typescript-mcp\README.md (echo ✅ typescript-mcp/README.md exists) else (echo ❌ typescript-mcp/README.md missing)

