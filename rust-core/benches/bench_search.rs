/**
 * Performance Benchmarks for Search Operations (T084)
 *
 * Comprehensive benchmark suite for search performance across different
 * query types, index sizes, and ranking algorithms using Criterion.rs.
 *
 * Benchmarks include:
 * - Simple text search performance
 * - Complex query performance
 * - Ranking algorithm performance
 * - Memory usage during search
 * - Concurrent search efficiency
 */

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use std::time::Duration;
use std::sync::Arc;
use tokio::runtime::Runtime;

// Import modules to benchmark
use codesight_core::search::{SearchEngine, SearchConfig, Query, SearchResult, RankingStrategy};
use codesight_core::indexer::{Indexer, IndexConfig};
use codesight_core::storage::{Storage, StorageConfig};
use codesight_core::models::{Codebase, CodeEntity, Index};

/// Generate test entities for search indexing
fn generate_test_entities(count: usize) -> Vec<CodeEntity> {
    let mut entities = Vec::with_capacity(count);

    for i in 0..count {
        let entity_type = match i % 5 {
            0 => "function",
            1 => "class",
            2 => "interface",
            3 => "variable",
            _ => "module",
        };

        let name = match entity_type {
            "function" => format!("function_{}", i),
            "class" => format!("Class{}", i),
            "interface" => format!("IInterface{}", i),
            "variable" => format!("variable_{}", i),
            "module" => format!("module{}", i),
            _ => format!("unknown_{}", i),
        };

        // Generate code content
        let code = generate_entity_code(entity_type, &name, i);

        entities.push(CodeEntity {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            kind: entity_type.to_string(),
            start_byte: i * 1000,
            end_byte: (i + 1) * 1000,
            start_point: (i as u32, 0),
            end_point: ((i + 1) as u32, 0),
            children: Vec::new(),
            code: Some(code),
            file_path: format!("src/module{}.ts", i / 10),
            language: "typescript".to_string(),
            documentation: Some(format!("Documentation for {}", entity_type)),
            tags: vec![entity_type.to_string(), "typescript".to_string()],
            complexity_score: Some((i % 10 + 1) as f64),
            line_count: Some((i % 50 + 10) as u32),
        });
    }

    entities
}

fn generate_entity_code(entity_type: &str, name: &str, index: usize) -> String {
    match entity_type {
        "function" => format!(r#"
/**
 * Function {} - Example function with parameters
 * @param input - Input parameter
 * @param options - Optional configuration
 * @returns Processed result
 */
export function {}(input: string, options?: {{ mode: string; cache: boolean }}): string {{
    const startTime = performance.now();

    // Process input
    let result = input.trim().toLowerCase();

    if (options?.mode === 'reverse') {{
        result = result.split('').reverse().join('');
    }}

    if (options?.cache) {{
        // Cache result
        cache.set(`{}`, result);
    }}

    const duration = performance.now() - startTime;
    console.log(`Function {} executed in ${{duration.toFixed(2)}}ms`);

    return result;
}}

// Alternative arrow function version
export const {}_arrow = (input: string): string => {{
    return input.toUpperCase();
}};
"#, name, name, name, name, name),

        "class" => format!(r#"
/**
 * Class {} - Example TypeScript class
 */
export class {} {{
    private id: string;
    private data: Map<string, any>;
    private readonly createdAt: Date;

    constructor(id: string) {{
        this.id = id;
        this.data = new Map();
        this.createdAt = new Date();
    }}

    /**
     * Add data to the instance
     */
    public addData(key: string, value: any): void {{
        this.data.set(key, {{
            value,
            timestamp: Date.now(),
            version: 1
        }});
    }}

    /**
     * Get data from the instance
     */
    public getData(key: string): any | undefined {{
        const entry = this.data.get(key);
        return entry?.value;
    }}

    /**
     * Get data with metadata
     */
    public getDataWithMetadata(key: string): {{ value: any; timestamp: number; version: number }} | undefined {{
        return this.data.get(key);
    }}

    /**
     * Remove data from the instance
     */
    public removeData(key: string): boolean {{
        return this.data.delete(key);
    }}

    /**
     * Clear all data
     */
    public clear(): void {{
        this.data.clear();
    }}

    /**
     * Get instance information
     */
    public getInfo(): {{ id: string; createdAt: Date; dataCount: number }} {{
        return {{
            id: this.id,
            createdAt: this.createdAt,
            dataCount: this.data.size
        }};
    }}

    /**
     * Serialize instance to JSON
     */
    public toJSON(): string {{
        return JSON.stringify({{
            id: this.id,
            data: Array.from(this.data.entries()),
            createdAt: this.createdAt.toISOString()
        }}, null, 2);
    }}
}}
"#, name, name),

        "interface" => format!(r#"
/**
 * Interface {} - Example TypeScript interface
 */
export interface {} {{
    /** Unique identifier */
    id: string;

    /** Name of the entity */
    name: string;

    /** Optional description */
    description?: string;

    /** Creation timestamp */
    createdAt: Date;

    /** Last updated timestamp */
    updatedAt: Date;

    /** Metadata key-value pairs */
    metadata: Record<string, any>;

    /** Status of the entity */
    status: 'active' | 'inactive' | 'pending' | 'archived';

    /** Array of tags */
    tags: string[];

    /** Configuration object */
    config: {{
        enabled: boolean;
        timeout: number;
        retries: number;
        priority: number;
    }};
}}

/**
 * Extended interface with additional properties
 */
export interface {}Extended extends {} {{
    /** Additional properties for extended interface */
    version: number;
    dependencies: string[];
    permissions: string[];

    /** Optional callback function */
    onUpdated?: (oldValue: {}, newValue: {}) => void;

    /** Computed property */
    readonly isStale: boolean;
}}

/**
 * Type guard function
 */
export function is{}Valid(obj: any): obj is {} {{
    return obj &&
           typeof obj.id === 'string' &&
           typeof obj.name === 'string' &&
           obj.createdAt instanceof Date &&
           ['active', 'inactive', 'pending', 'archived'].includes(obj.status);
}}

/**
 * Factory function for creating instances
 */
export function create{}(params: Partial<{}>): {} {{
    const now = new Date();
    return {{
        id: params.id || uuidv4(),
        name: params.name || 'unnamed',
        description: params.description,
        createdAt: params.createdAt || now,
        updatedAt: params.updatedAt || now,
        metadata: params.metadata || {{}},
        status: params.status || 'active',
        tags: params.tags || [],
        config: {{
            enabled: true,
            timeout: 5000,
            retries: 3,
            priority: 1,
            ...params.config
        }}
    }};
}}
"#, name, name, name, name, name, name, name, name, name, name, name),

        "variable" => format!(r#"
// Variable {} - Example variable declarations

// Constants
const {}_CONSTANT = 42;
const {}_VERSION = '1.0.0';
const {}_DEFAULT_CONFIG = {{
    timeout: 5000,
    retries: 3,
    cache: true
}};

// Let variables
let {}_counter = 0;
let {}_cache = new Map<string, any>();
let {}_instances: {}[] = [];

// Array declarations
const {}_list = [
    'item1', 'item2', 'item3',
    'item4', 'item5', 'item6'
];

const {}_objects = [
    {{ id: 1, name: 'First' }},
    {{ id: 2, name: 'Second' }},
    {{ id: 3, name: 'Third' }}
];

// Complex object with nested structure
const {}_complex_data = {{
    users: [
        {{
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            profile: {{
                age: 30,
                location: 'New York',
                interests: ['coding', 'music', 'travel']
            }}
        }},
        {{
            id: 2,
            name: 'Jane Smith',
            email: 'jane@example.com',
            profile: {{
                age: 25,
                location: 'San Francisco',
                interests: ['design', 'photography', 'hiking']
            }}
        }}
    ],
    metadata: {{
        totalUsers: 2,
        lastUpdated: new Date().toISOString(),
        version: {}.toString()
    }}
}};

// Export statements
export {{
    {}_CONSTANT,
    {}_VERSION,
    {}_DEFAULT_CONFIG
}};
"#, name, name, name, name, name, name, name, name, name, name, name, index, name, name, name),

        _ => format!("// Module {}\nexport const {} = 'module_value_{}';\n", name, name, index),
    }
}

/// Create test index with specified number of entities
async fn create_test_index(entity_count: usize) -> (Storage, Codebase) {
    let storage = Storage::new(StorageConfig::memory()).await.unwrap();

    let codebase = Codebase {
        id: uuid::Uuid::new_v4().to_string(),
        name: "search_test".to_string(),
        path: "/test".to_string(),
        language: "typescript".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    // Create entities
    let entities = generate_test_entities(entity_count);

    // Index entities
    for entity in entities {
        storage.save_entity(&entity).await.unwrap();
    }

    (storage, codebase)
}

/// Benchmark simple text search performance
fn bench_simple_search(c: &mut Criterion) {
    let mut group = c.benchmark_group("simple_search");
    group.measurement_time(Duration::from_secs(8));
    group.sample_size(100);

    let entity_counts = [100, 500, 1000, 5000];
    let search_terms = ["function", "class", "interface", "config", "data"];

    for &entity_count in &entity_counts {
        let rt = Runtime::new().unwrap();
        let (storage, codebase) = rt.block_on(create_test_index(entity_count));

        for &search_term in &search_terms {
            group.bench_with_input(
                BenchmarkId::new(format!("entities_{}", entity_count), search_term),
                search_term,
                |b, &term| {
                    let rt = Runtime::new().unwrap();
                    b.to_async(&rt).iter(|| async {
                        let search_engine = SearchEngine::new(SearchConfig::default()).await.unwrap();

                        let query = Query::text(term.to_string());
                        let results = search_engine.search(
                            black_box(&query),
                            black_box(&codebase),
                            black_box(&storage)
                        ).await;

                        black_box(results)
                    });
                },
            );
        }
    }

    group.finish();
}

/// Benchmark complex query performance
fn bench_complex_search(c: &mut Criterion) {
    let mut group = c.benchmark_group("complex_search");
    group.measurement_time(Duration::from_secs(10));
    group.sample_size(50);

    let entity_count = 1000;
    let rt = Runtime::new().unwrap();
    let (storage, codebase) = rt.block_on(create_test_index(entity_count));

    // Simple text query
    group.bench_function("text_query", |b| {
        let rt = Runtime::new().unwrap();
        b.to_async(&rt).iter(|| async {
            let search_engine = SearchEngine::new(SearchConfig::default()).await.unwrap();

            let query = Query::text("function".to_string());
            let results = search_engine.search(
                black_box(&query),
                black_box(&codebase),
                black_box(&storage)
            ).await;

            black_box(results)
        });
    });

    // Filtered query
    group.bench_function("filtered_query", |b| {
        let rt = Runtime::new().unwrap();
        b.to_async(&rt).iter(|| async {
            let search_engine = SearchEngine::new(SearchConfig::default()).await.unwrap();

            let query = Query::builder()
                .text("function".to_string())
                .entity_type("function")
                .language("typescript")
                .build();

            let results = search_engine.search(
                black_box(&query),
                black_box(&codebase),
                black_box(&storage)
            ).await;

            black_box(results)
        });
    });

    // Complex query with filters and sorting
    group.bench_function("complex_query", |b| {
        let rt = Runtime::new().unwrap();
        b.to_async(&rt).iter(|| async {
            let search_engine = SearchEngine::new(SearchConfig::default()).await.unwrap();

            let query = Query::builder()
                .text("data".to_string())
                .entity_types(&["function", "class"])
                .language("typescript")
                .min_complexity(5.0)
                .max_complexity(10.0)
                .sort_by("name")
                .limit(10)
                .build();

            let results = search_engine.search(
                black_box(&query),
                black_box(&codebase),
                black_box(&storage)
            ).await;

            black_box(results)
        });
    });

    group.finish();
}

/// Benchmark ranking algorithm performance
fn bench_ranking_performance(c: &mut Criterion) {
    let mut group = c.benchmark_group("ranking_performance");
    group.measurement_time(Duration::from_secs(8));
    group.sample_size(50);

    let entity_counts = [500, 1000, 2000];

    for &entity_count in &entity_counts {
        let rt = Runtime::new().unwrap();
        let (storage, codebase) = rt.block_on(create_test_index(entity_count));

        // TF-IDF ranking
        group.bench_with_input(
            BenchmarkId::new("tfidf", entity_count),
            entity_count,
            |b, _| {
                let rt = Runtime::new().unwrap();
                b.to_async(&rt).iter(|| async {
                    let mut config = SearchConfig::default();
                    config.ranking_strategy = RankingStrategy::TfIdf;
                    let search_engine = SearchEngine::new(config).await.unwrap();

                    let query = Query::text("function".to_string());
                    let results = search_engine.search(
                        black_box(&query),
                        black_box(&codebase),
                        black_box(&storage)
                    ).await;

                    black_box(results)
                });
            },
        );

        // BM25 ranking
        group.bench_with_input(
            BenchmarkId::new("bm25", entity_count),
            entity_count,
            |b, _| {
                let rt = Runtime::new().unwrap();
                b.to_async(&rt).iter(|| async {
                    let mut config = SearchConfig::default();
                    config.ranking_strategy = RankingStrategy::BM25;
                    let search_engine = SearchEngine::new(config).await.unwrap();

                    let query = Query::text("function data".to_string());
                    let results = search_engine.search(
                        black_box(&query),
                        black_box(&codebase),
                        black_box(&storage)
                    ).await;

                    black_box(results)
                });
            },
        );

        // Hybrid ranking
        group.bench_with_input(
            BenchmarkId::new("hybrid", entity_count),
            entity_count,
            |b, _| {
                let rt = Runtime::new().unwrap();
                b.to_async(&rt).iter(|| async {
                    let mut config = SearchConfig::default();
                    config.ranking_strategy = RankingStrategy::Hybrid;
                    let search_engine = SearchEngine::new(config).await.unwrap();

                    let query = Query::text("function interface".to_string());
                    let results = search_engine.search(
                        black_box(&query),
                        black_box(&codebase),
                        black_box(&storage)
                    ).await;

                    black_box(results)
                });
            },
        );
    }

    group.finish();
}

/// Benchmark memory usage during search
fn bench_memory_search(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_search");
    group.measurement_time(Duration::from_secs(6));
    group.sample_size(50);

    let entity_counts = [1000, 2000, 5000];

    for &entity_count in &entity_counts {
        let rt = Runtime::new().unwrap();
        let (storage, codebase) = rt.block_on(create_test_index(entity_count));

        group.bench_with_input(
            BenchmarkId::new("memory_intensive", entity_count),
            entity_count,
            |b, _| {
                let rt = Runtime::new().unwrap();
                b.to_async(&rt).iter(|| async {
                    let search_engine = SearchEngine::new(SearchConfig::default()).await.unwrap();

                    let query = Query::builder()
                        .text("function class interface".to_string())
                        .include_snippets(true)
                        .include_highlights(true)
                        .limit(50)
                        .build();

                    let results = search_engine.search(
                        black_box(&query),
                        black_box(&codebase),
                        black_box(&storage)
                    ).await;

                    // Process results to increase memory usage
                    if let Ok(search_results) = results {
                        let processed_results: Vec<_> = search_results.results
                            .into_iter()
                            .map(|mut result| {
                                // Add additional processing
                                result.snippet = result.snippet.map(|s| format!("Processed: {}", s));
                                result.highlights.extend(vec!["highlight1".to_string(), "highlight2".to_string()]);
                                result.score = result.score * 1.1; // Boost score
                                result
                            })
                            .collect();

                        black_box(processed_results)
                    }

                    black_box(results)
                });
            },
        );
    }

    group.finish();
}

/// Benchmark concurrent search efficiency
fn bench_concurrent_search(c: &mut Criterion) {
    let mut group = c.benchmark_group("concurrent_search");
    group.measurement_time(Duration::from_secs(10));
    group.sample_size(20);

    let entity_count = 2000;
    let rt = Runtime::new().unwrap();
    let (storage, codebase) = rt.block_on(create_test_index(entity_count));

    let search_queries = vec![
        "function",
        "class",
        "interface",
        "variable",
        "module",
        "config",
        "data",
        "process"
    ];

    // Sequential search baseline
    group.bench_function("sequential", |b| {
        let rt = Runtime::new().unwrap();
        b.to_async(&rt).iter(|| async {
            let search_engine = Arc::new(SearchEngine::new(SearchConfig::default()).await.unwrap());
            let storage = Arc::new(&storage);
            let codebase = Arc::new(&codebase);

            let mut all_results = Vec::new();
            for query_text in &search_queries {
                let query = Query::text(query_text.to_string());
                let results = search_engine.search(&query, &**codebase, &**storage).await;
                all_results.push(results);
            }

            black_box(all_results)
        });
    });

    // Concurrent search with tokio tasks
    group.bench_function("concurrent", |b| {
        let rt = Runtime::new().unwrap();
        b.to_async(&rt).iter(|| async {
            let search_engine = Arc::new(SearchEngine::new(SearchConfig::default()).await.unwrap());
            let storage = Arc::new(&storage);
            let codebase = Arc::new(&codebase);

            let mut tasks = Vec::new();
            for query_text in &search_queries {
                let search_engine = Arc::clone(&search_engine);
                let storage = Arc::clone(&storage);
                let codebase = Arc::clone(&codebase);
                let query_text = query_text.to_string();

                let task = tokio::spawn(async move {
                    let query = Query::text(query_text);
                    search_engine.search(&query, &*codebase, &*storage).await
                });
                tasks.push(task);
            }

            let mut all_results = Vec::new();
            for task in tasks {
                all_results.push(task.await.unwrap());
            }

            black_box(all_results)
        });
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_simple_search,
    bench_complex_search,
    bench_ranking_performance,
    bench_memory_search,
    bench_concurrent_search
);
criterion_main!(benches);