use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use code_intelligence_core::indexer::Indexer;
use code_intelligence_core::search::SearchEngine;
use code_intelligence_core::models::{Codebase, CodeEntity};
use std::time::Duration;
use tokio::runtime::Runtime;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

/// Memory usage tracking for indexing operations
fn bench_memory_indexing(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let mut group = c.benchmark_group("memory_indexing");
    group.measurement_time(Duration::from_secs(30));
    group.sample_size(20);
    group.throughput(Throughput::Bytes(std::mem::size_of::<CodeEntity>() as u64));

    // Test memory usage with different entity counts
    let entity_counts = vec![1000, 5000, 10000, 25000, 50000];

    for count in entity_counts {
        group.bench_with_input(
            BenchmarkId::new(format!("{}_entities", count), "indexing_memory"),
            &count,
            |b, &entity_count| {
                b.to_async(&rt).iter(|| async {
                    let indexer = Indexer::new().await;
                    let entities = create_entities(entity_count);

                    let start_memory = get_memory_usage();

                    let _results = indexer.index_entities(black_box(entities)).await;

                    let end_memory = get_memory_usage();
                    let memory_used = end_memory - start_memory;

                    // Ensure memory measurement is not optimized away
                    black_box(memory_used);
                });
            },
        );
    }

    group.finish();
}

/// Memory usage tracking for search operations
fn bench_memory_searching(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let mut group = c.benchmark_group("memory_searching");
    group.measurement_time(Duration::from_secs(20));
    group.sample_size(50);

    // Test memory usage with different result set sizes
    let result_sizes = vec![10, 50, 100, 500, 1000];

    for size in result_sizes {
        group.bench_with_input(
            BenchmarkId::new(format!("{}_results", size), "search_memory"),
            &size,
            |b, &result_size| {
                b.to_async(&rt).iter(|| async {
                    let search_engine = SearchEngine::new().await;
                    let codebase = create_large_codebase(50000);

                    let start_memory = get_memory_usage();

                    let _results = search_engine.search(
                        "*".to_string(),
                        &codebase,
                        black_box(result_size),
                    ).await;

                    let end_memory = get_memory_usage();
                    let memory_used = end_memory - start_memory;

                    black_box(memory_used);
                });
            },
        );
    }

    group.finish();
}

/// Concurrent operations memory usage
fn bench_concurrent_memory(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let mut group = c.benchmark_group("concurrent_memory");
    group.measurement_time(Duration::from_secs(45));
    group.sample_size(10);

    let concurrency_levels = vec![1, 2, 4, 8, 16];

    for level in concurrency_levels {
        group.bench_with_input(
            BenchmarkId::new(format!("{}_threads", level), "concurrent_operations"),
            &level,
            |b, &concurrency| {
                b.to_async(&rt).iter(|| async {
                    let search_engine = Arc::new(SearchEngine::new().await);
                    let codebase = Arc::new(create_large_codebase(10000));

                    let start_memory = get_memory_usage();
                    let operation_count = Arc::new(AtomicUsize::new(0));

                    let handles: Vec<_> = (0..concurrency)
                        .map(|_| {
                            let engine = search_engine.clone();
                            let cb = codebase.clone();
                            let counter = operation_count.clone();

                            tokio::spawn(async move {
                                for _ in 0..10 {
                                    let _result = engine.search("test".to_string(), &cb.as_ref(), 100).await;
                                    counter.fetch_add(1, Ordering::Relaxed);
                                }
                            })
                        })
                        .collect();

                    // Wait for all operations to complete
                    for handle in handles {
                        let _ = handle.await;
                    }

                    let end_memory = get_memory_usage();
                    let memory_used = end_memory - start_memory;
                    let total_operations = operation_count.load(Ordering::Relaxed);

                    black_box((memory_used, total_operations));
                });
            },
        );
    }

    group.finish();
}

/// Memory leak detection test
fn bench_memory_leak_detection(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let mut group = c.benchmark_group("memory_leak_detection");
    group.measurement_time(Duration::from_secs(60));
    group.sample_size(5);

    group.bench_function("repeated_operations", |b| {
        b.to_async(&rt).iter(|| async {
            let search_engine = SearchEngine::new().await;
            let codebase = create_large_codebase(1000);

            let initial_memory = get_memory_usage();

            // Perform many operations to detect memory leaks
            for i in 0..1000 {
                let _results = search_engine.search(
                    format!("test_query_{}", i % 10),
                    &codebase,
                    10,
                ).await;

                // Periodically check memory usage
                if i % 100 == 0 {
                    let current_memory = get_memory_usage();
                    let memory_growth = current_memory - initial_memory;

                    // Log memory growth for debugging
                    if i % 200 == 0 {
                        eprintln!("Iteration {}: Memory growth = {} MB", i, memory_growth / 1024 / 1024);
                    }

                    black_box(memory_growth);
                }
            }

            let final_memory = get_memory_usage();
            let total_growth = final_memory - initial_memory;

            black_box(total_growth);
        });
    });

    group.finish();
}

/// Memory pressure test
fn bench_memory_pressure(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let mut group = c.benchmark_group("memory_pressure");
    group.measurement_time(Duration::from_secs(30));
    group.sample_size(15);

    // Test under different memory pressure scenarios
    let pressure_levels = vec![
        ("low_pressure", 1000),
        ("medium_pressure", 10000),
        ("high_pressure", 50000),
        ("extreme_pressure", 100000),
    ];

    for (name, entity_count) in pressure_levels {
        group.bench_with_input(
            BenchmarkId::new(name, "pressure_test"),
            &entity_count,
            |b, &entity_count| {
                b.to_async(&rt).iter(|| async {
                    let search_engine = SearchEngine::new().await;
                    let codebase = create_large_codebase(entity_count);

                    // Simulate memory pressure by holding large result sets
                    let start_memory = get_memory_usage();

                    let _results = search_engine.search(
                        "*".to_string(),
                        &codebase,
                        1000, // Large result set
                    ).await;

                    // Simulate processing while holding results
                    tokio::time::sleep(Duration::from_millis(100)).await;

                    let end_memory = get_memory_usage();
                    let memory_used = end_memory - start_memory;

                    black_box(memory_used);
                });
            },
        );
    }

    group.finish();
}

/// Helper functions for memory benchmarking

fn create_entities(count: usize) -> Vec<CodeEntity> {
    (0..count)
        .map(|i| CodeEntity {
            id: uuid::Uuid::new_v4(),
            codebase_id: uuid::Uuid::new_v4(),
            entity_type: match i % 5 {
                0 => code_intelligence_core::models::EntityType::Function,
                1 => code_intelligence_core::models::EntityType::Class,
                2 => code_intelligence_core::models::EntityType::Method,
                3 => code_intelligence_core::models::EntityType::Variable,
                _ => code_intelligence_core::models::EntityType::Interface,
            },
            name: format!("entity_{}", i),
            qualified_name: format!("module_{}::entity_{}", i % 10, i),
            file_path: format!("src/module_{}/file.rs", i % 10),
            start_line: (i % 100) + 1,
            end_line: (i % 100) + 10,
            start_column: 1,
            end_column: 50,
            language: "rust".to_string(),
            signature: Some(format!("fn entity_{}()", i)),
            visibility: code_intelligence_core::models::Visibility::Public,
            documentation: Some(format!("Documentation for entity {}", i)),
            ast_hash: format!("hash_{}", i),
            embedding_id: Some(uuid::Uuid::new_v4()),
        })
        .collect()
}

fn create_large_codebase(entity_count: usize) -> Codebase {
    let mut codebase = Codebase::new(
        "large-test-codebase".to_string(),
        "/tmp/large_test".to_string(),
    );

    codebase.size_bytes = (entity_count * 500) as u64; // Estimated size
    codebase.file_count = (entity_count / 10).max(1);

    codebase
}

/// Get current memory usage (platform-specific)
fn get_memory_usage() -> usize {
    #[cfg(target_os = "linux")]
    {
        use std::fs;
        if let Ok(status) = fs::read_to_string("/proc/self/status") {
            for line in status.lines() {
                if line.starts_with("VmRSS:") {
                    if let Some(kb_str) = line.split_whitespace().nth(1) {
                        if let Ok(kb) = kb_str.parse::<usize>() {
                            return kb * 1024; // Convert KB to bytes
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        if let Ok(output) = Command::new("ps")
            .args(&["-o", "rss=", "-p"])
            .arg(&format!("{}", std::process::id()))
            .output()
        {
            if let Ok(rss_str) = String::from_utf8(output.stdout).trim().parse::<usize>() {
                return rss_str * 1024; // Convert KB to bytes
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        if let Ok(output) = Command::new("wmic")
            .args(&["process", "where", "processid=", std::process::id().to_string()])
            .args(&["get", "WorkingSetSize"])
            .output()
        {
            if let Ok(output_str) = String::from_utf8(output.stdout) {
                if let Some(bytes_str) = output_str.lines().nth(1) {
                    if let Ok(bytes) = bytes_str.trim().parse::<usize>() {
                        return bytes;
                    }
                }
            }
        }
    }

    // Fallback: return 0 if we can't get memory usage
    0
}

criterion_group!(
    memory_benches,
    bench_memory_indexing,
    bench_memory_searching,
    bench_concurrent_memory,
    bench_memory_leak_detection,
    bench_memory_pressure
);

criterion_main!(memory_benches);