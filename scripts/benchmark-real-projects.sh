#!/bin/bash

# Real Projects Performance Benchmarking for MCP Server
# Comprehensive performance testing with GitHub projects

set -e

echo "⚡ Performance Benchmarking with Real GitHub Projects"
echo "====================================================="

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Benchmark configuration
WARMUP_RUNS=3
BENCHMARK_RUNS=10
SEARCH_QUERIES=(
    "function"
    "class"
    "import"
    "export"
    "async"
    "Promise"
    "useState"
    "component"
    "api"
    "router"
)
PROJECTS=(
    "lodash"
    "axios"
    "prettier"
    "react"
    "nextjs"
    "vite"
    "express"
)

# Results storage
RESULTS_FILE="test-results/performance-benchmark-$(date +%Y%m%d-%H%M%S).json"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Function to check Docker status
check_docker_status() {
    echo -e "${BLUE}🐳 Checking Docker status...${NC}"

    if ! docker-compose -f docker-compose.test.yml ps -q | grep -q .; then
        echo -e "${RED}❌ Docker containers are not running${NC}"
        echo -e "${YELLOW}💡 Start with: docker-compose -f docker-compose.test.yml up -d${NC}"
        exit 1
    fi

    # Check MCP server health
    if ! docker exec projectara-test-mcp curl -f http://localhost:4000/health >/dev/null 2>&1; then
        echo -e "${RED}❌ MCP server is not healthy${NC}"
        echo -e "${YELLOW}💡 Check logs: docker-compose -f docker-compose.test.yml logs test-code-intelligence${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Docker environment is ready${NC}"
}

# Function to run warmup queries
run_warmup() {
    echo -e "\n${CYAN}🔥 Running warmup queries...${NC}"

    for i in $(seq 1 $WARMUP_RUNS); do
        echo -e "${YELLOW}   Warmup run $i/$WARMUP_RUNS${NC}"
        docker exec projectara-test-mcp node dist/minimal-index.js search --query="function" --limit=10 >/dev/null 2>&1 || true
        sleep 1
    done

    echo -e "${GREEN}   ✅ Warmup completed${NC}"
}

# Function to measure search performance
benchmark_search() {
    local project=$1
    local query=$2
    local run=$3

    local start_time=$(date +%s.%N)

    # Run search query
    docker exec projectara-test-mcp node dist/minimal-index.js search \
        --query="$query" \
        --codebase-id="$project" \
        --limit=20 >/dev/null 2>&1

    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc -l)

    echo "$duration"
}

# Function to benchmark a single project
benchmark_project() {
    local project=$1
    echo -e "\n${BLUE}📊 Benchmarking: $project${NC}"
    echo "------------------------------------"

    # Check if project is indexed
    if ! docker exec projectara-test-mcp node dist/minimal-index.js stats --codebase-id="$project" >/dev/null 2>&1; then
        echo -e "${RED}   ❌ Project $project is not indexed${NC}"
        return 1
    fi

    # Get project stats
    local stats=$(docker exec projectara-test-mcp node dist/minimal-index.js stats --codebase-id="$project" 2>/dev/null || echo "No stats available")
    echo -e "${CYAN}   📋 Project stats: $stats${NC}"

    # Initialize results for this project
    local project_results="{\"project_name\": \"$project\", \"queries\": {}}"

    # Benchmark each query
    for query in "${SEARCH_QUERIES[@]}"; do
        echo -e "${CYAN}   🔍 Testing query: '$query'${NC}"

        local durations=()
        local total_duration=0

        # Run benchmark iterations
        for run in $(seq 1 $BENCHMARK_RUNS); do
            local duration=$(benchmark_search "$project" "$query" "$run")
            durations+=("$duration")
            total_duration=$(echo "$total_duration + $duration" | bc -l)

            # Show progress
            echo -ne "${YELLOW}     Run $run/$BENCHMARK_RUNS: ${duration}s${NC}\r"
            sleep 0.1
        done

        echo "" # New line after progress

        # Calculate statistics
        local avg_duration=$(echo "scale=4; $total_duration / $BENCHMARK_RUNS" | bc -l)

        # Find min and max
        local min_duration=${durations[0]}
        local max_duration=${durations[0]}

        for duration in "${durations[@]}"; do
            if (( $(echo "$duration < $min_duration" | bc -l) )); then
                min_duration=$duration
            fi
            if (( $(echo "$duration > $max_duration" | bc -l) )); then
                max_duration=$duration
            fi
        done

        echo -e "${GREEN}     📈 Average: ${avg_duration}s, Min: ${min_duration}s, Max: ${max_duration}s${NC}"

        # Add to results
        project_results=$(echo "$project_results" | jq ".queries[\"$query\"] = {
            \"average_duration\": $avg_duration,
            \"min_duration\": $min_duration,
            \"max_duration\": $max_duration,
            \"runs\": $BENCHMARK_RUNS,
            \"durations\": [$(printf ',%.6f' "${durations[@]}" | sed 's/^,//')]
        }")
    done

    echo "$project_results"
}

# Function to benchmark memory usage
benchmark_memory() {
    echo -e "\n${PURPLE}💾 Memory Usage Benchmarking${NC}"
    echo "=================================="

    # Get initial memory usage
    local initial_memory=$(docker stats projectara-test-mcp --no-stream --format "{{.MemUsage}}" | sed 's/MiB//' | sed 's/[^0-9.]//g')
    echo -e "${CYAN}   📊 Initial memory: ${initial_memory}MiB${NC}"

    # Run memory-intensive operations
    echo -e "${CYAN}   🔄 Running memory-intensive search operations...${NC}"

    for i in $(seq 1 20); do
        docker exec projectara-test-mcp node dist/minimal-index.js search --query="function" --limit=100 --codebase-id="react" >/dev/null 2>&1 || true &
        if [ $((i % 5)) -eq 0 ]; then
            wait  # Wait for background jobs every 5 iterations
        fi
    done

    wait  # Wait for all remaining jobs

    # Get peak memory usage
    local peak_memory=$(docker stats projectara-test-mcp --no-stream --format "{{.MemUsage}}" | sed 's/MiB//' | sed 's/[^0-9.]//g')
    echo -e "${CYAN}   📊 Peak memory: ${peak_memory}MiB${NC}"

    # Calculate memory increase
    local memory_increase=$(echo "scale=2; $peak_memory - $initial_memory" | bc -l)
    echo -e "${GREEN}   📈 Memory increase: ${memory_increase}MiB${NC}"

    # Memory efficiency metrics
    local memory_per_result=$(echo "scale=4; $peak_memory / 1000" | bc -l)
    echo -e "${GREEN}   📊 Memory per 1000 results: ${memory_per_result}MiB${NC}"

    # Return memory results as JSON
    echo "{\"initial_memory\": $initial_memory, \"peak_memory\": $peak_memory, \"memory_increase\": $memory_increase}"
}

# Function to benchmark indexing performance
benchmark_indexing() {
    echo -e "\n${YELLOW}📏 Indexing Performance Benchmark${NC}"
    echo "======================================"

    # Create a small test project for indexing benchmark
    local test_project_dir="/tmp/benchmark-test-project"

    echo -e "${CYAN}   📁 Creating test project for indexing benchmark...${NC}"
    docker exec projectara-test-mcp mkdir -p "$test_project_dir"

    # Create test files
    for i in {1..100}; do
        docker exec projectara-test-mcp sh -c "cat > $test_project_dir/file_$i.js << 'EOF'
function testFunction_$i() {
    const data = {
        id: $i,
        name: 'test_$i',
        items: Array.from({length: $i}, (_, index) => index + 1)
    };

    return data.map(item => item * 2).filter(x => x > 0);
}

class TestClass_$i {
    constructor(value) {
        this.value = value;
    }

    method() {
        return this.value * $i;
    }
}

export { testFunction_$i, TestClass_$i };
EOF"
    done

    # Benchmark indexing
    echo -e "${CYAN}   🔄 Benchmarking indexing performance...${NC}"

    local indexing_times=()
    local total_indexing_time=0

    for run in {1..3}; do
        # Clean previous index
        docker exec projectara-test-mcp node dist/minimal-index.js delete --codebase-id="benchmark-test" >/dev/null 2>&1 || true

        # Time the indexing process
        local start_time=$(date +%s.%N)
        docker exec projectara-test-mcp node dist/minimal-index.js index "$test_project_dir" --codebase-id="benchmark-test" >/dev/null 2>&1
        local end_time=$(date +%s.%N)

        local duration=$(echo "$end_time - $start_time" | bc -l)
        indexing_times+=("$duration")
        total_indexing_time=$(echo "$total_indexing_time + $duration" | bc -l)

        echo -e "${YELLOW}     Indexing run $run/3: ${duration}s${NC}"
    done

    # Calculate indexing statistics
    local avg_indexing_time=$(echo "scale=4; $total_indexing_time / 3" | bc -l)
    local files_per_second=$(echo "scale=2; 100 / $avg_indexing_time" | bc -l)

    echo -e "${GREEN}   📊 Average indexing time: ${avg_indexing_time}s${NC}"
    echo -e "${GREEN}   📊 Files per second: $files_per_second${NC}"

    # Clean up
    docker exec projectara-test-mcp rm -rf "$test_project_dir"
    docker exec projectara-test-mcp node dist/minimal-index.js delete --codebase-id="benchmark-test" >/dev/null 2>&1 || true

    # Return indexing results
    echo "{\"avg_indexing_time\": $avg_indexing_time, \"files_per_second\": $files_per_second, \"test_files\": 100}"
}

# Function to create comprehensive report
create_benchmark_report() {
    echo -e "\n${BLUE}📋 Creating comprehensive benchmark report...${NC}"

    local all_results="{\"timestamp\": \"$TIMESTAMP\", \"benchmark_type\": \"real_projects\", \"config\": {\"warmup_runs\": $WARMUP_RUNS, \"benchmark_runs\": $BENCHMARK_RUNS, \"queries\": [$(printf '\"%s\",' "${SEARCH_QUERIES[@]}" | sed 's/,$//')]}, \"projects\": [], \"memory_benchmark\": {}, \"indexing_benchmark\": {}}"

    # Add project results
    for project in "${PROJECTS[@]}"; do
        if docker exec projectara-test-mcp node dist/minimal-index.js stats --codebase-id="$project" >/dev/null 2>&1; then
            local project_result=$(benchmark_project "$project")
            all_results=$(echo "$all_results" | jq ".projects += [$project_result]")
        fi
    done

    # Add memory benchmark results
    local memory_result=$(benchmark_memory)
    all_results=$(echo "$all_results" | jq ".memory_benchmark = $memory_result")

    # Add indexing benchmark results
    local indexing_result=$(benchmark_indexing)
    all_results=$(echo "$all_results" | jq ".indexing_benchmark = $indexing_result")

    # Calculate overall statistics
    echo -e "${CYAN}📊 Calculating overall statistics...${NC}"

    # Find best and worst performing projects/queries
    local avg_performance=$(echo "$all_results" | jq '[.projects[].queries[] | .average_duration] | add / length')
    all_results=$(echo "$all_results" | jq ".overall_stats = {\"average_search_time\": $avg_performance}")

    # Save results
    mkdir -p test-results
    echo "$all_results" > "$RESULTS_FILE"

    echo -e "${GREEN}   ✅ Benchmark report saved to: $RESULTS_FILE${NC}"
}

# Function to display summary
display_summary() {
    echo -e "\n${GREEN}🎉 Benchmarking Complete!${NC}"
    echo "=============================="

    echo -e "${CYAN}📊 Quick Summary:${NC}"
    echo -e "   📁 Projects tested: ${#PROJECTS[@]}"
    echo -e "   🔍 Queries per project: ${#SEARCH_QUERIES[@]}"
    echo -e "   🔄 Runs per query: $BENCHMARK_RUNS"
    echo -e "   💾 Results saved to: $RESULTS_FILE"

    echo -e "\n${YELLOW}💡 Next steps:${NC}"
    echo -e "   1. View detailed results: cat $RESULTS_FILE | jq ."
    echo -e "   2. Generate HTML report: ./scripts/generate-benchmark-report.sh"
    echo -e "   3. Compare with previous benchmarks"
    echo -e "   4. Check memory usage: docker stats projectara-test-mcp"
}

# Main benchmarking function
main() {
    echo -e "${GREEN}🚀 Starting performance benchmarking...${NC}"

    # Check dependencies
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker not found${NC}"
        exit 1
    fi

    if ! command -v bc &> /dev/null; then
        echo -e "${RED}❌ 'bc' calculator not found${NC}"
        exit 1
    fi

    # Check Docker status
    check_docker_status

    # Run warmup
    run_warmup

    # Create benchmark report
    create_benchmark_report

    # Display summary
    display_summary

    echo -e "\n${GREEN}✅ Performance benchmarking completed successfully!${NC}"
}

# Run main function
main "$@"