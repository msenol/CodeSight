#!/bin/bash

# TMS Version Consistency Check Script
# ProjectAra/Code Intelligence MCP Server için uyarlanmıştır
# Bu script dokümantasyondaki versiyon ve tarih tutarlılığını kontrol eder

# ANSI renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Mevcut bilgileri al
EXPECTED_VERSION="v0.1.0-dev" # Başlangıç versiyonu
CURRENT_DATE=$(date +"%d %B %Y")
CURRENT_MONTH=$(date +"%B %Y")

echo -e "${BLUE}🔍 Code Intelligence MCP Server Version Consistency Check${NC}"
echo "========================================================="
echo -e "Expected Version: ${GREEN}${EXPECTED_VERSION}${NC}"
echo -e "Current Date: ${GREEN}${CURRENT_DATE}${NC}"
echo ""

# Toplam hata sayacı
TOTAL_ERRORS=0
TOTAL_WARNINGS=0

# 1. Ana dosyalarda versiyon kontrolü
echo -e "${BLUE}📋 Checking main documentation files for version consistency...${NC}"

declare -a MAIN_FILES=("CLAUDE.md" "README.md" "package.json")
VERSION_ISSUES=0

for file in "${MAIN_FILES[@]}"; do
    if [ -f "$file" ]; then
        # package.json için özel kontrol
        if [ "$file" == "package.json" ]; then
            PACKAGE_VERSION=$(grep -oP '"version":\s*"\K[^"]+' "$file" 2>/dev/null || echo "not found")
            if [ "$PACKAGE_VERSION" != "${EXPECTED_VERSION#v}" ]; then
                echo -e "${RED}  ❌ $file: Version mismatch (found: $PACKAGE_VERSION, expected: ${EXPECTED_VERSION#v})${NC}"
                ((VERSION_ISSUES++))
            else
                echo -e "${GREEN}  ✅ $file: Version correct${NC}"
            fi
        else
            # Diğer dosyalar için metin bazlı kontrol - v0.1.0-dev veya v0.1.0--dev formatını kabul et
            if grep -qE "v0\.1\.0-{1,2}dev" "$file" 2>/dev/null; then
                echo -e "${GREEN}  ✅ $file: Contains current version${NC}"
            else
                echo -e "${YELLOW}  ⚠️  $file: May need version update${NC}"
                ((VERSION_ISSUES++))
            fi
        fi
    else
        echo -e "${YELLOW}  ⚠️  $file: File not found${NC}"
        ((VERSION_ISSUES++))
    fi
done

if [ $VERSION_ISSUES -gt 0 ]; then
    ((TOTAL_WARNINGS+=VERSION_ISSUES))
    echo -e "${YELLOW}Found $VERSION_ISSUES version consistency issues${NC}"
else
    echo -e "${GREEN}All main files have consistent versions!${NC}"
fi
echo ""

# 2. Eski versiyon referanslarını ara
echo -e "${BLUE}📋 Checking for outdated version references...${NC}"

# Eski versiyonları bul (v0.0.x pattern)
OLD_VERSION_COUNT=$(grep -r "v0\.0\.[0-9]" --include="*.md" --include="*.json" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v node_modules | grep -v ".git" | wc -l)

if [ $OLD_VERSION_COUNT -gt 0 ]; then
    echo -e "${YELLOW}  ⚠️  Found $OLD_VERSION_COUNT references to old versions (v0.0.x)${NC}"
    ((TOTAL_WARNINGS+=OLD_VERSION_COUNT))

    # Hangi dosyalarda olduğunu göster (ilk 5 tanesi)
    echo -e "${YELLOW}  Files with old version references:${NC}"
    grep -r "v0\.0\.[0-9]" --include="*.md" --include="*.json" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v node_modules | grep -v ".git" | head -5 | while read -r line; do
        FILE=$(echo "$line" | cut -d: -f1)
        echo -e "    - $FILE"
    done
else
    echo -e "${GREEN}  ✅ No outdated version references found!${NC}"
fi
echo ""

# 3. Tarih tutarlılığı kontrolü
echo -e "${BLUE}📅 Checking for date consistency...${NC}"

# Gelecek tarih referanslarını kontrol et (2026+ yıllar, 2025 hariç çünkü şu andayız)
FUTURE_DATE_COUNT=$(grep -r "202[6-9]" --include="*.md" --include="*.json" . 2>/dev/null | grep -v node_modules | grep -v ".git" | grep -v "target/" | grep -v "dist/" | grep -v ".tmp/" | wc -l)

if [ $FUTURE_DATE_COUNT -gt 0 ]; then
    echo -e "${RED}  ❌ Found $FUTURE_DATE_COUNT references to future years (2026+)${NC}"
    ((TOTAL_ERRORS+=FUTURE_DATE_COUNT))
else
    echo -e "${GREEN}  ✅ No invalid future date references${NC}"
fi

# Yanlış ay referanslarını kontrol et
WRONG_MONTH_COUNT=$(grep -r "August 2025\|July 2025\|June 2025" --include="*.md" . 2>/dev/null | grep -v node_modules | grep -v ".git" | wc -l)

if [ $WRONG_MONTH_COUNT -gt 0 ]; then
    echo -e "${YELLOW}  ⚠️  Found $WRONG_MONTH_COUNT incorrect month references${NC}"
    ((TOTAL_WARNINGS+=WRONG_MONTH_COUNT))
else
    echo -e "${GREEN}  ✅ Date references appear consistent${NC}"
fi
echo ""

# 4. CLAUDE.md boyut kontrolü
echo -e "${BLUE}📏 Checking CLAUDE.md size...${NC}"

if [ -f "CLAUDE.md" ]; then
    CLAUDE_SIZE=$(wc -c < CLAUDE.md)
    CLAUDE_SIZE_KB=$((CLAUDE_SIZE / 1024))
    PERCENTAGE=$((CLAUDE_SIZE * 100 / 40000))

    echo -e "  CLAUDE.md: ${CLAUDE_SIZE} characters (${CLAUDE_SIZE_KB}KB, ${PERCENTAGE}% of 40KB limit)"

    if [ $CLAUDE_SIZE -gt 40000 ]; then
        echo -e "${RED}  ❌ CLAUDE.md exceeds 40,000 character limit!${NC}"
        ((TOTAL_ERRORS++))
    elif [ $CLAUDE_SIZE -gt 35000 ]; then
        echo -e "${YELLOW}  ⚠️  CLAUDE.md is approaching the 40,000 character limit${NC}"
        ((TOTAL_WARNINGS++))
    elif [ $CLAUDE_SIZE -gt 15000 ]; then
        echo -e "${YELLOW}  ⚠️  CLAUDE.md is larger than ideal (15KB)${NC}"
        ((TOTAL_WARNINGS++))
    else
        echo -e "${GREEN}  ✅ CLAUDE.md size is optimal${NC}"
    fi
else
    echo -e "${RED}  ❌ CLAUDE.md not found!${NC}"
    ((TOTAL_ERRORS++))
fi
echo ""

# 5. Kritik linkler kontrolü
echo -e "${BLUE}🔗 Checking critical documentation links...${NC}"

declare -a CRITICAL_DOCS=(
    "docs/development/documentation-maintenance-guide.md"
    "docs/CHANGELOG.md"
    "docs/api/endpoint-reference.md"
)

MISSING_DOCS=0
for doc in "${CRITICAL_DOCS[@]}"; do
    if [ ! -f "$doc" ]; then
        echo -e "${YELLOW}  ⚠️  Missing: $doc${NC}"
        ((MISSING_DOCS++))
    fi
done

if [ $MISSING_DOCS -eq 0 ]; then
    echo -e "${GREEN}  ✅ All critical documentation files present${NC}"
else
    echo -e "${YELLOW}  Found $MISSING_DOCS missing documentation files${NC}"
    ((TOTAL_WARNINGS+=MISSING_DOCS))
fi
echo ""

# 6. TypeScript MCP spesifik kontroller
echo -e "${BLUE}🔧 Checking TypeScript MCP specific files...${NC}"

if [ -d "typescript-mcp" ]; then
    if [ -f "typescript-mcp/package.json" ]; then
        MCP_VERSION=$(grep -oP '"version":\s*"\K[^"]+' typescript-mcp/package.json 2>/dev/null || echo "not found")
        echo -e "  TypeScript MCP version: ${GREEN}$MCP_VERSION${NC}"
    else
        echo -e "${YELLOW}  ⚠️  typescript-mcp/package.json not found${NC}"
        ((TOTAL_WARNINGS++))
    fi
else
    echo -e "${YELLOW}  ⚠️  typescript-mcp directory not found${NC}"
    ((TOTAL_WARNINGS++))
fi
echo ""

# 7. Rust Core spesifik kontroller
echo -e "${BLUE}🦀 Checking Rust Core specific files...${NC}"

if [ -d "rust-core" ]; then
    if [ -f "rust-core/Cargo.toml" ]; then
        RUST_VERSION=$(grep -oP '^version = "\K[^"]+' rust-core/Cargo.toml 2>/dev/null || echo "not found")
        echo -e "  Rust Core version: ${GREEN}$RUST_VERSION${NC}"
    else
        echo -e "${YELLOW}  ⚠️  rust-core/Cargo.toml not found${NC}"
        ((TOTAL_WARNINGS++))
    fi
else
    echo -e "${YELLOW}  ⚠️  rust-core directory not found${NC}"
    ((TOTAL_WARNINGS++))
fi
echo ""

# Özet rapor
echo -e "${BLUE}📊 Summary Report:${NC}"
echo "========================================================="

# Sağlık skoru hesapla
HEALTH_SCORE=100
HEALTH_SCORE=$((HEALTH_SCORE - TOTAL_ERRORS * 10))
HEALTH_SCORE=$((HEALTH_SCORE - TOTAL_WARNINGS * 2))

if [ $HEALTH_SCORE -lt 0 ]; then
    HEALTH_SCORE=0
fi

# Duruma göre renk seç
if [ $TOTAL_ERRORS -gt 0 ]; then
    echo -e "${RED}🔴 Documentation needs critical updates:${NC}"
    echo -e "  - ${RED}$TOTAL_ERRORS critical issues${NC}"
    echo -e "  - ${YELLOW}$TOTAL_WARNINGS warnings${NC}"
elif [ $TOTAL_WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}🟡 Documentation needs updates:${NC}"
    echo -e "  - ${YELLOW}$TOTAL_WARNINGS warnings${NC}"
else
    echo -e "${GREEN}🟢 Documentation is up to date!${NC}"
fi

echo -e "\nDocumentation Health Score: ${BLUE}$HEALTH_SCORE/100${NC}"

# Öneriler
if [ $TOTAL_ERRORS -gt 0 ] || [ $TOTAL_WARNINGS -gt 0 ]; then
    echo ""
    echo -e "${BLUE}📝 Recommended Actions:${NC}"

    if [ $VERSION_ISSUES -gt 0 ]; then
        echo "  1. Update version references in main documentation files"
    fi

    if [ $OLD_VERSION_COUNT -gt 0 ]; then
        echo "  2. Update outdated version references throughout the codebase"
    fi

    if [ $WRONG_MONTH_COUNT -gt 0 ]; then
        echo "  3. Correct date references to use current month/year"
    fi

    if [ $CLAUDE_SIZE -gt 35000 ]; then
        echo "  4. Consider optimizing CLAUDE.md size (move details to modular docs)"
    fi

    if [ $MISSING_DOCS -gt 0 ]; then
        echo "  5. Create missing documentation files in docs/ directory"
    fi
fi

echo ""
echo "Run this script regularly to maintain documentation consistency!"

# Çıkış kodu
if [ $TOTAL_ERRORS -gt 0 ]; then
    exit 1
elif [ $TOTAL_WARNINGS -gt 0 ]; then
    exit 0
else
    exit 0
fi