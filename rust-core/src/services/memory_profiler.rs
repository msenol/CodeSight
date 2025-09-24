use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemorySnapshot {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub heap_size: usize,
    pub heap_used: usize,
    pub stack_size: usize,
    pub allocations: usize,
    pub deallocations: usize,
    pub peak_memory: usize,
    pub fragmentation_ratio: f64,
    pub gc_collections: usize,
    pub gc_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AllocationInfo {
    pub size: usize,
    pub timestamp: Instant,
    pub location: String,
    pub thread_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryLeak {
    pub allocation: AllocationInfo,
    pub age_seconds: u64,
    pub suspected_leak: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryReport {
    pub current_snapshot: MemorySnapshot,
    pub peak_usage: MemorySnapshot,
    pub average_usage: MemorySnapshot,
    pub memory_leaks: Vec<MemoryLeak>,
    pub allocation_patterns: HashMap<String, usize>,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryProfilerConfig {
    pub enable_tracking: bool,
    pub snapshot_interval_ms: u64,
    pub max_snapshots: usize,
    pub leak_detection_threshold_seconds: u64,
    pub enable_allocation_tracking: bool,
    pub max_allocations_tracked: usize,
    pub enable_stack_traces: bool,
}

impl Default for MemoryProfilerConfig {
    fn default() -> Self {
        Self {
            enable_tracking: true,
            snapshot_interval_ms: 1000, // 1 second
            max_snapshots: 1000,
            leak_detection_threshold_seconds: 300, // 5 minutes
            enable_allocation_tracking: true,
            max_allocations_tracked: 10000,
            enable_stack_traces: false, // Expensive, disabled by default
        }
    }
}

pub struct MemoryProfiler {
    config: MemoryProfilerConfig,
    snapshots: Arc<Mutex<Vec<MemorySnapshot>>>,
    allocations: Arc<Mutex<HashMap<usize, AllocationInfo>>>,
    peak_memory: Arc<Mutex<usize>>,
    total_allocations: Arc<Mutex<usize>>,
    total_deallocations: Arc<Mutex<usize>>,
    start_time: Instant,
    last_snapshot: Arc<Mutex<Option<Instant>>>,
}

impl MemoryProfiler {
    pub fn new(config: MemoryProfilerConfig) -> Self {
        Self {
            config,
            snapshots: Arc::new(Mutex::new(Vec::new())),
            allocations: Arc::new(Mutex::new(HashMap::new())),
            peak_memory: Arc::new(Mutex::new(0)),
            total_allocations: Arc::new(Mutex::new(0)),
            total_deallocations: Arc::new(Mutex::new(0)),
            start_time: Instant::now(),
            last_snapshot: Arc::new(Mutex::new(None)),
        }
    }
    
    pub fn with_default_config() -> Self {
        Self::new(MemoryProfilerConfig::default())
    }
    
    pub fn start_monitoring(&self) {
        if !self.config.enable_tracking {
            return;
        }
        
        let snapshots = Arc::clone(&self.snapshots);
        let peak_memory = Arc::clone(&self.peak_memory);
        let last_snapshot = Arc::clone(&self.last_snapshot);
        let interval = Duration::from_millis(self.config.snapshot_interval_ms);
        let max_snapshots = self.config.max_snapshots;
        
        tokio::spawn(async move {
            let mut interval_timer = tokio::time::interval(interval);
            
            loop {
                interval_timer.tick().await;
                
                let snapshot = Self::take_memory_snapshot();
                
                // Update peak memory
                {
                    let mut peak = peak_memory.lock().unwrap();
                    if snapshot.heap_used > *peak {
                        *peak = snapshot.heap_used;
                    }
                }
                
                // Store snapshot
                {
                    let mut snapshots_guard = snapshots.lock().unwrap();
                    snapshots_guard.push(snapshot);
                    
                    // Limit the number of snapshots
                    if snapshots_guard.len() > max_snapshots {
                        snapshots_guard.remove(0);
                    }
                }
                
                // Update last snapshot time
                {
                    let mut last = last_snapshot.lock().unwrap();
                    *last = Some(Instant::now());
                }
            }
        });
    }
    
    pub fn record_allocation(&self, ptr: usize, size: usize, location: &str) {
        if !self.config.enable_allocation_tracking {
            return;
        }
        
        let allocation = AllocationInfo {
            size,
            timestamp: Instant::now(),
            location: location.to_string(),
            thread_id: format!("{:?}", std::thread::current().id()),
        };
        
        {
            let mut allocations = self.allocations.lock().unwrap();
            allocations.insert(ptr, allocation);
            
            // Limit tracked allocations
            if allocations.len() > self.config.max_allocations_tracked {
                // Remove oldest allocation
                if let Some(oldest_ptr) = allocations.keys().next().copied() {
                    allocations.remove(&oldest_ptr);
                }
            }
        }
        
        {
            let mut total = self.total_allocations.lock().unwrap();
            *total += 1;
        }
    }
    
    pub fn record_deallocation(&self, ptr: usize) {
        if !self.config.enable_allocation_tracking {
            return;
        }
        
        {
            let mut allocations = self.allocations.lock().unwrap();
            allocations.remove(&ptr);
        }
        
        {
            let mut total = self.total_deallocations.lock().unwrap();
            *total += 1;
        }
    }
    
    pub fn detect_memory_leaks(&self) -> Vec<MemoryLeak> {
        let threshold = Duration::from_secs(self.config.leak_detection_threshold_seconds);
        let now = Instant::now();
        let mut leaks = Vec::new();
        
        let allocations = self.allocations.lock().unwrap();
        for (_, allocation) in allocations.iter() {
            let age = now.duration_since(allocation.timestamp);
            if age > threshold {
                leaks.push(MemoryLeak {
                    allocation: allocation.clone(),
                    age_seconds: age.as_secs(),
                    suspected_leak: age > threshold * 2, // Very old allocations are more suspicious
                });
            }
        }
        
        // Sort by age (oldest first)
        leaks.sort_by(|a, b| b.age_seconds.cmp(&a.age_seconds));
        
        leaks
    }
    
    pub fn get_allocation_patterns(&self) -> HashMap<String, usize> {
        let mut patterns = HashMap::new();
        
        let allocations = self.allocations.lock().unwrap();
        for allocation in allocations.values() {
            *patterns.entry(allocation.location.clone()).or_insert(0) += 1;
        }
        
        patterns
    }
    
    pub fn generate_report(&self) -> MemoryReport {
        let current_snapshot = Self::take_memory_snapshot();
        let snapshots = self.snapshots.lock().unwrap();
        
        let peak_usage = snapshots
            .iter()
            .max_by_key(|s| s.heap_used)
            .cloned()
            .unwrap_or_else(|| current_snapshot.clone());
        
        let average_usage = if !snapshots.is_empty() {
            let total_heap = snapshots.iter().map(|s| s.heap_used).sum::<usize>();
            let total_allocations = snapshots.iter().map(|s| s.allocations).sum::<usize>();
            let avg_heap = total_heap / snapshots.len();
            let avg_allocations = total_allocations / snapshots.len();
            
            MemorySnapshot {
                timestamp: chrono::Utc::now(),
                heap_size: current_snapshot.heap_size,
                heap_used: avg_heap,
                stack_size: current_snapshot.stack_size,
                allocations: avg_allocations,
                deallocations: current_snapshot.deallocations,
                peak_memory: peak_usage.heap_used,
                fragmentation_ratio: current_snapshot.fragmentation_ratio,
                gc_collections: current_snapshot.gc_collections,
                gc_time_ms: current_snapshot.gc_time_ms,
            }
        } else {
            current_snapshot.clone()
        };
        
        let memory_leaks = self.detect_memory_leaks();
        let allocation_patterns = self.get_allocation_patterns();
        let recommendations = self.generate_recommendations(&current_snapshot, &memory_leaks, &allocation_patterns);
        
        MemoryReport {
            current_snapshot,
            peak_usage,
            average_usage,
            memory_leaks,
            allocation_patterns,
            recommendations,
        }
    }
    
    fn generate_recommendations(
        &self,
        current: &MemorySnapshot,
        leaks: &[MemoryLeak],
        patterns: &HashMap<String, usize>,
    ) -> Vec<String> {
        let mut recommendations = Vec::new();
        
        // Memory usage recommendations
        let usage_ratio = current.heap_used as f64 / current.heap_size as f64;
        if usage_ratio > 0.8 {
            recommendations.push("High memory usage detected. Consider increasing heap size or optimizing memory usage.".to_string());
        }
        
        // Fragmentation recommendations
        if current.fragmentation_ratio > 0.3 {
            recommendations.push("High memory fragmentation detected. Consider implementing memory pooling or compaction.".to_string());
        }
        
        // Leak recommendations
        if !leaks.is_empty() {
            let suspected_leaks = leaks.iter().filter(|l| l.suspected_leak).count();
            if suspected_leaks > 0 {
                recommendations.push(format!("Detected {} potential memory leaks. Review long-lived allocations.", suspected_leaks));
            }
        }
        
        // Allocation pattern recommendations
        if let Some((location, count)) = patterns.iter().max_by_key(|(_, &count)| count) {
            if *count > 1000 {
                recommendations.push(format!("High allocation frequency at '{}' ({} allocations). Consider object pooling.", location, count));
            }
        }
        
        // GC recommendations
        if current.gc_time_ms > 100 {
            recommendations.push("High garbage collection time. Consider reducing allocation rate or tuning GC parameters.".to_string());
        }
        
        recommendations
    }
    
    fn take_memory_snapshot() -> MemorySnapshot {
        // This is a simplified implementation
        // In a real implementation, you would use platform-specific APIs
        // or integrate with memory profiling libraries like jemalloc or tcmalloc
        
        let heap_size = Self::get_heap_size();
        let heap_used = Self::get_heap_used();
        let stack_size = Self::get_stack_size();
        
        MemorySnapshot {
            timestamp: chrono::Utc::now(),
            heap_size,
            heap_used,
            stack_size,
            allocations: 0, // Would be tracked separately
            deallocations: 0, // Would be tracked separately
            peak_memory: heap_used, // Would be tracked over time
            fragmentation_ratio: Self::calculate_fragmentation_ratio(heap_size, heap_used),
            gc_collections: 0, // Platform-specific
            gc_time_ms: 0, // Platform-specific
        }
    }
    
    fn get_heap_size() -> usize {
        // Platform-specific implementation
        // This is a mock implementation
        1024 * 1024 * 1024 // 1GB
    }
    
    fn get_heap_used() -> usize {
        // Platform-specific implementation
        // This is a mock implementation
        use std::alloc::{GlobalAlloc, Layout, System};
        
        // This is a very rough estimate
        // In practice, you'd use proper memory tracking
        std::process::id() as usize * 1024 // Mock value
    }
    
    fn get_stack_size() -> usize {
        // Platform-specific implementation
        8 * 1024 * 1024 // 8MB default stack size
    }
    
    fn calculate_fragmentation_ratio(heap_size: usize, heap_used: usize) -> f64 {
        if heap_size == 0 {
            return 0.0;
        }
        
        // Simplified fragmentation calculation
        // In practice, this would analyze actual memory layout
        let free_space = heap_size - heap_used;
        let estimated_fragmented = free_space / 10; // Assume 10% of free space is fragmented
        
        estimated_fragmented as f64 / heap_size as f64
    }
    
    pub fn get_current_memory_usage(&self) -> usize {
        Self::get_heap_used()
    }
    
    pub fn get_peak_memory_usage(&self) -> usize {
        *self.peak_memory.lock().unwrap()
    }
    
    pub fn reset_statistics(&self) {
        {
            let mut snapshots = self.snapshots.lock().unwrap();
            snapshots.clear();
        }
        
        {
            let mut allocations = self.allocations.lock().unwrap();
            allocations.clear();
        }
        
        {
            let mut peak = self.peak_memory.lock().unwrap();
            *peak = 0;
        }
        
        {
            let mut total_alloc = self.total_allocations.lock().unwrap();
            *total_alloc = 0;
        }
        
        {
            let mut total_dealloc = self.total_deallocations.lock().unwrap();
            *total_dealloc = 0;
        }
    }
    
    pub fn export_snapshots(&self) -> Vec<MemorySnapshot> {
        self.snapshots.lock().unwrap().clone()
    }
    
    pub fn get_uptime(&self) -> Duration {
        self.start_time.elapsed()
    }
}

// Global memory profiler instance
lazy_static::lazy_static! {
    static ref GLOBAL_PROFILER: Arc<Mutex<Option<MemoryProfiler>>> = Arc::new(Mutex::new(None));
}

pub fn init_global_profiler(config: MemoryProfilerConfig) {
    let profiler = MemoryProfiler::new(config);
    profiler.start_monitoring();
    
    let mut global = GLOBAL_PROFILER.lock().unwrap();
    *global = Some(profiler);
}

pub fn get_global_profiler() -> Option<MemoryProfiler> {
    GLOBAL_PROFILER.lock().unwrap().clone()
}

pub fn record_allocation(ptr: usize, size: usize, location: &str) {
    if let Some(profiler) = get_global_profiler() {
        profiler.record_allocation(ptr, size, location);
    }
}

pub fn record_deallocation(ptr: usize) {
    if let Some(profiler) = get_global_profiler() {
        profiler.record_deallocation(ptr);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::time::{sleep, Duration};
    
    #[tokio::test]
    async fn test_memory_profiler_basic() {
        let config = MemoryProfilerConfig {
            snapshot_interval_ms: 100,
            max_snapshots: 10,
            ..Default::default()
        };
        
        let profiler = MemoryProfiler::new(config);
        profiler.start_monitoring();
        
        // Wait for a few snapshots
        sleep(Duration::from_millis(300)).await;
        
        let report = profiler.generate_report();
        assert!(report.current_snapshot.heap_size > 0);
    }
    
    #[test]
    fn test_allocation_tracking() {
        let profiler = MemoryProfiler::with_default_config();
        
        // Record some allocations
        profiler.record_allocation(0x1000, 1024, "test_function");
        profiler.record_allocation(0x2000, 2048, "another_function");
        
        let patterns = profiler.get_allocation_patterns();
        assert_eq!(patterns.get("test_function"), Some(&1));
        assert_eq!(patterns.get("another_function"), Some(&1));
        
        // Record deallocation
        profiler.record_deallocation(0x1000);
        
        let patterns_after = profiler.get_allocation_patterns();
        assert_eq!(patterns_after.get("test_function"), None);
        assert_eq!(patterns_after.get("another_function"), Some(&1));
    }
    
    #[test]
    fn test_memory_leak_detection() {
        let config = MemoryProfilerConfig {
            leak_detection_threshold_seconds: 1,
            ..Default::default()
        };
        
        let profiler = MemoryProfiler::new(config);
        
        // Record an allocation
        profiler.record_allocation(0x3000, 4096, "potential_leak");
        
        // Wait for threshold
        std::thread::sleep(Duration::from_secs(2));
        
        let leaks = profiler.detect_memory_leaks();
        assert!(!leaks.is_empty());
        assert_eq!(leaks[0].allocation.location, "potential_leak");
        assert!(leaks[0].age_seconds >= 1);
    }
}