use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use codesight_core::services::{IndexerService, ParserService, SearchService};
use codesight_core::models::{Codebase, CodeEntity};
use std::path::{Path, PathBuf};
use tempfile::TempDir;
use tokio::runtime::Runtime;

fn create_large_test_dataset() -> (TempDir, Codebase, Vec<String>) {
    let temp_dir = TempDir::new().unwrap();
    let codebase_path = temp_dir.path();

    let mut file_paths = Vec::new();

    // Create a larger test dataset with various file sizes
    for i in 0..100 {
        let file_content = if i % 5 == 0 {
            // Large file with many entities
            format!(r#"
// Large file {} with many functions and classes
export class Service{i} {{
    private dependencies: Map<string, any> = new Map();
    private cache: LRUCache<string, any> = new LRUCache(1000);
    private metrics: MetricsCollector = new MetricsCollector();

    constructor(private config: Config{i}) {{
        this.initialize();
    }}

    private initialize(): void {{
        this.setupDependencies();
        this.configureCache();
        this.initializeMetrics();
    }}

    async processRequest<i>(request: Request{i}): Promise<Response{i}> {{
        const startTime = performance.now();

        try {{
            // Validate request
            const validation = await this.validateRequest(request);
            if (!validation.isValid) {{
                return this.createErrorResponse(validation.errors);
            }}

            // Process request
            const result = await this.handleRequest(request);

            // Update metrics
            this.metrics.recordRequest('success', performance.now() - startTime);

            return this.createSuccessResponse(result);
        }} catch (error) {{
            this.metrics.recordRequest('error', performance.now() - startTime);
            return this.createErrorResponse([error.message]);
        }}
    }}

    private async validateRequest(request: Request{i}): Promise<ValidationResult> {{
        const validator = new RequestValidator{i}();
        return await validator.validate(request);
    }}

    private async handleRequest(request: Request{i}): Promise<ProcessResult> {{
        const processor = new RequestProcessor{i}();
        return await processor.process(request);
    }}

    private createSuccessResponse(result: ProcessResult): Response<i> {{
        return {{
            success: true,
            data: result,
            timestamp: new Date().toISOString(),
            requestId: this.generateRequestId()
        }};
    }}

    private createErrorResponse(errors: string[]): Response<i> {{
        return {{
            success: false,
            errors,
            timestamp: new Date().toISOString(),
            requestId: this.generateRequestId()
        }};
    }}

    private generateRequestId(): string {{
        return Math.random().toString(36).substr(2, 9);
    }}

    // Additional methods for Service{i}
    async getMetrics(): Promise<ServiceMetrics> {{
        return this.metrics.getMetrics();
    }}

    async clearCache(): Promise<void> {{
        this.cache.clear();
    }}

    async healthCheck(): Promise<HealthStatus> {{
        return {{
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage()
        }};
    }}
}}

export class RequestValidator{i} {{
    private rules: ValidationRule[] = [];

    constructor() {{
        this.setupValidationRules();
    }}

    private setupValidationRules(): void {{
        this.rules = [
            new RequiredFieldRule('id'),
            new RequiredFieldRule('type'),
            new ValidEmailRule('email'),
            new MinLengthRule('name', 2),
            new MaxLengthRule('name', 100)
        ];
    }}

    async validate(request: Request{i}): Promise<ValidationResult> {{
        const errors: string[] = [];

        for (const rule of this.rules) {{
            const ruleErrors = await rule.validate(request);
            errors.push(...ruleErrors);
        }}

        return {{
            isValid: errors.length === 0,
            errors
        }};
    }}
}}

export class RequestProcessor{i} {{
    private plugins: Plugin[] = [];

    constructor() {{
        this.loadPlugins();
    }}

    private loadPlugins(): void {{
        // Load processing plugins
        this.plugins = [
            new AuthPlugin(),
            new LoggingPlugin(),
            new CachingPlugin(),
            new MetricsPlugin()
        ];
    }}

    async process(request: Request{i}): Promise<ProcessResult> {{
        let context = new ProcessContext(request);

        for (const plugin of this.plugins) {{
            context = await plugin.process(context);
        }}

        return context.getResult();
    }}
}}

// Supporting interfaces and classes
interface Config{i} {{
    database: DatabaseConfig;
    cache: CacheConfig;
    logging: LoggingConfig;
    plugins: PluginConfig[];
}}

interface Request{i> {{
    id: string;
    type: string;
    data: any;
    metadata: RequestMetadata;
}}

interface Response<i> {{
    success: boolean;
    data?: any;
    errors?: string[];
    timestamp: string;
    requestId: string;
}}

interface ValidationResult {{
    isValid: boolean;
    errors: string[];
}}

interface ProcessResult {{
    processedData: any;
    metadata: ProcessMetadata;
    metrics: ProcessMetrics;
}}
"#, i)
        } else if i % 3 == 0 {
            // Medium file
            format!(r#"
// Medium file {} - Utility functions
export class StringUtil{i} {{
    static capitalize(str: string): string {{
        return str.charAt(0).toUpperCase() + str.slice(1);
    }}

    static truncate(str: string, length: number): string {{
        return str.length > length ? str.slice(0, length) + '...' : str;
    }}

    static slugify(str: string): string {{
        return str
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }}

    static isValidEmail(email: string): boolean {{
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }}

    static generateId(length: number = 8): string {{
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {{
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }}
        return result;
    }}
}}

export class DateUtil{i} {{
    static formatDate(date: Date, format: string = 'YYYY-MM-DD'): string {{
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return format
            .replace('YYYY', year.toString())
            .replace('MM', month)
            .replace('DD', day);
    }}

    static isWeekend(date: Date): boolean {{
        const day = date.getDay();
        return day === 0 || day === 6;
    }}

    static addDays(date: Date, days: number): Date {{
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }}
}}

export class ArrayUtil{i} {{
    static unique<T>(array: T[]): T[] {{
        return [...new Set(array)];
    }}

    static chunk<T>(array: T[], size: number): T[][] {{
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {{
            chunks.push(array.slice(i, i + size));
        }}
        return chunks;
    }}

    static shuffle<T>(array: T[]): T[] {{
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {{
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }}
        return shuffled;
    }}
}}
"#, i)
        } else {
            // Small file
            format!(r#"
// Small file {} - Constants and types
export const CONSTANTS{i} = {{
    API_VERSION: 'v1',
    MAX_RETRIES: 3,
    TIMEOUT_MS: 5000,
    CACHE_TTL: 3600
}};

export type Status{i} = 'pending' | 'processing' | 'completed' | 'failed';

export interface ConfigItem{i} {{
    key: string;
    value: any;
    type: 'string' | 'number' | 'boolean' | 'object';
}}

export function createConfigItem<i>(key: string, value: any): ConfigItem<i> {{
    return {{
        key,
        value,
        type: typeof value as any
    }};
}}
"#, i)
        };

        let file_path = codebase_path.join(format!("src/module_{}/file_{}.ts", i / 10, i));
        if let Some(parent) = file_path.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        std::fs::write(&file_path, file_content).unwrap();
        file_paths.push(file_path.to_string_lossy().to_string());
    }

    let codebase = Codebase {
        id: "large-test-codebase".to_string(),
        name: "Large Test Codebase".to_string(),
        path: codebase_path.to_string_lossy().to_string(),
        size_bytes: 0,
        file_count: file_paths.len() as u32,
        language_stats: [("typescript".to_string(), file_paths.len() as u32)].into_iter().collect(),
        index_version: "1.0.0".to_string(),
        last_indexed: None,
        configuration_id: "default".to_string(),
        status: codesight_core::models::CodebaseStatus::Unindexed,
    };

    (temp_dir, codebase, file_paths)
}

fn bench_memory_usage_during_indexing(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let mut group = c.benchmark_group("memory_indexing");

    // Test memory usage with different file counts
    for file_count in [10, 25, 50, 100].iter() {
        group.bench_with_input(
            BenchmarkId::new("files", file_count),
            file_count,
            |b, &file_count| {
                b.to_async(&rt).iter(|| async {
                    let (_temp_dir, codebase, file_paths) = create_large_test_dataset();
                    let parser = ParserService::new();
                    let indexer = IndexerService::new();

                    let files_to_process: Vec<String> = file_paths.into_iter().take(file_count).collect();

                    for file_path in &files_to_process {
                        let content = std::fs::read_to_string(file_path).unwrap();
                        let ast = parser.parse(&content, "typescript").unwrap();
                        let entities = indexer.extract_entities(&ast, Path::new(file_path)).unwrap();
                        black_box(entities);
                    }
                });
            },
        );
    }

    group.finish();
}

fn bench_memory_usage_during_search(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let search_service = SearchService::new();

    let mut group = c.benchmark_group("memory_search");

    // Create a large entity set for search testing
    let (_temp_dir, codebase, file_paths) = create_large_test_dataset();
    let parser = ParserService::new();
    let indexer = IndexerService::new();

    let mut all_entities = Vec::new();
    for file_path in &file_paths {
        let content = std::fs::read_to_string(file_path).unwrap();
        let ast = parser.parse(&content, "typescript").unwrap();
        let entities = indexer.extract_entities(&ast, Path::new(file_path)).unwrap();
        all_entities.extend(entities);
    }

    // Test memory usage with different result set sizes
    for entity_count in [100, 500, 1000, all_entities.len()].iter() {
        group.bench_with_input(
            BenchmarkId::new("entities", entity_count),
            entity_count,
            |b, &entity_count| {
                b.to_async(&rt).iter(|| async {
                    let search_query = codesight_core::models::Query {
                        id: "test-query".to_string(),
                        query_text: "service utility function".to_string(),
                        query_type: codesight_core::models::QueryType::NaturalLanguage,
                        intent: codesight_core::models::QueryIntent::FindFunction,
                        codebase_id: codebase.id.clone(),
                        user_id: None,
                        timestamp: chrono::Utc::now(),
                        execution_time_ms: 0,
                        result_count: 0,
                        cache_hit: false,
                    };

                    let entities: Vec<CodeEntity> = all_entities.iter().take(entity_count).cloned().collect();
                    let results = search_service.search(black_box(&search_query), black_box(&entities)).await;
                    black_box(results);
                });
            },
        );
    }

    group.finish();
}

fn bench_cache_memory_impact(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let mut group = c.benchmark_group("memory_cache");

    let (_temp_dir, codebase, file_paths) = create_large_test_dataset();
    let parser = ParserService::new();

    // Test memory impact with and without caching
    group.bench_function("with_cache", |b| {
        b.to_async(&rt).iter(|| async {
            let mut cache = std::collections::HashMap::new();

            for file_path in &file_paths.iter().take(50) {
                let content = std::fs::read_to_string(file_path).unwrap();

                // Check cache first
                if let Some(cached_ast) = cache.get(file_path) {
                    black_box(cached_ast);
                } else {
                    let ast = parser.parse(&content, "typescript").unwrap();
                    cache.insert(file_path.clone(), ast);
                }
            }
        });
    });

    group.bench_function("without_cache", |b| {
        b.to_async(&rt).iter(|| async {
            for file_path in &file_paths.iter().take(50) {
                let content = std::fs::read_to_string(file_path).unwrap();
                let ast = parser.parse(&content, "typescript").unwrap();
                black_box(ast);
            }
        });
    });

    group.finish();
}

fn bench_concurrent_memory_usage(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let parser = ParserService::new();

    let mut group = c.benchmark_group("memory_concurrent");

    let (_temp_dir, codebase, file_paths) = create_large_test_dataset();

    // Test memory usage with different concurrency levels
    for concurrency in [1, 4, 8, 16].iter() {
        group.bench_with_input(
            BenchmarkId::new("concurrent_tasks", concurrency),
            concurrency,
            |b, &concurrency| {
                b.to_async(&rt).iter(|| async {
                    let files_to_process: Vec<String> = file_paths.iter().take(concurrency * 5).cloned().collect();
                    let chunk_size = (files_to_process.len() + concurrency - 1) / concurrency;

                    let mut handles = Vec::new();
                    for chunk in files_to_process.chunks(chunk_size) {
                        let chunk = chunk.to_vec();
                        let parser_clone = parser.clone();

                        let handle = tokio::spawn(async move {
                            for file_path in chunk {
                                let content = std::fs::read_to_string(&file_path).unwrap();
                                let ast = parser_clone.parse(&content, "typescript").unwrap();
                                black_box(ast);
                            }
                        });
                        handles.push(handle);
                    }

                    for handle in handles {
                        handle.await.unwrap();
                    }
                });
            },
        );
    }

    group.finish();
}

criterion_group!(
    benches,
    bench_memory_usage_during_indexing,
    bench_memory_usage_during_search,
    bench_cache_memory_impact,
    bench_concurrent_memory_usage
);
criterion_main!(benches);