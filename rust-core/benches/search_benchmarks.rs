use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use rust_core::services::search::SearchService;
use rust_core::models::query::Query;
use rust_core::models::codebase::Codebase;
use std::collections::HashMap;

fn create_test_search_service() -> SearchService {
    SearchService::new()
}

fn create_test_queries() -> Vec<Query> {
    vec![
        Query {
            id: uuid::Uuid::new_v4(),
            query_text: "function authentication".to_string(),
            query_type: rust_core::models::query::QueryType::NaturalLanguage,
            intent: Some(rust_core::models::query::QueryIntent::FindFunction),
            codebase_id: uuid::Uuid::new_v4(),
            user_id: Some("test_user".to_string()),
            timestamp: chrono::Utc::now(),
            execution_time_ms: 0,
            result_count: 0,
            cache_hit: false,
        },
        Query {
            id: uuid::Uuid::new_v4(),
            query_text: "class UserService".to_string(),
            query_type: rust_core::models::query::QueryType::NaturalLanguage,
            intent: Some(rust_core::models::query::QueryIntent::FindFunction),
            codebase_id: uuid::Uuid::new_v4(),
            user_id: Some("test_user".to_string()),
            timestamp: chrono::Utc::now(),
            execution_time_ms: 0,
            result_count: 0,
            cache_hit: false,
        },
        Query {
            id: uuid::Uuid::new_v4(),
            query_text: "API endpoints".to_string(),
            query_type: rust_core::models::query::QueryType::NaturalLanguage,
            intent: Some(rust_core::models::query::QueryIntent::FindApi),
            codebase_id: uuid::Uuid::new_v4(),
            user_id: Some("test_user".to_string()),
            timestamp: chrono::Utc::now(),
            execution_time_ms: 0,
            result_count: 0,
            cache_hit: false,
        },
    ]
}

fn benchmark_keyword_search(c: &mut Criterion) {
    let search_service = create_test_search_service();
    let queries = create_test_queries();
    
    c.bench_function("keyword_search", |b| {
        b.iter(|| {
            for query in &queries {
                black_box(search_service.keyword_search(query));
            }
        })
    });
}

fn benchmark_semantic_search(c: &mut Criterion) {
    let search_service = create_test_search_service();
    let queries = create_test_queries();
    
    c.bench_function("semantic_search", |b| {
        b.iter(|| {
            for query in &queries {
                black_box(search_service.semantic_search(query));
            }
        })
    });
}

fn benchmark_hybrid_search(c: &mut Criterion) {
    let search_service = create_test_search_service();
    let queries = create_test_queries();
    
    c.bench_function("hybrid_search", |b| {
        b.iter(|| {
            for query in &queries {
                black_box(search_service.hybrid_search(query));
            }
        })
    });
}

fn benchmark_search_with_different_result_limits(c: &mut Criterion) {
    let mut group = c.benchmark_group("search_result_limits");
    let search_service = create_test_search_service();
    let query = &create_test_queries()[0];
    
    for limit in [10, 50, 100, 500].iter() {
        group.bench_with_input(
            BenchmarkId::new("hybrid_search", limit),
            limit,
            |b, &limit| {
                b.iter(|| {
                    black_box(search_service.hybrid_search_with_limit(query, limit))
                })
            },
        );
    }
    group.finish();
}

fn benchmark_concurrent_searches(c: &mut Criterion) {
    let mut group = c.benchmark_group("concurrent_searches");
    let search_service = std::sync::Arc::new(create_test_search_service());
    let queries = create_test_queries();
    
    for thread_count in [1, 2, 4, 8].iter() {
        group.bench_with_input(
            BenchmarkId::new("concurrent", thread_count),
            thread_count,
            |b, &thread_count| {
                b.iter(|| {
                    let handles: Vec<_> = (0..*thread_count)
                        .map(|i| {
                            let service = search_service.clone();
                            let query = queries[i % queries.len()].clone();
                            std::thread::spawn(move || {
                                black_box(service.hybrid_search(&query))
                            })
                        })
                        .collect();
                    
                    for handle in handles {
                        handle.join().unwrap();
                    }
                })
            },
        );
    }
    group.finish();
}

fn benchmark_cache_performance(c: &mut Criterion) {
    let mut group = c.benchmark_group("cache_performance");
    let search_service = create_test_search_service();
    let query = &create_test_queries()[0];
    
    // First search to populate cache
    search_service.hybrid_search(query);
    
    group.bench_function("cache_hit", |b| {
        b.iter(|| {
            black_box(search_service.hybrid_search(query))
        })
    });
    
    group.bench_function("cache_miss", |b| {
        b.iter(|| {
            let mut new_query = query.clone();
            new_query.id = uuid::Uuid::new_v4();
            new_query.query_text = format!("unique_query_{}", uuid::Uuid::new_v4());
            black_box(search_service.hybrid_search(&new_query))
        })
    });
    
    group.finish();
}

criterion_group!(
    benches,
    benchmark_keyword_search,
    benchmark_semantic_search,
    benchmark_hybrid_search,
    benchmark_search_with_different_result_limits,
    benchmark_concurrent_searches,
    benchmark_cache_performance
);
criterion_main!(benches);