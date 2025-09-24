#!/bin/bash

# Code Intelligence MCP Server Load Testing Script
# This script runs comprehensive load tests using k6

set -e

# Configuration
BASE_URL=${BASE_URL:-"http://localhost:4000"}
OUTPUT_DIR=${OUTPUT_DIR:-"./load_test_results"}
K6_VERSION=${K6_VERSION:-"latest"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Code Intelligence MCP Server Load Testing${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}Error: k6 is not installed${NC}"
    echo "Please install k6 from https://k6.io/docs/getting-started/installation/"
    echo "Or run: brew install k6 (on macOS)"
    exit 1
fi

# Check if server is running
echo -e "${YELLOW}Checking if server is running at ${BASE_URL}...${NC}"
if ! curl -s "${BASE_URL}/api/health" > /dev/null; then
    echo -e "${RED}Error: Server is not running at ${BASE_URL}${NC}"
    echo "Please start the Code Intelligence MCP Server first"
    exit 1
fi

echo -e "${GREEN}✓ Server is running${NC}"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Function to run a load test
run_test() {
    local test_name=$1
    local test_file=$2
    local description=$3
    
    echo -e "${BLUE}Running ${test_name}...${NC}"
    echo -e "${YELLOW}Description: ${description}${NC}"
    
    local output_file="${OUTPUT_DIR}/${test_name}_$(date +%Y%m%d_%H%M%S)"
    
    k6 run \
        --out json="${output_file}.json" \
        --out html="${output_file}.html" \
        -e BASE_URL="$BASE_URL" \
        "$test_file"
    
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓ ${test_name} completed successfully${NC}"
    else
        echo -e "${RED}✗ ${test_name} failed with exit code ${exit_code}${NC}"
    fi
    
    echo ""
    return $exit_code
}

# Function to display test menu
show_menu() {
    echo -e "${BLUE}Available Load Tests:${NC}"
    echo "1. API Load Test - General API endpoint testing"
    echo "2. MCP Load Test - MCP protocol specific testing"
    echo "3. Performance Test - Comprehensive performance analysis"
    echo "4. Quick Test - Fast smoke test"
    echo "5. Full Suite - Run all tests"
    echo "6. Custom Test - Run with custom parameters"
    echo "0. Exit"
    echo ""
}

# Function to run quick test
run_quick_test() {
    echo -e "${YELLOW}Running quick smoke test...${NC}"
    
    k6 run \
        --vus 2 \
        --duration 30s \
        -e BASE_URL="$BASE_URL" \
        api_load_test.js
}

# Function to run full suite
run_full_suite() {
    echo -e "${BLUE}Running full test suite...${NC}"
    echo "This may take 30-45 minutes to complete."
    echo ""
    
    local failed_tests=0
    
    # API Load Test
    run_test "api_load_test" "api_load_test.js" "General API endpoint load testing"
    if [ $? -ne 0 ]; then ((failed_tests++)); fi
    
    # MCP Load Test
    run_test "mcp_load_test" "mcp_load_test.js" "MCP protocol specific load testing"
    if [ $? -ne 0 ]; then ((failed_tests++)); fi
    
    # Performance Test
    run_test "performance_test" "performance_test.js" "Comprehensive performance analysis"
    if [ $? -ne 0 ]; then ((failed_tests++)); fi
    
    echo -e "${BLUE}Full Suite Results:${NC}"
    if [ $failed_tests -eq 0 ]; then
        echo -e "${GREEN}✓ All tests passed successfully${NC}"
    else
        echo -e "${RED}✗ ${failed_tests} test(s) failed${NC}"
    fi
    
    return $failed_tests
}

# Function to run custom test
run_custom_test() {
    echo -e "${YELLOW}Custom Test Configuration${NC}"
    
    read -p "Enter test file (api_load_test.js, mcp_load_test.js, performance_test.js): " test_file
    read -p "Enter number of virtual users (default: 10): " vus
    read -p "Enter test duration (default: 2m): " duration
    
    vus=${vus:-10}
    duration=${duration:-"2m"}
    
    if [ ! -f "$test_file" ]; then
        echo -e "${RED}Error: Test file '$test_file' not found${NC}"
        return 1
    fi
    
    echo -e "${BLUE}Running custom test with ${vus} VUs for ${duration}...${NC}"
    
    k6 run \
        --vus "$vus" \
        --duration "$duration" \
        --out json="${OUTPUT_DIR}/custom_test_$(date +%Y%m%d_%H%M%S).json" \
        -e BASE_URL="$BASE_URL" \
        "$test_file"
}

# Function to generate summary report
generate_summary() {
    echo -e "${BLUE}Generating Test Summary...${NC}"
    
    local summary_file="${OUTPUT_DIR}/test_summary_$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$summary_file" << EOF
# Load Test Summary

**Date:** $(date)
**Server:** $BASE_URL
**Test Results Directory:** $OUTPUT_DIR

## Test Files Generated

EOF
    
    find "$OUTPUT_DIR" -name "*.json" -o -name "*.html" | sort >> "$summary_file"
    
    echo ""
    echo "## Performance Thresholds"
    echo ""
    echo "- API Response Time: p(95) < 500ms"
    echo "- MCP Tool Execution: p(95) < 2000ms"
    echo "- Error Rate: < 1%"
    echo "- Indexing Performance:"
    echo "  - Small codebases (<1K files): < 5 seconds"
    echo "  - Medium codebases (1K-10K files): < 30 seconds"
    echo "  - Large codebases (10K-100K files): < 5 minutes"
    echo ""
    echo "## Notes"
    echo ""
    echo "- All tests were run against a local development server"
    echo "- Results may vary based on system resources and network conditions"
    echo "- For production load testing, use dedicated test environment"
    
    } >> "$summary_file"
    
    echo -e "${GREEN}Summary report generated: ${summary_file}${NC}"
}

# Main execution
if [ $# -eq 0 ]; then
    # Interactive mode
    while true; do
        show_menu
        read -p "Select an option (0-6): " choice
        
        case $choice in
            1)
                run_test "api_load_test" "api_load_test.js" "General API endpoint load testing"
                ;;
            2)
                run_test "mcp_load_test" "mcp_load_test.js" "MCP protocol specific load testing"
                ;;
            3)
                run_test "performance_test" "performance_test.js" "Comprehensive performance analysis"
                ;;
            4)
                run_quick_test
                ;;
            5)
                run_full_suite
                generate_summary
                ;;
            6)
                run_custom_test
                ;;
            0)
                echo -e "${BLUE}Exiting...${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid option. Please try again.${NC}"
                ;;
        esac
        
        echo ""
        read -p "Press Enter to continue..."
        clear
    done
else
    # Command line mode
    case $1 in
        "api")
            run_test "api_load_test" "api_load_test.js" "General API endpoint load testing"
            ;;
        "mcp")
            run_test "mcp_load_test" "mcp_load_test.js" "MCP protocol specific load testing"
            ;;
        "performance")
            run_test "performance_test" "performance_test.js" "Comprehensive performance analysis"
            ;;
        "quick")
            run_quick_test
            ;;
        "full")
            run_full_suite
            generate_summary
            ;;
        "help")
            echo "Usage: $0 [api|mcp|performance|quick|full|help]"
            echo ""
            echo "Commands:"
            echo "  api         - Run API load test"
            echo "  mcp         - Run MCP protocol test"
            echo "  performance - Run performance analysis"
            echo "  quick       - Run quick smoke test"
            echo "  full        - Run all tests"
            echo "  help        - Show this help"
            echo ""
            echo "Environment Variables:"
            echo "  BASE_URL    - Server URL (default: http://localhost:4000)"
            echo "  OUTPUT_DIR  - Results directory (default: ./load_test_results)"
            ;;
        *)
            echo -e "${RED}Unknown command: $1${NC}"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
fi

echo -e "${GREEN}Load testing completed!${NC}"
echo -e "${BLUE}Results saved to: ${OUTPUT_DIR}${NC}"