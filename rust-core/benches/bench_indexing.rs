/**
 * Performance Benchmarks for Indexing Operations (T084)
 *
 * Comprehensive benchmark suite for indexing performance across different
 * project sizes and configurations using Criterion.rs.
 *
 * Benchmarks include:
 * - Single file indexing performance
 * - Project indexing scalability
 * - Memory usage during indexing
 * - Concurrent indexing efficiency
 * - Index update performance
 */

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use std::path::Path;
use std::time::Duration;
use tempfile::TempDir;
use walkdir::WalkDir;
use std::sync::Arc;
use tokio::runtime::Runtime;

// Import modules to benchmark
use codesight_core::indexer::{Indexer, IndexConfig};
use codesight_core::parser::TreeSitterParser;
use codesight_core::storage::{Storage, StorageConfig};
use codesight_core::models::{Codebase, CodeEntity, Index};

/// Generate realistic code project structure
fn generate_test_project_structure(base_dir: &Path, language: &str, files_per_dir: usize, dirs: usize) {
    for dir_idx in 0..dirs {
        let dir_path = base_dir.join(format!("src{}", dir_idx));
        std::fs::create_dir_all(&dir_path).unwrap();

        for file_idx in 0..files_per_dir {
            let file_extension = match language {
                "typescript" => "ts",
                "javascript" => "js",
                "rust" => "rs",
                "python" => "py",
                _ => "txt",
            };

            let file_path = dir_path.join(format!("module_{}.{}", file_idx, file_extension));
            let code = generate_module_code(language, file_idx);
            std::fs::write(&file_path, code).unwrap();
        }
    }

    // Create config files
    std::fs::write(base_dir.join("package.json"), generate_package_json()).unwrap();
    std::fs::write(base_dir.join("tsconfig.json"), generate_tsconfig_json()).unwrap();
}

fn generate_module_code(language: &str, module_id: usize) -> String {
    match language {
        "typescript" => format!(r#"
// Module {} - TypeScript
import {{ Component, OnInit }} from '@angular/core';
import {{ HttpService }} from '../services/http.service';
import {{ Logger }} from '../utils/logger';

interface ApiResponse {{
    id: string;
    name: string;
    data: any[];
    timestamp: number;
}}

export class Module{module_id}Component implements OnInit {{
    private moduleId: string = 'module-{module_id}';
    private dependencies: string[] = ['http', 'logger'];

    constructor(
        private httpService: HttpService,
        private logger: Logger
    ) {{}}

    async ngOnInit(): Promise<void> {{
        this.logger.info(`Initializing ${{this.moduleId}}`);
        try {{
            const data = await this.fetchData();
            this.processData(data);
        }} catch (error) {{
            this.logger.error(`Failed to initialize ${{this.moduleId}}:`, error);
        }}
    }}

    private async fetchData(): Promise<ApiResponse> {{
        const startTime = performance.now();
        const response = await this.httpService.get<ApiResponse>('/api/module-{module_id}');
        const duration = performance.now() - startTime;
        this.logger.debug(`API call took ${{duration.toFixed(2)}}ms`);
        return response;
    }}

    private processData(data: ApiResponse): void {{
        const processedData = data.data.map(item => ({{
            ...item,
            processed: true,
            module: this.moduleId,
            timestamp: Date.now()
        }}));

        this.emitDataChange(processedData);
    }}

    private emitDataChange(data: any[]): void {{
        // Emit data change event
        this.logger.info(`Processed ${{data.length}} items in ${{this.moduleId}}`);
    }}

    // Additional utility methods
    validateInput(input: any): boolean {{
        return input !== null && typeof input === 'object';
    }}

    formatOutput(data: any[]): string {{
        return JSON.stringify(data, null, 2);
    }}

    cleanup(): void {{
        this.logger.info(`Cleaning up ${{this.moduleId}}`);
    }}
}}
"#, module_id),

        "rust" => format!(r#"
// Module {} - Rust
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use serde::{{Deserialize, Serialize}};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse {{
    pub id: String,
    pub name: String,
    pub data: Vec<serde_json::Value>,
    pub timestamp: u64,
}}

pub struct Module{module_id} {{
    module_id: String,
    dependencies: Vec<String>,
    http_service: Arc<dyn HttpService>,
    logger: Arc<dyn Logger>,
}}

impl Module{module_id} {{
    pub fn new(
        http_service: Arc<dyn HttpService>,
        logger: Arc<dyn Logger>,
    ) -> Self {{
        Self {{
            module_id: format!("module-{}", {module_id}),
            dependencies: vec!["http".to_string(), "logger".to_string()],
            http_service,
            logger,
        }}
    }}

    pub async fn initialize(&self) -> Result<(), Box<dyn std::error::Error>> {{
        self.logger.info(&format!("Initializing {{}}", self.module_id));

        match self.fetch_data().await {{
            Ok(data) => {{
                self.process_data(data).await?;
                Ok(())
            }}
            Err(e) => {{
                self.logger.error(&format!("Failed to initialize {{}}: {{}}", self.module_id, e));
                Err(e)
            }}
        }}
    }}

    async fn fetch_data(&self) -> Result<ApiResponse, Box<dyn std::error::Error>> {{
        let start_time = std::time::Instant::now();
        let response = self.http_service
            .get::<ApiResponse>(&format!("/api/module-{}", {module_id}))
            .await?;
        let duration = start_time.elapsed();

        self.logger.debug(&format!("API call took {{:?}}", duration));
        Ok(response)
    }}

    async fn process_data(&self, data: ApiResponse) -> Result<(), Box<dyn std::error::Error>> {{
        let processed_data: Vec<serde_json::Value> = data.data
            .into_iter()
            .map(|mut item| {{
                let mut processed = item;
                if let Some(obj) = processed.as_object_mut() {{
                    obj.insert("processed".to_string(), serde_json::Value::Bool(true));
                    obj.insert("module".to_string(), serde_json::Value::String(self.module_id.clone()));
                    obj.insert("timestamp".to_string(), serde_json::Value::Number(
                        serde_json::Number::from(std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap()
                            .as_secs())
                    ));
                }}
                processed
            }})
            .collect();

        self.emit_data_change(processed_data).await;
        Ok(())
    }}

    async fn emit_data_change(&self, data: Vec<serde_json::Value>) -> Result<(), Box<dyn std::error::Error>> {{
        self.logger.info(&format!("Processed {{}} items in {{}}", data.len(), self.module_id));
        Ok(())
    }}

    pub fn validate_input(&self, input: &serde_json::Value) -> bool {{
        input.is_object()
    }}

    pub fn format_output(&self, data: &[serde_json::Value]) -> Result<String, serde_json::Error> {{
        serde_json::to_string_pretty(data)
    }}

    pub fn cleanup(&self) -> Result<(), Box<dyn std::error::Error>> {{
        self.logger.info(&format!("Cleaning up {{}}", self.module_id));
        Ok(())
    }}
}}

// Trait definitions
#[async_trait::async_trait]
pub trait HttpService: Send + Sync {{
    async fn get<T>(&self, path: &str) -> Result<T, Box<dyn std::error::Error>>
    where
        T: for<'de> Deserialize<'de>;
}}

#[async_trait::async_trait]
pub trait Logger: Send + Sync {{
    fn info(&self, message: &str);
    fn debug(&self, message: &str);
    fn error(&self, message: &str);
}}
"#, module_id),

        "python" => format!(r#"
"""
Module {} - Python
"""

import asyncio
import json
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
import aiohttp

@dataclass
class ApiResponse:
    """API response data structure."""
    id: str
    name: str
    data: List[Dict[str, Any]]
    timestamp: int

class Module{module_id}:
    """Module {module_id} component class."""

    def __init__(self, http_service: 'HttpService', logger: logging.Logger):
        self.module_id = f"module-{module_id}"
        self.dependencies = ["http", "logger"]
        self.http_service = http_service
        self.logger = logger

    async def initialize(self) -> None:
        """Initialize the module."""
        self.logger.info(f"Initializing {{self.module_id}}")
        try:
            data = await self.fetch_data()
            await self.process_data(data)
        except Exception as error:
            self.logger.error(f"Failed to initialize {{self.module_id}}: {{error}}")
            raise

    async def fetch_data(self) -> ApiResponse:
        """Fetch data from API."""
        start_time = asyncio.get_event_loop().time()
        response = await self.http_service.get(f"/api/module-{module_id}")
        duration = (asyncio.get_event_loop().time() - start_time) * 1000

        self.logger.debug(f"API call took {{duration:.2f}}ms")

        # Convert response dict to ApiResponse
        return ApiResponse(**response)

    async def process_data(self, data: ApiResponse) -> None:
        """Process the fetched data."""
        processed_data = []
        for item in data.data:
            processed_item = item.copy()
            processed_item.update({{
                'processed': True,
                'module': self.module_id,
                'timestamp': int(datetime.now().timestamp() * 1000)
            }})
            processed_data.append(processed_item)

        await self.emit_data_change(processed_data)

    async def emit_data_change(self, data: List[Dict[str, Any]]) -> None:
        """Emit data change event."""
        self.logger.info(f"Processed {{len(data)}} items in {{self.module_id}}")

    def validate_input(self, input_data: Any) -> bool:
        """Validate input data."""
        return input_data is not None and isinstance(input_data, dict)

    def format_output(self, data: List[Dict[str, Any]]) -> str:
        """Format output data as JSON."""
        return json.dumps(data, indent=2)

    def cleanup(self) -> None:
        """Cleanup module resources."""
        self.logger.info(f"Cleaning up {{self.module_id}}")

class HttpService:
    """HTTP service for making API calls."""

    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def get(self, path: str) -> Dict[str, Any]:
        """Make GET request."""
        if not self.session:
            raise RuntimeError("HttpService must be used as async context manager")

        url = f"{{self.base_url}}{{path}}"
        async with self.session.get(url) as response:
            response.raise_for_status()
            return await response.json()

# Utility functions
def setup_logger(name: str) -> logging.Logger:
    """Setup logger for module."""
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)

    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger

async def create_module(module_id: int) -> Module{module_id}:
    """Factory function to create module instance."""
    async with HttpService("http://localhost:3000") as http_service:
        logger = setup_logger(f"module-{{module_id}}")
        return Module{module_id}(http_service, logger)
"#, module_id),

        _ => format!("// Module {} - Generic\nfunction module_{}() {{\n    return 'Hello World';\n}}\n", module_id, module_id),
    }
}

fn generate_package_json() -> String {
    r#"{
  "name": "test-project",
  "version": "1.0.0",
  "description": "Test project for benchmarking",
  "main": "index.js",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src/**/*.ts"
  },
  "dependencies": {
    "express": "^4.18.0",
    "lodash": "^4.17.21",
    "axios": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^18.0.0",
    "typescript": "^4.9.0",
    "jest": "^29.0.0"
  }
}
"#.to_string()
}

fn generate_tsconfig_json() -> String {
    r#"{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
"#.to_string()
}

/// Create test project with specified parameters
fn create_test_project(language: &str, files_per_dir: usize, dirs: usize) -> TempDir {
    let temp_dir = TempDir::new().unwrap();
    generate_test_project_structure(temp_dir.path(), language, files_per_dir, dirs);
    temp_dir
}

/// Benchmark single file indexing performance
fn bench_single_file_indexing(c: &mut Criterion) {
    let mut group = c.benchmark_group("single_file_indexing");
    group.measurement_time(Duration::from_secs(8));
    group.sample_size(100);

    let languages = ["typescript", "rust", "python"];
    let file_sizes = [1, 5, 10, 25]; // KB

    for &language in &languages {
        for &size_kb in &file_sizes {
            let temp_dir = create_test_project(language, 1, 1);
            let file_path = temp_dir.path().join(format!("src0/module_0.{}",
                match language { "typescript" => "ts", "rust" => "rs", "python" => "py", _ => "txt" }));

            let file_size = std::fs::metadata(&file_path).unwrap().len();
            group.throughput(Throughput::Bytes(file_size));

            group.bench_with_input(
                BenchmarkId::new(language, size_kb),
                size_kb,
                |b, _| {
                    let rt = Runtime::new().unwrap();
                    b.to_async(&rt).iter(|| async {
                        let indexer = Indexer::new(IndexConfig::default()).await.unwrap();
                        let storage = Storage::new(StorageConfig::memory()).await.unwrap();

                        let codebase = Codebase {
                            id: uuid::Uuid::new_v4().to_string(),
                            name: "test".to_string(),
                            path: temp_dir.path().to_str().unwrap().to_string(),
                            language: language.to_string(),
                            created_at: chrono::Utc::now(),
                            updated_at: chrono::Utc::now(),
                        };

                        let result = indexer.index_file(
                            black_box(&file_path),
                            black_box(&codebase),
                            black_box(&storage)
                        ).await;

                        black_box(result)
                    });
                },
            );
        }
    }

    group.finish();
}

/// Benchmark project indexing scalability
fn bench_project_indexing(c: &mut Criterion) {
    let mut group = c.benchmark_group("project_indexing");
    group.measurement_time(Duration::from_secs(15));
    group.sample_size(20);

    let project_sizes = [(10, 2), (50, 5), (100, 10), (500, 20)]; // (files_per_dir, dirs)
    let language = "typescript";

    for &(files_per_dir, dirs) in &project_sizes {
        let total_files = files_per_dir * dirs;
        let temp_dir = create_test_project(language, files_per_dir, dirs);

        group.bench_with_input(
            BenchmarkId::new("full_project", total_files),
            total_files,
            |b, _| {
                let rt = Runtime::new().unwrap();
                b.to_async(&rt).iter(|| async {
                    let indexer = Indexer::new(IndexConfig::default()).await.unwrap();
                    let storage = Storage::new(StorageConfig::memory()).await.unwrap();

                    let codebase = Codebase {
                        id: uuid::Uuid::new_v4().to_string(),
                        name: "test".to_string(),
                        path: temp_dir.path().to_str().unwrap().to_string(),
                        language: language.to_string(),
                        created_at: chrono::Utc::now(),
                        updated_at: chrono::Utc::now(),
                    };

                    let result = indexer.index_project(
                        black_box(temp_dir.path()),
                        black_box(&codebase),
                        black_box(&storage)
                    ).await;

                    black_box(result)
                });
            },
        );
    }

    group.finish();
}

/// Benchmark memory usage during indexing
fn bench_memory_indexing(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_indexing");
    group.measurement_time(Duration::from_secs(10));
    group.sample_size(30);

    let project_sizes = [50, 100, 250, 500]; // Total files
    let language = "typescript";

    for &total_files in &project_sizes {
        let files_per_dir = 10;
        let dirs = total_files / files_per_dir;
        let temp_dir = create_test_project(language, files_per_dir, dirs);

        group.bench_with_input(
            BenchmarkId::new("memory_intensive", total_files),
            total_files,
            |b, _| {
                let rt = Runtime::new().unwrap();
                b.to_async(&rt).iter(|| async {
                    let indexer = Indexer::new(IndexConfig::default()).await.unwrap();
                    let storage = Storage::new(StorageConfig::memory()).await.unwrap();

                    let codebase = Codebase {
                        id: uuid::Uuid::new_v4().to_string(),
                        name: "test".to_string(),
                        path: temp_dir.path().to_str().unwrap().to_string(),
                        language: language.to_string(),
                        created_at: chrono::Utc::now(),
                        updated_at: chrono::Utc::now(),
                    };

                    // Simulate memory-intensive indexing with entity extraction
                    let result = indexer.index_project_with_entities(
                        black_box(temp_dir.path()),
                        black_box(&codebase),
                        black_box(&storage)
                    ).await;

                    // Extract entities to increase memory usage
                    if let Ok(index) = result {
                        let entities = storage.get_entities_by_codebase(&codebase.id).await.unwrap();
                        black_box(entities)
                    }

                    black_box(result)
                });
            },
        );
    }

    group.finish();
}

/// Benchmark concurrent indexing efficiency
fn bench_concurrent_indexing(c: &mut Criterion) {
    let mut group = c.benchmark_group("concurrent_indexing");
    group.measurement_time(Duration::from_secs(12));
    group.sample_size(20);

    let files_per_dir = 20;
    let dirs = 10;
    let temp_dir = create_test_project("typescript", files_per_dir, dirs);

    // Collect file paths once
    let file_paths: Vec<_> = WalkDir::new(temp_dir.path())
        .into_iter()
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_file())
        .map(|e| e.path().to_path_buf())
        .collect();

    // Sequential indexing baseline
    group.bench_function("sequential", |b| {
        let rt = Runtime::new().unwrap();
        b.to_async(&rt).iter(|| async {
            let indexer = Arc::new(Indexer::new(IndexConfig::default()).await.unwrap());
            let storage = Arc::new(Storage::new(StorageConfig::memory()).await.unwrap());

            let codebase = Codebase {
                id: uuid::Uuid::new_v4().to_string(),
                name: "test".to_string(),
                path: temp_dir.path().to_str().unwrap().to_string(),
                language: "typescript".to_string(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            };

            let mut results = Vec::new();
            for file_path in &file_paths {
                let result = indexer.index_file(file_path, &codebase, &*storage).await;
                results.push(result);
            }

            black_box(results)
        });
    });

    // Concurrent indexing with tokio tasks
    group.bench_function("concurrent_tokio", |b| {
        let rt = Runtime::new().unwrap();
        b.to_async(&rt).iter(|| async {
            let indexer = Arc::new(Indexer::new(IndexConfig::default()).await.unwrap());
            let storage = Arc::new(Storage::new(StorageConfig::memory()).await.unwrap());

            let codebase = Codebase {
                id: uuid::Uuid::new_v4().to_string(),
                name: "test".to_string(),
                path: temp_dir.path().to_str().unwrap().to_string(),
                language: "typescript".to_string(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            };

            let mut tasks = Vec::new();
            for file_path in &file_paths {
                let indexer = Arc::clone(&indexer);
                let storage = Arc::clone(&storage);
                let codebase = codebase.clone();
                let file_path = file_path.clone();

                let task = tokio::spawn(async move {
                    indexer.index_file(&file_path, &codebase, &*storage).await
                });
                tasks.push(task);
            }

            let mut results = Vec::new();
            for task in tasks {
                results.push(task.await.unwrap());
            }

            black_box(results)
        });
    });

    group.finish();
}

/// Benchmark index update performance
fn bench_index_updates(c: &mut Criterion) {
    let mut group = c.benchmark_group("index_updates");
    group.measurement_time(Duration::from_secs(8));
    group.sample_size(50);

    let temp_dir = create_test_project("typescript", 10, 5);
    let language = "typescript";

    group.bench_function("incremental_update", |b| {
        let rt = Runtime::new().unwrap();
        b.to_async(&rt).iter(|| async {
            let indexer = Indexer::new(IndexConfig::default()).await.unwrap();
            let storage = Storage::new(StorageConfig::memory()).await.unwrap();

            let codebase = Codebase {
                id: uuid::Uuid::new_v4().to_string(),
                name: "test".to_string(),
                path: temp_dir.path().to_str().unwrap().to_string(),
                language: language.to_string(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            };

            // Initial indexing
            let _initial = indexer.index_project(temp_dir.path(), &codebase, &storage).await.unwrap();

            // Simulate file modification and incremental update
            let file_path = temp_dir.path().join("src0/module_0.ts");
            let modified_code = generate_module_code(language, 999); // Different content
            std::fs::write(&file_path, modified_code).unwrap();

            let result = indexer.update_index(
                black_box(&file_path),
                black_box(&codebase),
                black_box(&storage)
            ).await;

            black_box(result)
        });
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_single_file_indexing,
    bench_project_indexing,
    bench_memory_indexing,
    bench_concurrent_indexing,
    bench_index_updates
);
criterion_main!(benches);