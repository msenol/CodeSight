#!/bin/bash

# Test Projects Indexer for MCP Server
# Indexes downloaded GitHub projects for testing

set -e

echo "🔍 Indexing GitHub projects for MCP testing..."
echo "=============================================="

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Check if Docker compose is running
check_docker_status() {
    echo -e "${BLUE}🐳 Checking Docker status...${NC}"

    if ! docker-compose -f docker-compose.test.yml ps -q | grep -q .; then
        echo -e "${YELLOW}⚠️ Docker containers are not running${NC}"
        echo -e "${YELLOW}💡 Starting Docker containers...${NC}"

        docker-compose -f docker-compose.test.yml up -d

        echo -e "${BLUE}⏳ Waiting for services to be ready...${NC}"
        sleep 30

        # Check if containers are healthy
        local retries=0
        local max_retries=10

        while [ $retries -lt $max_retries ]; do
            local healthy_count=$(docker-compose -f docker-compose.test.yml ps --format "table {{.Name}}\t{{.Health}}" | grep -c "healthy" || echo 0)

            if [ $healthy_count -ge 2 ]; then
                echo -e "${GREEN}✅ Services are healthy${NC}"
                break
            fi

            echo -e "${YELLOW}   Waiting for services... ($((retries + 1))/$max_retries)${NC}"
            sleep 10
            retries=$((retries + 1))
        done

        if [ $retries -eq $max_retries ]; then
            echo -e "${RED}❌ Services failed to become healthy${NC}"
            echo -e "${YELLOW}💡 Check logs: docker-compose -f docker-compose.test.yml logs${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✅ Docker containers are running${NC}"
    fi
}

# Function to index a single project
index_project() {
    local project_name=$1
    local project_path="/app/external-projects/$project_name"

    echo -e "\n${BLUE}📊 Indexing: $project_name${NC}"
    echo "--------------------------------"

    # Check if project exists
    if ! docker exec projectara-test-mcp test -d "$project_path"; then
        echo -e "${RED}   ❌ Project directory not found: $project_path${NC}"
        return 1
    fi

    # Get project statistics before indexing
    echo -e "${CYAN}📏 Analyzing project size...${NC}"
    local file_count=$(docker exec projectara-test-mcp find "$project_path" -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) 2>/dev/null | wc -l || echo 0)

    if [ "$file_count" -eq 0 ]; then
        echo -e "${YELLOW}   ⚠️ No supported files found in $project_name${NC}"
        return 1
    fi

    echo -e "${CYAN}   📄 Found $file_count supported files${NC}"

    # Index the project
    echo -e "${CYAN}🔄 Starting indexing process...${NC}"

    local start_time=$(date +%s)

    # Run indexing command
    if docker exec projectara-test-mcp node dist/minimal-index.js index "$project_path" --codebase-id="$project_name" --verbose; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))

        echo -e "${GREEN}   ✅ Successfully indexed $project_name${NC}"
        echo -e "${GREEN}   ⏱️  Duration: ${duration}s${NC}"

        # Verify indexing
        echo -e "${CYAN}🔍 Verifying index...${NC}"
        local stats=$(docker exec projectara-test-mcp node dist/minimal-index.js stats --codebase-id="$project_name" 2>/dev/null || echo "No stats available")
        echo -e "${CYAN}   📊 Stats: $stats${NC}"

        # Store indexing metadata
        echo -e "${CYAN}💾 Storing indexing metadata...${NC}"
        docker exec projectara-test-mcp mkdir -p "/app/test-results/indexing"
        docker exec projectara-test-mcp sh -c "echo '{\"project_name\": \"$project_name\", \"indexed_at\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\", \"file_count\": $file_count, \"duration_seconds\": $duration}' > /app/test-results/indexing/${project_name}.json"

        return 0
    else
        echo -e "${RED}   ❌ Failed to index $project_name${NC}"
        return 1
    fi
}

# Function to run parallel indexing
index_projects_parallel() {
    echo -e "\n${PURPLE}🚀 Starting parallel indexing...${NC}"

    local projects=(
        "react"
        "nextjs"
        "vite"
        "express"
        "fastapi"
        "lodash"
        "axios"
        "prettier"
        "tokio"
    )

    # Start indexing in background for smaller projects
    local pids=()
    local small_projects=("lodash" "axios" "prettier")

    echo -e "${CYAN}📊 Indexing small projects first...${NC}"
    for project in "${small_projects[@]}"; do
        if docker exec projectara-test-mcp test -d "/app/external-projects/$project"; then
            index_project "$project" &
            pids+=($!)
        fi
    done

    # Wait for small projects to finish
    for pid in "${pids[@]}"; do
        wait $pid
    done

    # Index larger projects sequentially
    echo -e "${CYAN}📊 Indexing larger projects...${NC}"
    local large_projects=("react" "nextjs" "vite" "express" "fastapi" "tokio")

    for project in "${large_projects[@]}"; do
        if docker exec projectara-test-mcp test -d "/app/external-projects/$project"; then
            index_project "$project"
        fi
    done
}

# Function to verify all indexes
verify_indexes() {
    echo -e "\n${BLUE}🔍 Verifying all indexes...${NC}"

    local projects=(
        "react"
        "nextjs"
        "vite"
        "express"
        "fastapi"
        "lodash"
        "axios"
        "prettier"
        "tokio"
    )

    local indexed_count=0
    local total_count=0

    for project in "${projects[@]}"; do
        total_count=$((total_count + 1))

        if docker exec projectara-test-mcp node dist/minimal-index.js stats --codebase-id="$project" >/dev/null 2>&1; then
            echo -e "${GREEN}   ✅ $project - Indexed${NC}"
            indexed_count=$((indexed_count + 1))
        else
            echo -e "${RED}   ❌ $project - Not indexed${NC}"
        fi
    done

    echo -e "\n${CYAN}📊 Indexing Summary:${NC}"
    echo -e "   📁 Indexed projects: $indexed_count/$total_count"

    if [ $indexed_count -eq $total_count ]; then
        echo -e "${GREEN}   🎉 All projects successfully indexed!${NC}"
        return 0
    else
        echo -e "${YELLOW}   ⚠️ Some projects failed to index${NC}"
        return 1
    fi
}

# Function to run initial tests
run_initial_tests() {
    echo -e "\n${BLUE}🧪 Running initial tests...${NC}"

    # Test search functionality
    echo -e "${CYAN}🔍 Testing search functionality...${NC}"
    if docker exec projectara-test-mcp node dist/minimal-index.js search --query="function" --codebase-id="react" >/dev/null 2>&1; then
        echo -e "${GREEN}   ✅ Search test passed${NC}"
    else
        echo -e "${RED}   ❌ Search test failed${NC}"
    fi

    # Test stats functionality
    echo -e "${CYAN}📊 Testing stats functionality...${NC}"
    if docker exec projectara-test-mcp node dist/minimal-index.js stats --codebase-id="lodash" >/dev/null 2>&1; then
        echo -e "${GREEN}   ✅ Stats test passed${NC}"
    else
        echo -e "${RED}   ❌ Stats test failed${NC}"
    fi

    # Test cross-project search
    echo -e "${CYAN}🔍 Testing cross-project search...${NC}"
    if docker exec projectara-test-mcp node dist/minimal-index.js search --query="import" --limit=5 >/dev/null 2>&1; then
        echo -e "${GREEN}   ✅ Cross-project search test passed${NC}"
    else
        echo -e "${RED}   ❌ Cross-project search test failed${NC}"
    fi
}

# Function to create indexing report
create_indexing_report() {
    echo -e "\n${BLUE}📋 Creating indexing report...${NC}"

    local report_file="/app/test-results/indexing-report.json"

    docker exec projectara-test-mcp sh -c "cat > $report_file << 'EOF'
{
  \"indexing_completed_at\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
  \"mcp_server_version\": \"test\",
  \"indexed_projects\": []
}
EOF"

    echo -e "${GREEN}   ✅ Indexing report created${NC}"
}

# Main indexing function
main() {
    echo -e "${GREEN}🚀 Starting project indexing...${NC}"

    # Check prerequisites
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker not found. Please install Docker first.${NC}"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}❌ Docker Compose not found. Please install Docker Compose first.${NC}"
        exit 1
    fi

    # Check if test projects exist
    if [ ! -d "external-test-projects" ]; then
        echo -e "${RED}❌ external-test-projects directory not found!${NC}"
        echo -e "${YELLOW}💡 Run ./scripts/download-test-projects.sh first${NC}"
        exit 1
    fi

    # Check Docker status
    check_docker_status

    # Create results directory
    mkdir -p test-results/indexing

    # Run indexing
    index_projects_parallel

    # Verify indexes
    if verify_indexes; then
        # Run initial tests
        run_initial_tests

        # Create report
        create_indexing_report

        echo -e "\n${GREEN}🎉 Indexing completed successfully!${NC}"
        echo -e "\n${YELLOW}💡 Next steps:${NC}"
        echo -e "   1. Run tests: ./scripts/test-real-projects.sh"
        echo -e "   2. Check results: ./test-results/"
        echo -e "   3. View logs: docker-compose -f docker-compose.test.yml logs test-code-intelligence"

    else
        echo -e "\n${RED}❌ Indexing completed with errors${NC}"
        echo -e "${YELLOW}💡 Check logs: docker-compose -f docker-compose.test.yml logs test-code-intelligence${NC}"
        exit 1
    fi
}

# Run main function
main "$@"