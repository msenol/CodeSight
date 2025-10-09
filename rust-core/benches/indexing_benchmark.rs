use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use code_intelligence_core::indexer::Indexer;
use code_intelligence_core::models::Codebase;
use std::time::Duration;
use tokio::runtime::Runtime;
use std::path::PathBuf;
use tempfile::TempDir;

/// Benchmark indexing performance for different file sizes
fn bench_file_indexing(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let mut group = c.benchmark_group("file_indexing");
    group.measurement_time(Duration::from_secs(30));
    group.sample_size(20);

    // Test different file sizes (lines of code)
    let file_sizes = vec![100, 500, 1000, 5000, 10000];

    for size in file_sizes {
        group.bench_with_input(
            BenchmarkId::new(format!("{}_lines", size), "single_file"),
            &size,
            |b, &size| {
                b.to_async(&rt).iter(|| async {
                    let indexer = Indexer::new().await;
                    let temp_dir = TempDir::new().unwrap();
                    let test_file = create_test_file(&temp_dir, size);

                    let _result = indexer.index_file(black_box(&test_file)).await;
                });
            },
        );
    }

    group.finish();
}

/// Benchmark batch indexing performance
fn bench_batch_indexing(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let mut group = c.benchmark_group("batch_indexing");
    group.measurement_time(Duration::from_secs(60));
    group.sample_size(10);

    // Test different batch sizes
    let batch_sizes = vec![10, 50, 100, 500];

    for batch_size in batch_sizes {
        group.bench_with_input(
            BenchmarkId::new(format!("{}_files", batch_size), "batch"),
            &batch_size,
            |b, &batch_size| {
                b.to_async(&rt).iter(|| async {
                    let indexer = Indexer::new().await;
                    let temp_dir = TempDir::new().unwrap();
                    let test_files = create_test_files_batch(&temp_dir, batch_size);

                    let start_time = std::time::Instant::now();
                    let _results = indexer.index_files(black_box(test_files)).await;
                    let duration = start_time.elapsed();

                    // Ensure we're actually measuring the work
                    black_box(duration);
                });
            },
        );
    }

    group.finish();
}

/// Benchmark incremental indexing performance
fn bench_incremental_indexing(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let mut group = c.benchmark_group("incremental_indexing");
    group.measurement_time(Duration::from_secs(45));
    group.sample_size(15);

    // Test incremental updates
    let scenarios = vec![
        ("small_change", 10, 1),    // 10 files, 1 changed
        ("medium_change", 100, 10), // 100 files, 10 changed
        ("large_change", 1000, 100), // 1000 files, 100 changed
    ];

    for (name, total_files, changed_files) in scenarios {
        group.bench_with_input(
            BenchmarkId::new(name, "incremental"),
            &(total_files, changed_files),
            |b, &(total_files, changed_files)| {
                b.to_async(&rt).iter(|| async {
                    let indexer = Indexer::new().await;
                    let temp_dir = TempDir::new().unwrap();

                    // Initial indexing
                    let initial_files = create_test_files_batch(&temp_dir, total_files);
                    let _initial_result = indexer.index_files(initial_files.clone()).await;

                    // Simulate some time passing
                    tokio::time::sleep(Duration::from_millis(100)).await;

                    // Incremental indexing - modify some files
                    let modified_files = initial_files
                        .into_iter()
                        .take(changed_files)
                        .collect();

                    let _incremental_result = indexer.index_files(black_box(modified_files)).await;
                });
            },
        );
    }

    group.finish();
}

/// Benchmark different language parsing performance
fn bench_language_parsing(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let mut group = c.benchmark_group("language_parsing");
    group.measurement_time(Duration::from_secs(20));
    group.sample_size(30);

    let languages = vec![
        ("rust", "rs"),
        ("typescript", "ts"),
        ("javascript", "js"),
        ("python", "py"),
        ("go", "go"),
    ];

    for (language, extension) in languages {
        group.bench_with_input(
            BenchmarkId::new(language, "parse_language"),
            &extension,
            |b, extension| {
                b.to_async(&rt).iter(|| async {
                    let indexer = Indexer::new().await;
                    let temp_dir = TempDir::new().unwrap();
                    let test_file = create_language_specific_file(&temp_dir, extension, 1000);

                    let _result = indexer.index_file(black_box(&test_file)).await;
                });
            },
        );
    }

    group.finish();
}

/// Benchmark memory usage during indexing
fn bench_memory_indexing(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let mut group = c.benchmark_group("memory_indexing");
    group.measurement_time(Duration::from_secs(30));
    group.sample_size(10);

    // Test memory usage patterns
    let memory_scenarios = vec![
        ("low_memory", 100, 50),     // Small files, low parallelism
        ("medium_memory", 500, 100), // Medium files, medium parallelism
        ("high_memory", 1000, 200),  // Large files, high parallelism
    ];

    for (name, file_count, parallelism) in memory_scenarios {
        group.bench_with_input(
            BenchmarkId::new(name, "memory_usage"),
            &(file_count, parallelism),
            |b, &(file_count, parallelism)| {
                b.to_async(&rt).iter(|| async {
                    let indexer = Indexer::new().await;
                    let temp_dir = TempDir::new().unwrap();
                    let test_files = create_test_files_batch(&temp_dir, file_count);

                    // Configure indexer for memory test
                    indexer.set_parallelism(black_box(parallelism));

                    let _results = indexer.index_files(black_box(test_files)).await;
                });
            },
        );
    }

    group.finish();
}

/// Helper function to create a test file with specified size
fn create_test_file(temp_dir: &TempDir, line_count: usize) -> PathBuf {
    let file_path = temp_dir.path().join("test_file.rs");
    let mut content = String::new();

    content.push_str("// Auto-generated test file for benchmarking\n");
    content.push_str("use std::collections::{HashMap, HashSet};\n");
    content.push_str("use serde::{Deserialize, Serialize};\n\n");

    for i in 0..line_count {
        content.push_str(&format!(
            r#"
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestStruct{i} {{
    pub id: usize,
    pub name: String,
    pub data: HashMap<String, Vec<i32>>,
    pub flags: HashSet<String>,
}}

impl TestStruct{i} {{
    pub fn new(id: usize, name: String) -> Self {{
        Self {{
            id,
            name,
            data: HashMap::new(),
            flags: HashSet::new(),
        }}
    }}

    pub fn process(&self) -> Result<Vec<String>, Box<dyn std::error::Error>> {{
        let mut results = Vec::new();
        for (key, values) in &self.data {{
            results.push(format!("{{}}: {{:?}}", key, values));
        }}
        Ok(results)
    }}
}}

pub fn function_{i}(input: TestStruct{i}) -> Result<String, Box<dyn std::error::Error>> {{
    let processed = input.process()?;
    Ok(format!("Processed {{}} items", processed.len()))
}}

#[cfg(test)]
mod tests_{i} {{
    use super::*;

    #[test]
    fn test_struct_{i}() {{
        let test_struct = TestStruct{i}::new({i}, "test_{i}".to_string());
        assert!(test_struct.process().is_ok());
    }}
}}
"#
        ));
    }

    std::fs::write(&file_path, content).unwrap();
    file_path
}

/// Helper function to create multiple test files
fn create_test_files_batch(temp_dir: &TempDir, file_count: usize) -> Vec<PathBuf> {
    (0..file_count)
        .map(|i| {
            let file_path = temp_dir.path().join(format!("test_file_{}.rs", i));
            let content = format!(
                r#"
// Test file {i}
pub mod module_{i} {{
    pub struct TestStruct {{
        value: i32,
    }}

    pub fn test_function_{i}() -> i32 {{
        {i}
    }}
}}
"#
            );
            std::fs::write(&file_path, content).unwrap();
            file_path
        })
        .collect()
}

/// Helper function to create language-specific test files
fn create_language_specific_file(temp_dir: &TempDir, extension: &str, line_count: usize) -> PathBuf {
    let file_path = temp_dir.path().join(format!("test_file.{}", extension));
    let mut content = String::new();

    match extension {
        "rs" => {
            content.push_str("use std::collections::HashMap;\n\n");
            for i in 0..line_count {
                content.push_str(&format!("pub fn rust_function_{}() -> i32 {{ {} }}\n", i, i));
            }
        }
        "ts" => {
            content.push_str("import {{ Map }} from 'typescript';\n\n");
            for i in 0..line_count {
                content.push_str(&format!("export function tsFunction_{}(): number {{ return {}; }}\n", i, i));
            }
        }
        "js" => {
            for i in 0..line_count {
                content.push_str(&format!("function jsFunction_{}() {{ return {}; }}\n", i, i));
            }
        }
        "py" => {
            for i in 0..line_count {
                content.push_str(&format!("def py_function_{}():\n    return {}\n\n", i, i));
            }
        }
        "go" => {
            for i in 0..line_count {
                content.push_str(&format!("func goFunction{}() int {{ return {} }}\n", i, i));
            }
        }
        _ => {
            // Default to simple content
            for i in 0..line_count {
                content.push_str(&format!("Line {} content\n", i));
            }
        }
    }

    std::fs::write(&file_path, content).unwrap();
    file_path
}

criterion_group!(
    benches,
    bench_file_indexing,
    bench_batch_indexing,
    bench_incremental_indexing,
    bench_language_parsing,
    bench_memory_indexing
);

criterion_main!(benches);