use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use std::path::PathBuf;
use std::time::Duration;
use tempfile::TempDir;
use tokio::runtime::Runtime;
use uuid::Uuid;

// Import the parallel indexer module
use rust_core::services::parallel_indexer::{
    ParallelIndexer, ParallelIndexerConfig, IndexingTask, TaskPriority, LoadBalancingStrategy
};

fn create_test_files(temp_dir: &TempDir, count: usize, size_bytes: usize) -> Vec<PathBuf> {
    let mut files = Vec::new();
    let content = "x".repeat(size_bytes);
    
    for i in 0..count {
        let file_path = temp_dir.path().join(format!("test_file_{}.txt", i));
        std::fs::write(&file_path, &content).unwrap();
        files.push(file_path);
    }
    
    files
}

fn create_indexing_tasks(file_paths: Vec<PathBuf>, priority: TaskPriority) -> Vec<IndexingTask> {
    file_paths
        .into_iter()
        .map(|path| IndexingTask {
            id: Uuid::new_v4(),
            file_path: path,
            priority,
            estimated_size: 1024,
            created_at: chrono::Utc::now(),
            dependencies: vec![],
        })
        .collect()
}

fn benchmark_worker_scaling(c: &mut Criterion) {
    let mut group = c.benchmark_group("worker_scaling");
    
    let rt = Runtime::new().unwrap();
    
    for worker_count in [1, 2, 4, 8, 16].iter() {
        group.bench_with_input(
            BenchmarkId::new("parallel_indexing", worker_count),
            worker_count,
            |b, &worker_count| {
                b.to_async(&rt).iter(|| async {
                    let temp_dir = TempDir::new().unwrap();
                    let files = create_test_files(&temp_dir, 100, 1024);
                    let tasks = create_indexing_tasks(files, TaskPriority::Normal);
                    
                    let config = ParallelIndexerConfig {
                        max_workers: worker_count,
                        min_workers: worker_count,
                        queue_capacity: 1000,
                        auto_scaling: false,
                        ..Default::default()
                    };
                    
                    let mut indexer = ParallelIndexer::new(config).unwrap();
                    indexer.start().await.unwrap();
                    
                    let start_time = std::time::Instant::now();
                    
                    for task in tasks {
                        indexer.submit_task(task).await.unwrap();
                    }
                    
                    // Wait for all tasks to complete
                    loop {
                        let (high, normal, low) = indexer.get_queue_status();
                        if high + normal + low == 0 {
                            break;
                        }
                        tokio::time::sleep(Duration::from_millis(10)).await;
                    }
                    
                    let duration = start_time.elapsed();
                    indexer.stop().await.unwrap();
                    
                    black_box(duration)
                })
            },
        );
    }
    
    group.finish();
}

fn benchmark_load_balancing_strategies(c: &mut Criterion) {
    let mut group = c.benchmark_group("load_balancing");
    
    let rt = Runtime::new().unwrap();
    let strategies = [
        LoadBalancingStrategy::RoundRobin,
        LoadBalancingStrategy::LeastLoaded,
        LoadBalancingStrategy::PriorityBased,
        LoadBalancingStrategy::SizeAware,
        LoadBalancingStrategy::Adaptive,
    ];
    
    for strategy in strategies.iter() {
        group.bench_with_input(
            BenchmarkId::new("strategy", format!("{:?}", strategy)),
            strategy,
            |b, &strategy| {
                b.to_async(&rt).iter(|| async {
                    let temp_dir = TempDir::new().unwrap();
                    let files = create_test_files(&temp_dir, 50, 2048);
                    let tasks = create_indexing_tasks(files, TaskPriority::Normal);
                    
                    let config = ParallelIndexerConfig {
                        max_workers: 4,
                        min_workers: 4,
                        load_balancing_strategy: strategy,
                        auto_scaling: false,
                        ..Default::default()
                    };
                    
                    let mut indexer = ParallelIndexer::new(config).unwrap();
                    indexer.start().await.unwrap();
                    
                    for task in tasks {
                        indexer.submit_task(task).await.unwrap();
                    }
                    
                    // Wait for completion
                    loop {
                        let (high, normal, low) = indexer.get_queue_status();
                        if high + normal + low == 0 {
                            break;
                        }
                        tokio::time::sleep(Duration::from_millis(10)).await;
                    }
                    
                    indexer.stop().await.unwrap();
                })
            },
        );
    }
    
    group.finish();
}

fn benchmark_task_priorities(c: &mut Criterion) {
    let mut group = c.benchmark_group("task_priorities");
    
    let rt = Runtime::new().unwrap();
    
    group.bench_function("mixed_priorities", |b| {
        b.to_async(&rt).iter(|| async {
            let temp_dir = TempDir::new().unwrap();
            
            // Create tasks with different priorities
            let high_files = create_test_files(&temp_dir, 10, 512);
            let normal_files = create_test_files(&temp_dir, 30, 1024);
            let low_files = create_test_files(&temp_dir, 20, 2048);
            
            let mut all_tasks = Vec::new();
            all_tasks.extend(create_indexing_tasks(high_files, TaskPriority::High));
            all_tasks.extend(create_indexing_tasks(normal_files, TaskPriority::Normal));
            all_tasks.extend(create_indexing_tasks(low_files, TaskPriority::Low));
            
            let config = ParallelIndexerConfig {
                max_workers: 4,
                min_workers: 4,
                load_balancing_strategy: LoadBalancingStrategy::PriorityBased,
                auto_scaling: false,
                ..Default::default()
            };
            
            let mut indexer = ParallelIndexer::new(config).unwrap();
            indexer.start().await.unwrap();
            
            // Submit tasks in random order
            for task in all_tasks {
                indexer.submit_task(task).await.unwrap();
            }
            
            // Wait for completion
            loop {
                let (high, normal, low) = indexer.get_queue_status();
                if high + normal + low == 0 {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
            
            indexer.stop().await.unwrap();
        })
    });
    
    group.finish();
}

fn benchmark_batch_processing(c: &mut Criterion) {
    let mut group = c.benchmark_group("batch_processing");
    
    let rt = Runtime::new().unwrap();
    
    for batch_size in [1, 10, 50, 100].iter() {
        group.bench_with_input(
            BenchmarkId::new("batch_size", batch_size),
            batch_size,
            |b, &batch_size| {
                b.to_async(&rt).iter(|| async {
                    let temp_dir = TempDir::new().unwrap();
                    let files = create_test_files(&temp_dir, 200, 1024);
                    let tasks = create_indexing_tasks(files, TaskPriority::Normal);
                    
                    let config = ParallelIndexerConfig {
                        max_workers: 4,
                        min_workers: 4,
                        batch_size,
                        auto_scaling: false,
                        ..Default::default()
                    };
                    
                    let mut indexer = ParallelIndexer::new(config).unwrap();
                    indexer.start().await.unwrap();
                    
                    // Submit tasks in batches
                    for chunk in tasks.chunks(batch_size) {
                        indexer.submit_batch(chunk.to_vec()).await.unwrap();
                    }
                    
                    // Wait for completion
                    loop {
                        let (high, normal, low) = indexer.get_queue_status();
                        if high + normal + low == 0 {
                            break;
                        }
                        tokio::time::sleep(Duration::from_millis(10)).await;
                    }
                    
                    indexer.stop().await.unwrap();
                })
            },
        );
    }
    
    group.finish();
}

fn benchmark_file_size_impact(c: &mut Criterion) {
    let mut group = c.benchmark_group("file_size_impact");
    
    let rt = Runtime::new().unwrap();
    let file_sizes = [1024, 10240, 102400, 1048576]; // 1KB, 10KB, 100KB, 1MB
    
    for &file_size in file_sizes.iter() {
        group.bench_with_input(
            BenchmarkId::new("file_size_bytes", file_size),
            &file_size,
            |b, &file_size| {
                b.to_async(&rt).iter(|| async {
                    let temp_dir = TempDir::new().unwrap();
                    let files = create_test_files(&temp_dir, 20, file_size);
                    let tasks = create_indexing_tasks(files, TaskPriority::Normal);
                    
                    let config = ParallelIndexerConfig {
                        max_workers: 4,
                        min_workers: 4,
                        load_balancing_strategy: LoadBalancingStrategy::SizeAware,
                        auto_scaling: false,
                        ..Default::default()
                    };
                    
                    let mut indexer = ParallelIndexer::new(config).unwrap();
                    indexer.start().await.unwrap();
                    
                    for task in tasks {
                        indexer.submit_task(task).await.unwrap();
                    }
                    
                    // Wait for completion
                    loop {
                        let (high, normal, low) = indexer.get_queue_status();
                        if high + normal + low == 0 {
                            break;
                        }
                        tokio::time::sleep(Duration::from_millis(10)).await;
                    }
                    
                    indexer.stop().await.unwrap();
                })
            },
        );
    }
    
    group.finish();
}

fn benchmark_queue_capacity(c: &mut Criterion) {
    let mut group = c.benchmark_group("queue_capacity");
    
    let rt = Runtime::new().unwrap();
    
    for capacity in [100, 1000, 5000, 10000].iter() {
        group.bench_with_input(
            BenchmarkId::new("capacity", capacity),
            capacity,
            |b, &capacity| {
                b.to_async(&rt).iter(|| async {
                    let temp_dir = TempDir::new().unwrap();
                    let files = create_test_files(&temp_dir, 500, 1024);
                    let tasks = create_indexing_tasks(files, TaskPriority::Normal);
                    
                    let config = ParallelIndexerConfig {
                        max_workers: 4,
                        min_workers: 4,
                        queue_capacity: capacity,
                        auto_scaling: false,
                        ..Default::default()
                    };
                    
                    let mut indexer = ParallelIndexer::new(config).unwrap();
                    indexer.start().await.unwrap();
                    
                    // Submit all tasks
                    for task in tasks {
                        indexer.submit_task(task).await.unwrap();
                    }
                    
                    // Wait for completion
                    loop {
                        let (high, normal, low) = indexer.get_queue_status();
                        if high + normal + low == 0 {
                            break;
                        }
                        tokio::time::sleep(Duration::from_millis(10)).await;
                    }
                    
                    indexer.stop().await.unwrap();
                })
            },
        );
    }
    
    group.finish();
}

fn benchmark_dependency_resolution(c: &mut Criterion) {
    let mut group = c.benchmark_group("dependency_resolution");
    
    let rt = Runtime::new().unwrap();
    
    group.bench_function("with_dependencies", |b| {
        b.to_async(&rt).iter(|| async {
            let temp_dir = TempDir::new().unwrap();
            let files = create_test_files(&temp_dir, 50, 1024);
            
            // Create tasks with dependencies
            let mut tasks = Vec::new();
            let mut prev_id = None;
            
            for (i, file_path) in files.into_iter().enumerate() {
                let task_id = Uuid::new_v4();
                let dependencies = if let Some(prev) = prev_id {
                    vec![prev]
                } else {
                    vec![]
                };
                
                tasks.push(IndexingTask {
                    id: task_id,
                    file_path,
                    priority: TaskPriority::Normal,
                    estimated_size: 1024,
                    created_at: chrono::Utc::now(),
                    dependencies,
                });
                
                // Create dependency chain every 5 tasks
                if i % 5 == 0 {
                    prev_id = Some(task_id);
                } else {
                    prev_id = None;
                }
            }
            
            let config = ParallelIndexerConfig {
                max_workers: 4,
                min_workers: 4,
                auto_scaling: false,
                ..Default::default()
            };
            
            let mut indexer = ParallelIndexer::new(config).unwrap();
            indexer.start().await.unwrap();
            
            for task in tasks {
                indexer.submit_task(task).await.unwrap();
            }
            
            // Wait for completion
            loop {
                let (high, normal, low) = indexer.get_queue_status();
                if high + normal + low == 0 {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
            
            indexer.stop().await.unwrap();
        })
    });
    
    group.finish();
}

fn benchmark_workload_optimization(c: &mut Criterion) {
    let mut group = c.benchmark_group("workload_optimization");
    
    let rt = Runtime::new().unwrap();
    
    group.bench_function("optimize_for_small_files", |b| {
        b.to_async(&rt).iter(|| async {
            let temp_dir = TempDir::new().unwrap();
            let files = create_test_files(&temp_dir, 200, 512); // Small files
            let tasks = create_indexing_tasks(files, TaskPriority::Normal);
            
            let mut config = ParallelIndexerConfig::default();
            
            let mut indexer = ParallelIndexer::new(config.clone()).unwrap();
            
            // Optimize for small files
            let file_sizes: Vec<usize> = vec![512; 200];
            let file_types: Vec<String> = vec!["txt".to_string(); 200];
            indexer.optimize_for_workload(&file_sizes, &file_types);
            
            indexer.start().await.unwrap();
            
            for task in tasks {
                indexer.submit_task(task).await.unwrap();
            }
            
            // Wait for completion
            loop {
                let (high, normal, low) = indexer.get_queue_status();
                if high + normal + low == 0 {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
            
            indexer.stop().await.unwrap();
        })
    });
    
    group.bench_function("optimize_for_large_files", |b| {
        b.to_async(&rt).iter(|| async {
            let temp_dir = TempDir::new().unwrap();
            let files = create_test_files(&temp_dir, 20, 1048576); // Large files (1MB)
            let tasks = create_indexing_tasks(files, TaskPriority::Normal);
            
            let config = ParallelIndexerConfig::default();
            let mut indexer = ParallelIndexer::new(config).unwrap();
            
            // Optimize for large files
            let file_sizes: Vec<usize> = vec![1048576; 20];
            let file_types: Vec<String> = vec!["ts".to_string(); 20];
            indexer.optimize_for_workload(&file_sizes, &file_types);
            
            indexer.start().await.unwrap();
            
            for task in tasks {
                indexer.submit_task(task).await.unwrap();
            }
            
            // Wait for completion
            loop {
                let (high, normal, low) = indexer.get_queue_status();
                if high + normal + low == 0 {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
            
            indexer.stop().await.unwrap();
        })
    });
    
    group.finish();
}

criterion_group!(
    benches,
    benchmark_worker_scaling,
    benchmark_load_balancing_strategies,
    benchmark_task_priorities,
    benchmark_batch_processing,
    benchmark_file_size_impact,
    benchmark_queue_capacity,
    benchmark_dependency_resolution,
    benchmark_workload_optimization
);

criterion_main!(benches);