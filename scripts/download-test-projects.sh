#!/bin/bash

# GitHub Public Projects Downloader for MCP Testing
# Downloads popular open-source projects for realistic testing scenarios

set -e  # Exit on any error

echo "🚀 Downloading popular GitHub projects for MCP testing..."
echo "================================================================"

# Create external test projects directory
mkdir -p external-test-projects
cd external-test-projects

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to download and analyze a project
download_project() {
    local repo_url=$1
    local project_name=$2
    local description=$3

    echo -e "${BLUE}📥 Downloading: ${description}${NC}"
    echo -e "${YELLOW}   Repository: $repo_url${NC}"

    if [ -d "$project_name" ]; then
        echo -e "${GREEN}   ✅ Already exists, skipping...${NC}"
        return 0
    fi

    # Clone with depth 1 to save time and space
    if git clone --depth 1 --quiet "$repo_url" "$project_name"; then
        echo -e "${GREEN}   ✅ Successfully downloaded${NC}"

        # Basic analysis
        local file_count=$(find "$project_name" -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" -o -name "*.rs" -o -name "*.py" \) | wc -l)
        local size=$(du -sh "$project_name" | cut -f1)

        echo -e ${BLUE}"   📊 Files: $file_count, Size: $size${NC}"
    else
        echo -e "${RED}   ❌ Failed to download${NC}"
        return 1
    fi

    echo ""
}

# Function to check if git is available
check_dependencies() {
    if ! command -v git &> /dev/null; then
        echo -e "${RED}❌ Git is not installed. Please install git first.${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Dependencies check passed${NC}"
}

# Function to create project metadata
create_metadata() {
    echo -e "${BLUE}📋 Creating project metadata...${NC}"

    cat > project-metadata.json << 'EOF'
{
  "projects": {
    "react": {
      "name": "React",
      "type": "frontend-framework",
      "language": "typescript",
      "description": "A JavaScript library for building user interfaces",
      "url": "https://github.com/facebook/react"
    },
    "nextjs": {
      "name": "Next.js",
      "type": "fullstack-framework",
      "language": "typescript",
      "description": "The React Framework for Production",
      "url": "https://github.com/vercel/next.js"
    },
    "vite": {
      "name": "Vite",
      "type": "build-tool",
      "language": "typescript",
      "description": "Next Generation Frontend Tooling",
      "url": "https://github.com/vitejs/vite"
    },
    "express": {
      "name": "Express.js",
      "type": "backend-framework",
      "language": "javascript",
      "description": "Fast, unopinionated, minimalist web framework for Node.js",
      "url": "https://github.com/expressjs/express"
    },
    "lodash": {
      "name": "Lodash",
      "type": "utility-library",
      "language": "javascript",
      "description": "A modern JavaScript utility library",
      "url": "https://github.com/lodash/lodash"
    },
    "axios": {
      "name": "Axios",
      "type": "http-client",
      "language": "typescript",
      "description": "Promise based HTTP client for the browser and node.js",
      "url": "https://github.com/axios/axios"
    },
    "prettier": {
      "name": "Prettier",
      "type": "code-formatter",
      "language": "typescript",
      "description": "An opinionated code formatter",
      "url": "https://github.com/prettier/prettier"
    },
    "tokio": {
      "name": "Tokio",
      "type": "async-runtime",
      "language": "rust",
      "description": "A runtime for writing reliable asynchronous applications with Rust",
      "url": "https://github.com/tokio-rs/tokio"
    },
    "fastapi": {
      "name": "FastAPI",
      "type": "api-framework",
      "language": "python",
      "description": "FastAPI framework, high performance, easy to learn, fast to code",
      "url": "https://github.com/tiangolo/fastapi"
    }
  },
  "download_date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "total_projects": 9
}
EOF

    echo -e "${GREEN}   ✅ Metadata created${NC}"
}

# Main download process
main() {
    echo -e "${BLUE}🔍 Checking dependencies...${NC}"
    check_dependencies

    echo -e "\n${BLUE}🎨 Downloading Frontend Projects...${NC}"
    echo "====================================="

    download_project "https://github.com/facebook/react.git" "react" "React - UI Library (220K+ stars)"
    download_project "https://github.com/vercel/next.js.git" "nextjs" "Next.js - Full-stack Framework (120K+ stars)"
    download_project "https://github.com/vitejs/vite.git" "vite" "Vite - Build Tool (65K+ stars)"

    echo -e "\n${BLUE}⚙️ Downloading Backend Projects...${NC}"
    echo "===================================="

    download_project "https://github.com/expressjs/express.git" "express" "Express.js - Web Framework (63K+ stars)"
    download_project "https://github.com/tiangolo/fastapi.git" "fastapi" "FastAPI - API Framework (75K+ stars)"

    echo -e "\n${BLUE}🛠️ Downloading Utility Projects...${NC}"
    echo "=================================="

    download_project "https://github.com/lodash/lodash.git" "lodash" "Lodash - Utility Library (59K+ stars)"
    download_project "https://github.com/axios/axios.git" "axios" "Axios - HTTP Client (103K+ stars)"
    download_project "https://github.com/prettier/prettier.git" "prettier" "Prettier - Code Formatter (47K+ stars)"

    echo -e "\n${BLUE}🦀 Downloading Rust Projects...${NC}"
    echo "==============================="

    download_project "https://github.com/tokio-rs/tokio.git" "tokio" "Tokio - Async Runtime (25K+ stars)"

    echo -e "\n${BLUE}📋 Creating project metadata...${NC}"
    create_metadata

    # Summary
    echo -e "\n${GREEN}🎉 Download Complete!${NC}"
    echo "========================"

    local total_size=$(du -sh . | cut -f1)
    local project_count=$(ls -1d */ | wc -l)

    echo -e "${BLUE}📊 Summary:${NC}"
    echo -e "   📁 Projects downloaded: $project_count"
    echo -e "   💾 Total size: $total_size"
    echo -e "   📂 Location: $(pwd)"

    echo -e "\n${YELLOW}💡 Next steps:${NC}"
    echo -e "   1. Run: ./scripts/analyze-projects.sh to analyze the projects"
    echo -e "   2. Run: docker-compose -f docker-compose.test.yml up -d"
    echo -e "   3. Run: ./scripts/index-test-projects.sh to index for MCP testing"

    echo -e "\n${GREEN}✅ Ready for realistic MCP testing!${NC}"
}

# Run main function
main "$@"