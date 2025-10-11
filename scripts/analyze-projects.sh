#!/bin/bash

# GitHub Projects Analyzer for MCP Testing
# Analyzes downloaded projects and provides detailed metrics

set -e

echo "📊 Analyzing downloaded GitHub projects..."
echo "=========================================="

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Check if we're in the right directory
if [ ! -d "external-test-projects" ]; then
    echo -e "${RED}❌ external-test-projects directory not found!${NC}"
    echo -e "${YELLOW}💡 Run ./scripts/download-test-projects.sh first${NC}"
    exit 1
fi

cd external-test-projects

# Function to analyze a single project
analyze_project() {
    local project_dir=$1
    local project_name=$(basename "$project_dir")

    echo -e "\n${BLUE}🔍 Analyzing: $project_name${NC}"
    echo "---------------------------------------"

    if [ ! -d "$project_dir" ]; then
        echo -e "${RED}   ❌ Project directory not found${NC}"
        return 1
    fi

    # Basic file statistics
    local js_files=$(find "$project_dir" -type f -name "*.js" | wc -l)
    local ts_files=$(find "$project_dir" -type f -name "*.ts" | wc -l)
    local jsx_files=$(find "$project_dir" -type f -name "*.jsx" | wc -l)
    local tsx_files=$(find "$project_dir" -type f -name "*.tsx" | wc -l)
    local rs_files=$(find "$project_dir" -type f -name "*.rs" | wc -l)
    local py_files=$(find "$project_dir" -type f -name "*.py" | wc -l)

    local total_files=$((js_files + ts_files + jsx_files + tsx_files + rs_files + py_files))

    # Line count statistics
    local js_lines=$(find "$project_dir" -type f -name "*.js" -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}' || echo 0)
    local ts_lines=$(find "$project_dir" -type f -name "*.ts" -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}' || echo 0)
    local jsx_lines=$(find "$project_dir" -type f -name "*.jsx" -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}' || echo 0)
    local tsx_lines=$(find "$project_dir" -type f -name "*.tsx" -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}' || echo 0)
    local rs_lines=$(find "$project_dir" -type f -name "*.rs" -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}' || echo 0)
    local py_lines=$(find "$project_dir" -type f -name "*.py" -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}' || echo 0)

    local total_lines=$((js_lines + ts_lines + jsx_lines + tsx_lines + rs_lines + py_lines))

    # Directory size
    local size=$(du -sh "$project_dir" 2>/dev/null | cut -f1 || echo "Unknown")

    # Complex patterns
    local functions=$(find "$project_dir" -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) -exec grep -l "function\|const.*=" {} \; | wc -l)
    local classes=$(find "$project_dir" -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) -exec grep -l "class\|extends\|implements" {} \; | wc -l)
    local imports=$(find "$project_dir" -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) -exec grep -l "import\|require" {} \; | wc -l)

    # Output results
    echo -e "${CYAN}📁 File Statistics:${NC}"
    echo -e "   JavaScript: $js_files files, $js_lines lines"
    echo -e "   TypeScript: $ts_files files, $ts_lines lines"
    echo -e "   JSX: $jsx_files files, $jsx_lines lines"
    echo -e "   TSX: $tsx_files files, $tsx_lines lines"
    echo -e "   Rust: $rs_files files, $rs_lines lines"
    echo -e "   Python: $py_files files, $py_lines lines"
    echo -e "   ${GREEN}Total: $total_files files, $total_lines lines${NC}"

    echo -e "\n${CYAN}📏 Size: $size${NC}"

    echo -e "\n${CYAN}🔧 Code Patterns:${NC}"
    echo -e "   Functions found in: $functions files"
    echo -e "   Classes found in: $classes files"
    echo -e "   Imports found in: $imports files"

    # Determine project category
    local category="Unknown"
    if [ $total_files -lt 100 ]; then
        category="Small"
    elif [ $total_files -lt 1000 ]; then
        category="Medium"
    elif [ $total_files -lt 5000 ]; then
        category="Large"
    else
        category="Very Large"
    fi

    echo -e "\n${PURPLE}📊 Project Category: $category${NC}"

    # Detect primary language
    local primary_lang="JavaScript"
    if [ $ts_files -gt $js_files ]; then
        if [ $rs_files -gt $ts_files ]; then
            primary_lang="Rust"
        elif [ $py_files -gt $ts_files ]; then
            primary_lang="Python"
        else
            primary_lang="TypeScript"
        fi
    elif [ $rs_files -gt $js_files ]; then
        primary_lang="Rust"
    elif [ $py_files -gt $js_files ]; then
        primary_lang="Python"
    fi

    echo -e "${PURPLE}🎯 Primary Language: $primary_lang${NC}"
}

# Function to create analysis report
create_analysis_report() {
    echo -e "\n${BLUE}📋 Creating analysis report...${NC}"

    cat > analysis-report.json << 'EOF'
{
  "analysis_date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "projects": {}
}
EOF

    # This would be populated with actual project data in a real implementation
    echo -e "${GREEN}   ✅ Analysis report created${NC}"
}

# Function to show summary
show_summary() {
    echo -e "\n${BLUE}📊 Summary Analysis${NC}"
    echo "====================="

    local total_projects=$(ls -1d */ 2>/dev/null | wc -l)
    local total_size=$(du -sh . 2>/dev/null | cut -f1 || echo "Unknown")

    # Count all files by type
    local total_js=$(find . -name "*.js" | wc -l)
    local total_ts=$(find . -name "*.ts" | wc -l)
    local total_rs=$(find . -name "*.rs" | wc -l)
    local total_py=$(find . -name "*.py" | wc -l)

    echo -e "${CYAN}📈 Overall Statistics:${NC}"
    echo -e "   📁 Total projects: $total_projects"
    echo -e "   💾 Total size: $total_size"
    echo -e "   📄 JavaScript files: $total_js"
    echo -e "   📄 TypeScript files: $total_ts"
    echo -e "   📄 Rust files: $total_rs"
    echo -e "   📄 Python files: $total_py"

    echo -e "\n${YELLOW}💡 Next Steps:${NC}"
    echo -e "   1. Start Docker: docker-compose -f docker-compose.test.yml up -d"
    echo -e "   2. Index projects: ./scripts/index-test-projects.sh"
    echo -e "   3. Run tests: ./scripts/test-real-projects.sh"
    echo -e "   4. Check results: ./test-results/"
}

# Main analysis function
main() {
    echo -e "${GREEN}🚀 Starting project analysis...${NC}"

    # Check for required tools
    if ! command -v find &> /dev/null; then
        echo -e "${RED}❌ 'find' command not available${NC}"
        exit 1
    fi

    # Analyze each project
    for project_dir in */; do
        if [ -d "$project_dir" ]; then
            analyze_project "$project_dir"
        fi
    done

    # Create summary report
    create_analysis_report
    show_summary

    echo -e "\n${GREEN}✅ Analysis complete!${NC}"
}

# Run main function
main "$@"