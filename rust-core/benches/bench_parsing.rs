/**
 * Performance Benchmarks for Tree-sitter Parsing (T084)
 *
 * Comprehensive benchmark suite for parsing performance across different
 * programming languages and file sizes using Criterion.rs.
 *
 * Benchmarks include:
 * - Single file parsing performance
 * - Batch parsing performance
 * - Memory usage during parsing
 * - Language-specific parsing speeds
 * - Parallel parsing efficiency
 */

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use std::path::Path;
use std::time::Duration;
use tempfile::TempDir;
use walkdir::WalkDir;

// Import modules to benchmark
use codesight_core::parser::TreeSitterParser;
use codesight_core::models::CodeEntity;

/// Generate test code samples of different sizes
fn generate_test_code(language: &str, size_kb: usize) -> String {
    match language {
        "typescript" => {
            let base_function = r#"
function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

interface Point {
    x: number;
    y: number;
    label?: string;
}

class GeometryUtils {
    static midpoint(p1: Point, p2: Point): Point {
        return {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2
        };
    }

    static distance(p1: Point, p2: Point): number {
        return calculateDistance(p1.x, p1.y, p2.x, p2.y);
    }
}
"#;
            repeat_code_to_size(base_function, size_kb)
        }
        "rust" => {
            let base_function = r#"
use std::f64;

fn calculate_distance(x1: f64, y1: f64, x2: f64, y2: f64) -> f64 {
    let dx = x2 - x1;
    let dy = y2 - y1;
    f64::sqrt(dx * dx + dy * dy)
}

#[derive(Debug, Clone)]
pub struct Point {
    pub x: f64,
    pub y: f64,
    pub label: Option<String>,
}

impl Point {
    pub fn new(x: f64, y: f64) -> Self {
        Self { x, y, label: None }
    }

    pub fn with_label(mut self, label: String) -> Self {
        self.label = Some(label);
        self
    }
}

pub struct GeometryUtils;

impl GeometryUtils {
    pub fn midpoint(p1: &Point, p2: &Point) -> Point {
        Point {
            x: (p1.x + p2.x) / 2.0,
            y: (p1.y + p2.y) / 2.0,
            label: None,
        }
    }

    pub fn distance(p1: &Point, p2: &Point) -> f64 {
        calculate_distance(p1.x, p1.y, p2.x, p2.y)
    }
}
"#;
            repeat_code_to_size(base_function, size_kb)
        }
        "python" => {
            let base_function = r#"
import math
from typing import Optional, List, Tuple
from dataclasses import dataclass

def calculate_distance(x1: float, y1: float, x2: float, y2: float) -> float:
    """Calculate Euclidean distance between two points."""
    dx = x2 - x1
    dy = y2 - y1
    return math.sqrt(dx * dx + dy * dy)

@dataclass
class Point:
    """Represents a 2D point with optional label."""
    x: float
    y: float
    label: Optional[str] = None

    def distance_to(self, other: 'Point') -> float:
        """Calculate distance to another point."""
        return calculate_distance(self.x, self.y, other.x, other.y)

class GeometryUtils:
    """Utility class for geometric calculations."""

    @staticmethod
    def midpoint(p1: Point, p2: Point) -> Point:
        """Calculate midpoint between two points."""
        return Point(
            x=(p1.x + p2.x) / 2,
            y=(p1.y + p2.y) / 2
        )

    @staticmethod
    def distance(p1: Point, p2: Point) -> float:
        """Calculate distance between two points."""
        return calculate_distance(p1.x, p1.y, p2.x, p2.y)

    @classmethod
    def polygon_area(cls, points: List[Point]) -> float:
        """Calculate area of polygon using shoelace formula."""
        if len(points) < 3:
            return 0.0
        area = 0.0
        n = len(points)
        for i in range(n):
            j = (i + 1) % n
            area += points[i].x * points[j].y
            area -= points[j].x * points[i].y
        return abs(area) / 2.0
"#;
            repeat_code_to_size(base_function, size_kb)
        }
        _ => "console.log('Hello World');\n".repeat(size_kb * 256),
    }
}

/// Helper function to repeat code to reach target size
fn repeat_code_to_size(base_code: &str, target_size_kb: usize) -> String {
    let target_size_bytes = target_size_kb * 1024;
    let base_size = base_code.len();
    let repetitions = (target_size_bytes + base_size - 1) / base_size;

    let mut result = String::new();
    for i in 0..repetitions {
        result.push_str(&format!("// Chunk {}\n", i));
        result.push_str(base_code);
        result.push('\n');
    }

    // Trim to exact size if needed
    if result.len() > target_size_bytes {
        result.truncate(target_size_bytes);
    }

    result
}

/// Create temporary directory with test files
fn create_test_project(language: &str, file_count: usize, file_size_kb: usize) -> TempDir {
    let temp_dir = TempDir::new().unwrap();

    for i in 0..file_count {
        let file_path = temp_dir.path().join(format!("test_{}.{}", i, match language {
            "typescript" => "ts",
            "rust" => "rs",
            "python" => "py",
            "javascript" => "js",
            _ => "txt",
        }));

        let code = generate_test_code(language, file_size_kb);
        std::fs::write(&file_path, code).unwrap();
    }

    temp_dir
}

/// Benchmark single file parsing performance
fn bench_single_file_parsing(c: &mut Criterion) {
    let mut group = c.benchmark_group("single_file_parsing");
    group.measurement_time(Duration::from_secs(10));
    group.sample_size(100);

    let languages = ["typescript", "rust", "python", "javascript"];
    let file_sizes = [1, 10, 50, 100]; // KB

    for &language in &languages {
        for &size_kb in &file_sizes {
            let code = generate_test_code(language, size_kb);
            group.throughput(Throughput::Bytes(code.len() as u64));

            group.bench_with_input(
                BenchmarkId::new(language, size_kb),
                size_kb,
                |b, _| {
                    b.iter(|| {
                        let parser = TreeSitterParser::new(language).unwrap();
                        let result = parser.parse_string(black_box(&code), "test.ts");
                        black_box(result)
                    });
                },
            );
        }
    }

    group.finish();
}

/// Benchmark batch parsing performance
fn bench_batch_parsing(c: &mut Criterion) {
    let mut group = c.benchmark_group("batch_parsing");
    group.measurement_time(Duration::from_secs(15));
    group.sample_size(50);

    let file_counts = [10, 50, 100, 500];
    let file_size_kb = 5; // Fixed size for batch tests

    for &file_count in &file_counts {
        let temp_dir = create_test_project("typescript", file_count, file_size_kb);
        let total_bytes = file_count * file_size_kb * 1024;

        group.throughput(Throughput::Bytes(total_bytes as u64));

        group.bench_with_input(
            BenchmarkId::new("typescript_batch", file_count),
            file_count,
            |b, _| {
                b.iter(|| {
                    let parser = TreeSitterParser::new("typescript").unwrap();
                    let mut files = Vec::new();

                    for entry in WalkDir::new(temp_dir.path())
                        .into_iter()
                        .filter_map(Result::ok)
                        .filter(|e| e.file_type().is_file())
                    {
                        if let Ok(content) = std::fs::read_to_string(entry.path()) {
                            files.push(content);
                        }
                    }

                    let results: Vec<_> = files
                        .into_iter()
                        .map(|content| parser.parse_string(black_box(&content), entry.path().to_str().unwrap()))
                        .collect();

                    black_box(results)
                });
            },
        );
    }

    group.finish();
}

/// Benchmark memory usage during parsing
fn bench_memory_usage(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_usage");
    group.measurement_time(Duration::from_secs(5));
    group.sample_size(20);

    let code_sizes = [10, 50, 100, 500]; // KB
    let language = "typescript";

    for &size_kb in &code_sizes {
        let code = generate_test_code(language, size_kb);
        let bytes = code.len() as u64;

        group.throughput(Throughput::Bytes(bytes));

        group.bench_with_input(
            BenchmarkId::new("parse_and_extract", size_kb),
            size_kb,
            |b, _| {
                b.iter(|| {
                    let parser = TreeSitterParser::new(language).unwrap();
                    let result = parser.parse_string(black_box(&code), "test.ts");

                    // Simulate entity extraction (memory intensive operation)
                    let entities: Vec<CodeEntity> = if let Ok(tree) = result {
                        // Mock entity extraction - in real implementation this would traverse the AST
                        let entity_count = code.len() / 100; // Estimate based on code size
                        (0..entity_count).map(|i| CodeEntity {
                            id: format!("entity_{}", i),
                            name: format!("function_{}", i),
                            kind: "function".to_string(),
                            start_byte: i * 100,
                            end_byte: (i + 1) * 100,
                            start_point: (i as u32, 0),
                            end_point: ((i + 1) as u32, 0),
                            children: Vec::new(),
                        }).collect()
                    } else {
                        Vec::new()
                    };

                    black_box(entities)
                });
            },
        );
    }

    group.finish();
}

/// Benchmark parallel parsing efficiency
fn bench_parallel_parsing(c: &mut Criterion) {
    let mut group = c.benchmark_group("parallel_parsing");
    group.measurement_time(Duration::from_secs(10));
    group.sample_size(30);

    let file_count = 100;
    let file_size_kb = 10;
    let temp_dir = create_test_project("typescript", file_count, file_size_kb);

    // Collect file paths once
    let file_paths: Vec<_> = WalkDir::new(temp_dir.path())
        .into_iter()
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_file())
        .collect();

    let file_contents: Vec<_> = file_paths
        .iter()
        .filter_map(|path| std::fs::read_to_string(path.path()).ok())
        .collect();

    // Sequential parsing baseline
    group.bench_function("sequential", |b| {
        b.iter(|| {
            let parser = TreeSitterParser::new("typescript").unwrap();
            let results: Vec<_> = file_contents
                .iter()
                .map(|content| parser.parse_string(black_box(content), "test.ts"))
                .collect();
            black_box(results)
        });
    });

    // Parallel parsing with rayon
    group.bench_function("parallel_rayon", |b| {
        use rayon::prelude::*;

        b.iter(|| {
            let parser = TreeSitterParser::new("typescript").unwrap();
            let results: Vec<_> = file_contents
                .par_iter()
                .map(|content| parser.parse_string(black_box(content), "test.ts"))
                .collect();
            black_box(results)
        });
    });

    // Multi-threaded parsing with thread pool
    group.bench_function("thread_pool", |b| {
        use std::sync::Arc;
        use std::thread;

        b.iter(|| {
            let parser = Arc::new(TreeSitterParser::new("typescript").unwrap());
            let file_contents = Arc::new(file_contents.clone());
            let thread_count = num_cpus::get();

            let mut handles = Vec::new();
            let chunk_size = (file_contents.len() + thread_count - 1) / thread_count;

            for i in 0..thread_count {
                let parser = Arc::clone(&parser);
                let file_contents = Arc::clone(&file_contents);

                let handle = thread::spawn(move || {
                    let start = i * chunk_size;
                    let end = std::cmp::min(start + chunk_size, file_contents.len());

                    let mut local_results = Vec::new();
                    for content in &file_contents[start..end] {
                        local_results.push(parser.parse_string(black_box(content), "test.ts"));
                    }
                    local_results
                });

                handles.push(handle);
            }

            let mut all_results = Vec::new();
            for handle in handles {
                all_results.extend(handle.join().unwrap());
            }

            black_box(all_results)
        });
    });

    group.finish();
}

/// Benchmark error handling performance
fn bench_error_handling(c: &mut Criterion) {
    let mut group = c.benchmark_group("error_handling");
    group.measurement_time(Duration::from_secs(5));
    group.sample_size(100);

    // Valid code
    let valid_code = generate_test_code("typescript", 10);

    // Invalid code samples
    let syntax_error_code = r#"
function test() {
    if (true {
        console.log("missing closing parenthesis");
    }
}
"#;

    let large_invalid_code = format!("{}{}",
        "x = ".repeat(10000),
        syntax_error_code
    );

    group.bench_function("valid_code", |b| {
        b.iter(|| {
            let parser = TreeSitterParser::new("typescript").unwrap();
            let result = parser.parse_string(black_box(&valid_code), "valid.ts");
            black_box(result)
        });
    });

    group.bench_function("syntax_error", |b| {
        b.iter(|| {
            let parser = TreeSitterParser::new("typescript").unwrap();
            let result = parser.parse_string(black_box(syntax_error_code), "error.ts");
            black_box(result)
        });
    });

    group.bench_function("large_invalid", |b| {
        b.iter(|| {
            let parser = TreeSitterParser::new("typescript").unwrap();
            let result = parser.parse_string(black_box(&large_invalid_code), "large_error.ts");
            black_box(result)
        });
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_single_file_parsing,
    bench_batch_parsing,
    bench_memory_usage,
    bench_parallel_parsing,
    bench_error_handling
);
criterion_main!(benches);