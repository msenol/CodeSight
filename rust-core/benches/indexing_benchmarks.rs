use criterion::{black_box, criterion_group, criterion_main, Criterion};
use rust_core::services::indexing::IndexingService;
use rust_core::models::codebase::Codebase;
use std::path::PathBuf;
use tempfile::TempDir;
use std::fs;

fn create_test_codebase(file_count: usize) -> (TempDir, Codebase) {
    let temp_dir = TempDir::new().unwrap();
    let temp_path = temp_dir.path().to_path_buf();
    
    // Create test files
    for i in 0..file_count {
        let file_path = temp_path.join(format!("test_{}.rs", i));
        let content = format!(
            "// Test file {}

pub fn test_function_{}() {{
    let x = {};
    println!(\"Hello from test {}\");
}}

pub struct TestStruct{} {{
    pub field: i32,
}}

impl TestStruct{} {{
    pub fn new() -> Self {{
        Self {{ field: {} }}
    }}
    
    pub fn process(&self) -> i32 {{
        self.field * 2
    }}
}}

#[cfg(test)]
mod tests {{
    use super::*;
    
    #[test]
    fn test_function_{}() {{
        assert_eq!(test_function_{}(), ());
    }}
}}",
            i, i, i, i, i, i, i, i
        );
        fs::write(file_path, content).unwrap();
    }
    
    let codebase = Codebase {
        id: uuid::Uuid::new_v4(),
        name: "benchmark_test".to_string(),
        path: temp_path.to_string_lossy().to_string(),
        size_bytes: 0,
        file_count: file_count as i32,
        language_stats: std::collections::HashMap::new(),
        index_version: "1.0.0".to_string(),
        last_indexed: None,
        configuration_id: uuid::Uuid::new_v4(),
        status: rust_core::models::codebase::CodebaseStatus::Unindexed,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };
    
    (temp_dir, codebase)
}

fn benchmark_small_codebase_indexing(c: &mut Criterion) {
    c.bench_function("index_small_codebase_10_files", |b| {
        b.iter(|| {
            let (_temp_dir, codebase) = create_test_codebase(10);
            let indexing_service = IndexingService::new();
            black_box(indexing_service.index_codebase(&codebase))
        })
    });
}

fn benchmark_medium_codebase_indexing(c: &mut Criterion) {
    c.bench_function("index_medium_codebase_100_files", |b| {
        b.iter(|| {
            let (_temp_dir, codebase) = create_test_codebase(100);
            let indexing_service = IndexingService::new();
            black_box(indexing_service.index_codebase(&codebase))
        })
    });
}

fn benchmark_large_codebase_indexing(c: &mut Criterion) {
    c.bench_function("index_large_codebase_1000_files", |b| {
        b.iter(|| {
            let (_temp_dir, codebase) = create_test_codebase(1000);
            let indexing_service = IndexingService::new();
            black_box(indexing_service.index_codebase(&codebase))
        })
    });
}

fn benchmark_parallel_indexing(c: &mut Criterion) {
    let mut group = c.benchmark_group("parallel_indexing");
    
    for worker_count in [1, 2, 4, 8].iter() {
        group.bench_with_input(
            format!("workers_{}", worker_count),
            worker_count,
            |b, &worker_count| {
                b.iter(|| {
                    let (_temp_dir, codebase) = create_test_codebase(500);
                    let mut indexing_service = IndexingService::new();
                    indexing_service.set_parallel_workers(worker_count);
                    black_box(indexing_service.index_codebase(&codebase))
                })
            },
        );
    }
    group.finish();
}

criterion_group!(
    benches,
    benchmark_small_codebase_indexing,
    benchmark_medium_codebase_indexing,
    benchmark_large_codebase_indexing,
    benchmark_parallel_indexing
);
criterion_main!(benches);