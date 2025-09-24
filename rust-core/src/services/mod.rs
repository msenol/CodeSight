pub mod indexing;
pub mod search;
pub mod embedding;
pub mod query_cache;
pub mod memory_profiler;
pub mod parallel_indexer;

pub use indexing::IndexingService;
pub use search::SearchService;
pub use embedding::EmbeddingService;
pub use query_cache::{QueryCache, QueryCacheConfig, QueryCacheStats};
pub use memory_profiler::{MemoryProfiler, MemoryProfilerConfig, MemoryReport, MemorySnapshot};
pub use parallel_indexer::{ParallelIndexer, ParallelIndexerConfig, IndexingTask, TaskPriority};