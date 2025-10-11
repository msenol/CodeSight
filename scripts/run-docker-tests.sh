#!/bin/bash

# Master Script for Running Docker Tests with GitHub Projects
# Complete end-to-end testing pipeline

set -e

echo "🚀 MCP Docker Testing with GitHub Projects - Master Pipeline"
echo "=========================================================="

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
SKIP_DOWNLOAD=false
SKIP_BUILD=false
RUN_BENCHMARKS=true
GENERATE_REPORT=true
CLEANUP_AFTER=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-download)
            SKIP_DOWNLOAD=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --no-benchmarks)
            RUN_BENCHMARKS=false
            shift
            ;;
        --no-report)
            GENERATE_REPORT=false
            shift
            ;;
        --cleanup)
            CLEANUP_AFTER=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --skip-download    Skip downloading GitHub projects"
            echo "  --skip-build        Skip Docker build"
            echo "  --no-benchmarks    Skip performance benchmarking"
            echo "  --no-report        Skip report generation"
            echo "  --cleanup          Clean up Docker containers after testing"
            echo "  --help, -h         Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            echo -e "${YELLOW}💡 Use --help for available options${NC}"
            exit 1
            ;;
    esac
done

# Function to display banner
display_banner() {
    echo -e "${BLUE}"
    echo "    __  __ _                     _   _                 "
    echo "   |  \/  | __ _ _ __   ___  ___| \ | | ___   _ __ ___  "
    echo "   | |\/| |/ _\` | '_ \ / _ \/ __| \| |/ _ \ | '_ \` _ \\ "
    echo "   | |  | | (_| | | | |  __/ (__| |\ \  / | | | | | | |"
    echo "   |_|  |_|\__,_|_| |_|\___|\___|_||_|_\___|_| |_| |_| |_|"
    echo ""
    echo "   🐳 Docker Testing Pipeline for MCP Server"
    echo "   📊 Real GitHub Projects • 🚀 Performance Testing"
    echo "   📈 Comprehensive Reporting • 🔍 Error Analysis"
    echo -e "${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    echo -e "${CYAN}🔍 Checking prerequisites...${NC}"

    local missing_tools=()

    # Check for required tools
    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    fi

    if ! command -v docker-compose &> /dev/null; then
        missing_tools+=("docker-compose")
    fi

    if ! command -v git &> /dev/null; then
        missing_tools+=("git")
    fi

    if ! command -v curl &> /dev/null; then
        missing_tools+=("curl")
    fi

    if [ ${#missing_tools[@]} -gt 0 ]; then
        echo -e "${RED}❌ Missing required tools: ${missing_tools[*]}${NC}"
        echo -e "${YELLOW}💡 Please install missing tools and try again${NC}"
        exit 1
    fi

    # Check Docker status
    if ! docker info &> /dev/null; then
        echo -e "${RED}❌ Docker daemon is not running${NC}"
        echo -e "${YELLOW}💡 Please start Docker and try again${NC}"
        exit 1
    fi

    # Check available disk space
    local available_space=$(df . | tail -1 | awk '{print $4}')
    local required_space=10485760  # 10GB in KB

    if [ "$available_space" -lt "$required_space" ]; then
        echo -e "${YELLOW}⚠️ Low disk space: $((available_space / 1024 / 1024))GB available${NC}"
        echo -e "${YELLOW}💡 At least 10GB recommended for GitHub projects${NC}"
    fi

    # Check available memory
    if command -v free &> /dev/null; then
        local available_memory=$(free -m | awk 'NR==2{print $7}')
        if [ "$available_memory" -lt 2048 ]; then
            echo -e "${YELLOW}⚠️ Low memory: ${available_memory}MB available${NC}"
            echo -e "${YELLOW}💡 At least 4GB recommended for testing${NC}"
        fi
    fi

    echo -e "${GREEN}   ✅ All prerequisites satisfied${NC}"
}

# Function to download projects
download_projects() {
    if [ "$SKIP_DOWNLOAD" = true ]; then
        echo -e "${YELLOW}⏭️ Skipping project download${NC}"
        return 0
    fi

    echo -e "${CYAN}📥 Downloading GitHub projects...${NC}"

    if [ ! -d "external-test-projects" ] || [ -z "$(ls -A external-test-projects 2>/dev/null)" ]; then
        if ./scripts/download-test-projects.sh; then
            echo -e "${GREEN}   ✅ Projects downloaded successfully${NC}"
        else
            echo -e "${RED}   ❌ Failed to download projects${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}   ✅ Projects already downloaded${NC}"
    fi

    # Analyze downloaded projects
    echo -e "${CYAN}📊 Analyzing downloaded projects...${NC}"
    if ./scripts/analyze-projects.sh; then
        echo -e "${GREEN}   ✅ Project analysis completed${NC}"
    else
        echo -e "${YELLOW}   ⚠️ Project analysis had issues${NC}"
    fi
}

# Function to build Docker environment
build_docker() {
    if [ "$SKIP_BUILD" = true ]; then
        echo -e "${YELLOW}⏭️ Skipping Docker build${NC}"
        return 0
    fi

    echo -e "${CYAN}🐳 Building Docker test environment...${NC}"

    # Check if images need rebuilding
    local images_changed=false
    if [ "Dockerfile.test" -nt ".docker-build-test" ] || [ "docker-compose.test.yml" -nt ".docker-build-test" ]; then
        images_changed=true
    fi

    if [ "$images_changed" = true ] || ! docker images | grep -q "projectara-test-mcp"; then
        echo -e "${YELLOW}   🔨 Building Docker images...${NC}"

        if docker-compose -f docker-compose.test.yml build; then
            echo -e "${GREEN}   ✅ Docker images built successfully${NC}"
            touch .docker-build-test
        else
            echo -e "${RED}   ❌ Failed to build Docker images${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}   ✅ Docker images up to date${NC}"
    fi
}

# Function to start test environment
start_test_environment() {
    echo -e "${CYAN}🚀 Starting test environment...${NC}"

    # Stop any existing containers
    if docker-compose -f docker-compose.test.yml ps -q | grep -q .; then
        echo -e "${YELLOW}   🔄 Stopping existing containers...${NC}"
        docker-compose -f docker-compose.test.yml down
    fi

    # Start new containers
    echo -e "${YELLOW}   🔄 Starting Docker containers...${NC}"
    if docker-compose -f docker-compose.test.yml up -d; then
        echo -e "${GREEN}   ✅ Containers started successfully${NC}"
    else
        echo -e "${RED}   ❌ Failed to start containers${NC}"
        exit 1
    fi

    # Wait for services to be healthy
    echo -e "${CYAN}⏳ Waiting for services to be healthy...${NC}"
    local max_wait=120
    local wait_time=0

    while [ $wait_time -lt $max_wait ]; do
        local healthy_count=$(docker-compose -f docker-compose.test.yml ps --format "table {{.Name}}\t{{.Health}}" | grep -c "healthy" || echo 0)

        if [ "$healthy_count" -ge 2 ]; then
            echo -e "${GREEN}   ✅ Services are healthy ($healthy_count/2)${NC}"
            break
        fi

        echo -ne "${YELLOW}     Waiting... ($((wait_time / 5))/${max_wait})${NC}\r"
        sleep 5
        wait_time=$((wait_time + 5))
    done

    if [ $wait_time -ge $max_wait ]; then
        echo -e "${RED}   ❌ Services failed to become healthy${NC}"
        echo -e "${YELLOW}💡 Check logs: docker-compose -f docker-compose.test.yml logs${NC}"
        exit 1
    fi
}

# Function to index projects
index_projects() {
    echo -e "${CYAN}📊 Indexing projects for MCP testing...${NC}"

    if ./scripts/index-test-projects.sh; then
        echo -e "${GREEN}   ✅ Projects indexed successfully${NC}"
    else
        echo -e "${RED}   ❌ Failed to index projects${NC}"
        echo -e "${YELLOW}💡 Check logs: docker-compose -f docker-compose.test.yml logs test-code-intelligence${NC}"
        exit 1
    fi
}

# Function to run tests
run_tests() {
    echo -e "${CYAN}🧪 Running comprehensive tests...${NC}"

    if ./scripts/test-real-projects.sh; then
        echo -e "${GREEN}   ✅ All tests completed${NC}"
    else
        echo -e "${YELLOW}   ⚠️ Some tests had issues${NC}"
        echo -e "${YELLOW}💡 Check results in test-results/ directory${NC}"
    fi
}

# Function to run benchmarks
run_benchmarks() {
    if [ "$RUN_BENCHMARKS" = false ]; then
        echo -e "${YELLOW}⏭️ Skipping performance benchmarks${NC}"
        return 0
    fi

    echo -e "${CYAN}⚡ Running performance benchmarks...${NC}"

    if ./scripts/benchmark-real-projects.sh; then
        echo -e "${GREEN}   ✅ Benchmarks completed${NC}"
    else
        echo -e "${YELLOW}   ⚠️ Benchmarks had issues${NC}"
    fi
}

# Function to generate report
generate_report() {
    if [ "$GENERATE_REPORT" = false ]; then
        echo -e "${YELLOW}⏭️ Skipping report generation${NC}"
        return 0
    fi

    echo -e "${CYAN}📋 Generating comprehensive report...${NC}"

    if ./scripts/generate-project-report.sh; then
        echo -e "${GREEN}   ✅ Report generated successfully${NC}"

        # Try to open report in browser
        local report_file=$(find test-results/reports -name "*.html" 2>/dev/null | head -1)
        if [ -n "$report_file" ] && command -v open &> /dev/null; then
            echo -e "${CYAN}   🌐 Opening report in browser...${NC}"
            open "$report_file" 2>/dev/null || true
        fi
    else
        echo -e "${YELLOW}   ⚠️ Report generation had issues${NC}"
    fi
}

# Function to display summary
display_summary() {
    echo -e "\n${GREEN}🎉 Docker Testing Pipeline Complete!${NC}"
    echo "====================================="

    echo -e "${CYAN}📊 Pipeline Summary:${NC}"

    # Display test results count
    if [ -d "test-results" ]; then
        local result_files=$(find test-results -name "*.json" -o -name "*.txt" | wc -l)
        echo -e "   📁 Test results: $result_files files"
    fi

    # Display reports
    if [ -d "test-results/reports" ]; then
        local report_count=$(find test-results/reports -name "*.html" | wc -l)
        echo -e "   📊 Reports: $report_count HTML files"
    fi

    # Check for major issues
    local failed_files=0
    if [ -d "test-results" ]; then
        failed_files=$(find test-results -name "*.json" -exec grep -l "error\|Error\|ERROR\|failed" {} \; 2>/dev/null | wc -l)
    fi

    if [ "$failed_files" -gt 0 ]; then
        echo -e "${YELLOW}   ⚠️ $failed_files files contain issues - check logs${NC}"
    else
        echo -e "${GREEN}   ✅ No major issues detected${NC}"
    fi

    echo -e "\n${BLUE}🔗 Useful Links:${NC}"
    echo -e "   🌐 MCP Server: http://localhost:4000"
    echo -e "   🔌 WebSocket: ws://localhost:8080"
    echo -e "   📊 Grafana: http://localhost:4002 (admin/test_admin)"
    echo -e "   📋 Latest Report: $(find test-results/reports -name "*.html" 2>/dev/null | head -1 | xargs basename 2>/dev/null || echo "None")"

    echo -e "\n${YELLOW}💡 Next Steps:${NC}"
    echo -e "   1. Review detailed results in test-results/"
    echo -e "   2. Open HTML report for visual analysis"
    echo -e "   3. Check Grafana for live monitoring"
    echo -e "   4. Run individual scripts for specific tests"
    echo -e "   5. Stop containers when done: docker-compose -f docker-compose.test.yml down"
}

# Function to cleanup
cleanup() {
    if [ "$CLEANUP_AFTER" = true ]; then
        echo -e "\n${CYAN}🧹 Cleaning up test environment...${NC}"

        docker-compose -f docker-compose.test.yml down --volumes --remove-orphans
        echo -e "${GREEN}   ✅ Cleanup completed${NC}"
    else
        echo -e "\n${YELLOW}💡 To cleanup later, run: docker-compose -f docker-compose.test.yml down --volumes${NC}"
    fi
}

# Main execution function
main() {
    # Display banner
    display_banner

    # Set up error handling
    trap cleanup EXIT

    # Execute pipeline steps
    check_prerequisites
    download_projects
    build_docker
    start_test_environment
    index_projects
    run_tests
    run_benchmarks
    generate_report
    display_summary

    # Remove trap so cleanup doesn't run automatically
    trap - EXIT

    echo -e "\n${GREEN}✅ Docker testing pipeline completed successfully!${NC}"
}

# Run main function
main "$@"