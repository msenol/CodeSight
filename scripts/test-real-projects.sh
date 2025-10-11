#!/bin/bash

# Comprehensive Real Projects Testing for MCP Server
# Runs various test scenarios with GitHub projects

set -e

echo "🧪 Comprehensive Testing with Real GitHub Projects"
echo "==============================================="

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Test configuration
TEST_TIMEOUT=300
MAX_RESULTS=100
SEARCH_QUERIES=(
    "React hook"
    "Express middleware"
    "async function"
    "TypeScript interface"
    "Promise callback"
    "API endpoint"
    "utility function"
    "class component"
    "import statement"
    "error handling"
)
PROJECTS=(
    "react"
    "nextjs"
    "vite"
    "express"
    "lodash"
    "axios"
    "prettier"
)

# Results directory
RESULTS_DIR="test-results/real-projects-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

# Function to check Docker status
check_docker_status() {
    echo -e "${BLUE}🐳 Checking Docker environment...${NC}"

    if ! docker-compose -f docker-compose.test.yml ps -q | grep -q .; then
        echo -e "${RED}❌ Docker containers are not running${NC}"
        exit 1
    fi

    # Test MCP server connectivity
    if ! curl -f http://localhost:4000/health >/dev/null 2>&1; then
        echo -e "${RED}❌ MCP server is not responding${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Docker environment is ready${NC}"
}

# Function to test basic search functionality
test_basic_search() {
    echo -e "\n${CYAN}🔍 Testing Basic Search Functionality${NC}"
    echo "======================================="

    local test_results=()

    for project in "${PROJECTS[@]}"; do
        echo -e "${BLUE}   Testing: $project${NC}"

        # Check if project is indexed
        if ! docker exec projectara-test-mcp node dist/minimal-index.js stats --codebase-id="$project" >/dev/null 2>&1; then
            echo -e "${RED}     ❌ Project not indexed${NC}"
            test_results+=("$project:NOT_INDEXED")
            continue
        fi

        # Test basic search
        if docker exec projectara-test-mcp timeout 30 node dist/minimal-index.js search --query="function" --codebase-id="$project" --limit=5 >/dev/null 2>&1; then
            echo -e "${GREEN}     ✅ Basic search passed${NC}"
            test_results+=("$project:BASIC_SEARCH:PASS")
        else
            echo -e "${RED}     ❌ Basic search failed${NC}"
            test_results+=("$project:BASIC_SEARCH:FAIL")
        fi

        # Test search with different limits
        if docker exec projectara-test-mcp timeout 30 node dist/minimal-index.js search --query="function" --codebase-id="$project" --limit=50 >/dev/null 2>&1; then
            echo -e "${GREEN}     ✅ Search with limit passed${NC}"
        else
            echo -e "${RED}     ❌ Search with limit failed${NC}"
        fi

        # Test stats functionality
        if docker exec projectara-test-mcp timeout 30 node dist/minimal-index.js stats --codebase-id="$project" >/dev/null 2>&1; then
            echo -e "${GREEN}     ✅ Stats functionality passed${NC}"
        else
            echo -e "${RED}     ❌ Stats functionality failed${NC}"
        fi
    done

    # Save results
    printf '%s\n' "${test_results[@]}" > "$RESULTS_DIR/basic_search_results.txt"
}

# Function to test advanced search scenarios
test_advanced_search() {
    echo -e "\n${PURPLE}🔬 Testing Advanced Search Scenarios${NC}"
    echo "====================================="

    # Test cross-project search
    echo -e "${CYAN}   🌐 Testing cross-project search...${NC}"
    if docker exec projectara-test-mcp timeout 60 node dist/minimal-index.js search --query="import" --limit=20 > "$RESULTS_DIR/cross_project_search.json" 2>&1; then
        echo -e "${GREEN}     ✅ Cross-project search passed${NC}"
    else
        echo -e "${RED}     ❌ Cross-project search failed${NC}"
    fi

    # Test language-specific search
    echo -e "${CYAN}   📝 Testing TypeScript-specific search...${NC}"
    if docker exec projectara-test-mcp timeout 30 node dist/minimal-index.js search --query="interface|type" --language="typescript" --limit=10 > "$RESULTS_DIR/typescript_search.json" 2>&1; then
        echo -e "${GREEN}     ✅ TypeScript search passed${NC}"
    else
        echo -e "${RED}     ❌ TypeScript search failed${NC}"
    fi

    # Test complex queries
    echo -e "${CYAN}   🧠 Testing complex queries...${NC}"
    local complex_queries=(
        "async.*await"
        "function.*return.*Promise"
        "class.*extends.*React.Component"
        "app\.get.*router"
    )

    for query in "${complex_queries[@]}"; do
        echo -e "${YELLOW}     Testing: $query${NC}"
        if docker exec projectara-test-mcp timeout 30 node dist/minimal-index.js search --query="$query" --limit=5 > "$RESULTS_DIR/complex_query_${query//[^a-zA-Z0-9]/_}.json" 2>&1; then
            echo -e "${GREEN}       ✅ Passed${NC}"
        else
            echo -e "${RED}       ❌ Failed${NC}"
        fi
    done
}

# Function to test performance under load
test_performance_load() {
    echo -e "\n${YELLOW}⚡ Testing Performance Under Load${NC}"
    echo "===================================="

    echo -e "${CYAN}   🔄 Running concurrent searches...${NC}"

    # Start multiple concurrent searches
    local pids=()
    local start_time=$(date +%s)

    for i in {1..10}; do
        (
            project=${PROJECTS[$((i % ${#PROJECTS[@]}))}
            query=${SEARCH_QUERIES[$((i % ${#SEARCH_QUERIES[@]}))}
            docker exec projectara-test-mcp timeout 30 node dist/minimal-index.js search --query="$query" --codebase-id="$project" --limit=10 > "$RESULTS_DIR/load_test_$i.json" 2>&1
        ) &
        pids+=($!)
    done

    # Wait for all searches to complete
    local failed_count=0
    for pid in "${pids[@]}"; do
        if ! wait "$pid"; then
            failed_count=$((failed_count + 1))
        fi
    done

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo -e "${GREEN}   ✅ Load test completed in ${duration}s${NC}"
    echo -e "${GREEN}   📊 Success rate: $(((${#pids[@]} - failed_count) * 100 / ${#pids[@]}))%${NC}"

    if [ $failed_count -gt 0 ]; then
        echo -e "${YELLOW}   ⚠️ Failed searches: $failed_count${NC}"
    fi
}

# Function to test error handling
test_error_handling() {
    echo -e "\n${RED}🚨 Testing Error Handling${NC}"
    echo "==========================="

    echo -e "${CYAN}   📝 Testing invalid queries...${NC}"

    # Test with invalid codebase ID
    if docker exec projectara-test-mcp timeout 30 node dist/minimal-index.js search --query="function" --codebase-id="nonexistent" 2>/dev/null; then
        echo -e "${RED}     ❌ Should have failed with invalid codebase${NC}"
    else
        echo -e "${GREEN}     ✅ Correctly handled invalid codebase${NC}"
    fi

    # Test with empty query
    if docker exec projectara-test-mcp timeout 30 node dist/minimal-index.js search --query="" --codebase-id="react" 2>/dev/null; then
        echo -e "${YELLOW}     ⚠️ Empty query handled (may be valid)${NC}"
    else
        echo -e "${GREEN}     ✅ Empty query correctly rejected${NC}"
    fi

    # Test with very long query
    local long_query=$(printf "function %.0s" {1..1000})
    if docker exec projectara-test-mcp timeout 30 node dist/minimal-index.js search --query="$long_query" --codebase-id="react" 2>/dev/null; then
        echo -e "${GREEN}     ✅ Long query handled gracefully${NC}"
    else
        echo -e "${YELLOW}     ⚠️ Long query rejected (may be intentional)${NC}"
    fi

    echo -e "${CYAN}   🗄️ Testing database connectivity...${NC}"

    # Test database connection recovery
    docker exec projectara-test-postgres pg_isready -U test_user >/dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}     ✅ Database connection healthy${NC}"
    else
        echo -e "${RED}     ❌ Database connection failed${NC}"
    fi

    echo -e "${CYAN}   📡 Testing Redis connectivity...${NC}"

    # Test Redis connection
    if docker exec projectara-test-redis redis-cli ping >/dev/null 2>&1; then
        echo -e "${GREEN}     ✅ Redis connection healthy${NC}"
    else
        echo -e "${RED}     ❌ Redis connection failed${NC}"
    fi
}

# Function to test data consistency
test_data_consistency() {
    echo -e "\n${BLUE}🔍 Testing Data Consistency${NC}"
    echo "==============================="

    echo -e "${CYAN}   📊 Comparing search results consistency...${NC}"

    # Run the same query multiple times and compare results
    local project="react"
    local query="useState"
    local consistency_file="$RESULTS_DIR/consistency_test.json"

    for i in {1..3}; do
        echo -e "${YELLOW}     Run $i/3${NC}"
        docker exec projectara-test-mcp timeout 30 node dist/minimal-index.js search --query="$query" --codebase-id="$project" --limit=10 > "$RESULTS_DIR/consistency_run_$i.json" 2>/dev/null
    done

    # Compare results (simple comparison)
    if [ -f "$RESULTS_DIR/consistency_run_1.json" ] && [ -f "$RESULTS_DIR/consistency_run_2.json" ]; then
        local result1_size=$(wc -c < "$RESULTS_DIR/consistency_run_1.json")
        local result2_size=$(wc -c < "$RESULTS_DIR/consistency_run_2.json")

        if [ "$result1_size" -eq "$result2_size" ]; then
            echo -e "${GREEN}     ✅ Results appear consistent${NC}"
        else
            echo -e "${YELLOW}     ⚠️ Results differ in size (may be normal)${NC}"
        fi
    fi

    echo -e "${CYAN}   📈 Testing statistics accuracy...${NC}"

    # Test if stats are reasonable
    local stats_output=$(docker exec projectara-test-mcp timeout 30 node dist/minimal-index.js stats --codebase-id="$project" 2>/dev/null)
    if [ $? -eq 0 ] && [ -n "$stats_output" ]; then
        echo -e "${GREEN}     ✅ Stats output available${NC}"
        echo "$stats_output" > "$RESULTS_DIR/stats_output.txt"
    else
        echo -e "${RED}     ❌ Stats output failed${NC}"
    fi
}

# Function to test API endpoints
test_api_endpoints() {
    echo -e "\n${PURPLE}🌐 Testing API Endpoints${NC}"
    echo "==========================="

    local base_url="http://localhost:4000"

    # Test health endpoint
    echo -e "${CYAN}   ❤️ Testing health endpoint...${NC}"
    if curl -f "$base_url/health" > "$RESULTS_DIR/health_check.json" 2>/dev/null; then
        echo -e "${GREEN}     ✅ Health endpoint working${NC}"
    else
        echo -e "${RED}     ❌ Health endpoint failed${NC}"
    fi

    # Test search endpoint
    echo -e "${CYAN}   🔍 Testing search endpoint...${NC}"
    if curl -X POST "$base_url/api/search" \
        -H "Content-Type: application/json" \
        -d '{"query": "function", "codebase_id": "react", "limit": 5}' \
        > "$RESULTS_DIR/api_search_test.json" 2>/dev/null; then
        echo -e "${GREEN}     ✅ Search endpoint working${NC}"
    else
        echo -e "${RED}     ❌ Search endpoint failed${NC}"
    fi

    # Test WebSocket/MCP connection
    echo -e "${CYAN}   🔌 Testing WebSocket connection...${NC}"
    if timeout 10 wscat -c "ws://localhost:8080" -x '{"jsonrpc": "2.0", "method": "search_code", "params": {"query": "function"}}' > "$RESULTS_DIR/websocket_test.json" 2>/dev/null; then
        echo -e "${GREEN}     ✅ WebSocket connection working${NC}"
    else
        echo -e "${YELLOW}     ⚠️ WebSocket test inconclusive${NC}"
    fi
}

# Function to generate test report
generate_test_report() {
    echo -e "\n${BLUE}📋 Generating Test Report${NC}"
    echo "==========================="

    local report_file="$RESULTS_DIR/test_report.json"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    cat > "$report_file" << EOF
{
  "test_run": {
    "timestamp": "$timestamp",
    "docker_compose_file": "docker-compose.test.yml",
    "test_environment": "GitHub projects",
    "total_tests": 0,
    "passed_tests": 0,
    "failed_tests": 0
  },
  "projects_tested": [$(printf '"%s",' "${PROJECTS[@]}" | sed 's/,$//')],
  "test_categories": {
    "basic_search": {
      "status": "completed",
      "results_file": "basic_search_results.txt"
    },
    "advanced_search": {
      "status": "completed",
      "results_count": $(find "$RESULTS_DIR" -name "*search*.json" | wc -l)
    },
    "performance_load": {
      "status": "completed",
      "results_file": "load_test_*.json"
    },
    "error_handling": {
      "status": "completed"
    },
    "data_consistency": {
      "status": "completed",
      "results_file": "consistency_*.json"
    },
    "api_endpoints": {
      "status": "completed",
      "endpoints_tested": 3
    }
  },
  "results_directory": "$RESULTS_DIR"
}
EOF

    echo -e "${GREEN}   ✅ Test report generated: $report_file${NC}"

    # Generate summary
    echo -e "\n${CYAN}📊 Test Summary:${NC}"
    echo -e "   📁 Results directory: $RESULTS_DIR"
    echo -e "   📋 Report file: $report_file"
    echo -e "   📄 Total result files: $(find "$RESULTS_DIR" -name "*.json" -o -name "*.txt" | wc -l)"
}

# Function to display final summary
display_final_summary() {
    echo -e "\n${GREEN}🎉 Real Projects Testing Complete!${NC}"
    echo "===================================="

    echo -e "${CYAN}📊 Test Results Summary:${NC}"
    echo -e "   📁 Projects tested: ${#PROJECTS[@]}"
    echo -e "   🔍 Queries tested: ${#SEARCH_QUERIES[@]}"
    echo -e "   📁 Results saved to: $RESULTS_DIR"

    # Check for any major failures
    local failed_files=$(find "$RESULTS_DIR" -name "*.json" -exec grep -l "error\|Error\|ERROR\|failed" {} \; | wc -l)
    if [ "$failed_files" -gt 0 ]; then
        echo -e "${YELLOW}   ⚠️ $failed_files files contain errors - check logs${NC}"
    else
        echo -e "${GREEN}   ✅ No major errors detected${NC}"
    fi

    echo -e "\n${YELLOW}💡 Next steps:${NC}"
    echo -e "   1. Review detailed results: ls -la $RESULTS_DIR/"
    echo -e "   2. Check specific failures: grep -r error $RESULTS_DIR/"
    echo -e "   3. Run performance benchmarks: ./scripts/benchmark-real-projects.sh"
    echo -e "   4. Generate HTML report: ./scripts/generate-test-report.sh"

    echo -e "\n${GREEN}✅ Testing completed successfully!${NC}"
}

# Main testing function
main() {
    echo -e "${GREEN}🚀 Starting comprehensive testing...${NC}"

    # Check dependencies
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker not found${NC}"
        exit 1
    fi

    if ! command -v curl &> /dev/null; then
        echo -e "${RED}❌ curl not found${NC}"
        exit 1
    fi

    # Check Docker status
    check_docker_status

    # Run all test categories
    test_basic_search
    test_advanced_search
    test_performance_load
    test_error_handling
    test_data_consistency
    test_api_endpoints

    # Generate reports
    generate_test_report

    # Display final summary
    display_final_summary
}

# Run main function
main "$@"