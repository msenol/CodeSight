use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use code_intelligence_core::search::SearchEngine;
use code_intelligence_core::models::{Codebase, CodeEntity};
use std::time::Duration;
use tokio::runtime::Runtime;

/// Benchmark search performance across different query complexities
fn bench_search_performance(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    // Setup test data
    let (search_engine, test_codebase) = rt.block_on(async {
        let search_engine = SearchEngine::new().await;
        let mut codebase = Codebase::new(
            "benchmark-project".to_string(),
            "/tmp/benchmark".to_string(),
        );

        // Create test entities for benchmarking
        for i in 0..1000 {
            let entity = CodeEntity {
                id: uuid::Uuid::new_v4(),
                codebase_id: codebase.id,
                entity_type: code_intelligence_core::models::EntityType::Function,
                name: format!("function_{}", i),
                qualified_name: format!("benchmark_project::module_{}::function_{}", i % 10, i),
                file_path: format!("src/module_{}/file.rs", i % 10),
                start_line: (i % 100) + 1,
                end_line: (i % 100) + 10,
                start_column: 1,
                end_column: 50,
                language: "rust".to_string(),
                signature: Some(format!("fn function_{}() -> Result<(), Error>", i)),
                visibility: code_intelligence_core::models::Visibility::Public,
                documentation: Some(format!("Documentation for function {}", i)),
                ast_hash: format!("hash_{}", i),
                embedding_id: None,
            };
            // In a real implementation, we would add this to the search index
        }

        (search_engine, codebase)
    });

    let mut group = c.benchmark_group("search_performance");
    group.measurement_time(Duration::from_secs(10));
    group.sample_size(100);

    // Benchmark different query complexities
    let queries = vec![
        ("simple", "function_1"),
        ("medium", "function module_"),
        ("complex", "public function Result Error documentation"),
        ("wildcard", "*"),
        ("regex_like", "function_*"),
    ];

    for (name, query) in queries {
        group.bench_with_input(
            BenchmarkId::new(name, "search_query"),
            query,
            |b, query| {
                b.to_async(&rt).iter(|| async {
                    let _results = search_engine.search(
                        black_box(query.to_string()),
                        black_box(&test_codebase),
                        black_box(10),
                    ).await;
                });
            },
        );
    }

    group.finish();
}

/// Benchmark indexing performance
fn bench_indexing_performance(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let mut group = c.benchmark_group("indexing_performance");
    group.measurement_time(Duration::from_secs(30));
    group.sample_size(20);

    // Test different file counts for indexing
    let file_counts = vec![10, 50, 100, 500, 1000];

    for file_count in file_counts {
        group.bench_with_input(
            BenchmarkId::new(format!("{}_files", file_count), "indexing"),
            &file_count,
            |b, &file_count| {
                b.to_async(&rt).iter(|| async {
                    // Simulate indexing process
                    let search_engine = SearchEngine::new().await;
                    let test_files = generate_test_files(file_count);

                    for file in test_files {
                        let _result = search_engine.index_file(black_box(&file)).await;
                    }
                });
            },
        );
    }

    group.finish();
}

/// Helper function to generate test files for benchmarking
fn generate_test_files(count: usize) -> Vec<String> {
    (0..count)
        .map(|i| {
            format!(
                r#"
// Test file {i}
use std::collections::HashMap;

pub mod module_{i} {{
    pub struct TestStruct {{
        field: i32,
    }}

    pub fn function_{i}() -> Result<TestStruct, Error> {{
        Ok(TestStruct {{ field: {i} }})
    }}

    pub async fn async_function_{i}(input: String) -> Result<String, Error> {{
        Ok(format!("processed: {{}}", input))
    }}

    #[cfg(test)]
    mod tests {{
        use super::*;

        #[test]
        fn test_function_{i}() {{
            let result = function_{i}();
            assert!(result.is_ok());
        }}
    }}
}}
"#
            )
        })
        .collect()
}

/// Benchmark memory usage patterns
fn bench_memory_patterns(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let mut group = c.benchmark_group("memory_patterns");
    group.measurement_time(Duration::from_secs(15));
    group.sample_size(50);

    // Benchmark concurrent search operations
    group.bench_function("concurrent_search", |b| {
        b.to_async(&rt).iter(|| async {
            let search_engine = SearchEngine::new().await;
            let test_codebase = create_test_codebase();

            let handles: Vec<_> = (0..10)
                .map(|_| {
                    let engine = search_engine.clone();
                    let codebase = test_codebase.clone();
                    tokio::spawn(async move {
                        engine.search("test".to_string(), &codebase, 10).await
                    })
                })
                .collect();

            for handle in handles {
                let _ = handle.await;
            }
        });
    });

    // Benchmark large result sets
    group.bench_function("large_result_set", |b| {
        b.to_async(&rt).iter(|| async {
            let search_engine = SearchEngine::new().await;
            let test_codebase = create_large_test_codebase(10000);

            let _results = search_engine.search(
                "*".to_string(),
                &test_codebase,
                1000,
            ).await;
        });
    });

    group.finish();
}

/// Create a test codebase for benchmarking
fn create_test_codebase() -> Codebase {
    Codebase::new(
        "benchmark-project".to_string(),
        "/tmp/benchmark".to_string(),
    )
}

/// Create a large test codebase for memory benchmarks
fn create_large_test_codebase(entity_count: usize) -> Codebase {
    let mut codebase = Codebase::new(
        "large-benchmark-project".to_string(),
        "/tmp/large_benchmark".to_string(),
    );

    // Add metadata about expected entity count
    codebase.size_bytes = (entity_count * 1000) as u64; // Estimated size
    codebase.file_count = (entity_count / 10).max(1); // Estimate 10 entities per file

    codebase
}

criterion_group!(
    benches,
    bench_search_performance,
    bench_indexing_performance,
    bench_memory_patterns
);

criterion_main!(benches);