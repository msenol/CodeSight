use crate::{Result, Error};
use crate::models::{CodeMetric, MetricType, MetricThreshold, MetricSummary, MetricIssue, IssueSeverity};
use serde::{Deserialize, Serialize};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsConfig {
    pub enabled_metrics: Vec<MetricType>,
    pub thresholds: Vec<MetricThreshold>,
    pub calculation_mode: CalculationMode,
    pub cache_results: bool,
    pub cache_ttl_hours: u32,
    pub enable_trending: bool,
    pub trend_period_days: u32,
    pub custom_calculators: Vec<CustomMetricCalculator>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CalculationMode {
    /// Calculate metrics for individual files
    PerFile,
    /// Calculate aggregate metrics for directories
    PerDirectory,
    /// Calculate metrics for entire codebase
    WholeCodebase,
    /// All of the above
    Comprehensive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomMetricCalculator {
    pub id: String,
    pub name: String,
    pub description: String,
    pub metric_type: MetricType,
    pub calculation_script: String, // Could be JavaScript, Python, etc.
    pub dependencies: Vec<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsReport {
    pub id: String,
    pub codebase_id: String,
    pub generated_at: DateTime<Utc>,
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
    pub summary: MetricsSummary,
    pub file_metrics: Vec<FileMetrics>,
    pub directory_metrics: Vec<DirectoryMetrics>,
    pub trend_analysis: Option<TrendAnalysis>,
    pub recommendations: Vec<Recommendation>,
    pub benchmark_comparison: Option<BenchmarkComparison>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsSummary {
    pub total_files: u64,
    pub total_lines: u64,
    pub total_entities: u64,
    pub average_complexity: f64,
    pub maintainability_score: f64,
    pub test_coverage_percentage: f64,
    pub technical_debt_hours: f64,
    pub code_quality_grade: Grade,
    pub metrics_by_type: HashMap<MetricType, MetricStatistics>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricStatistics {
    pub count: u64,
    pub minimum: f64,
    pub maximum: f64,
    pub average: f64,
    pub median: f64,
    pub standard_deviation: f64,
    pub percentile_95: f64,
    pub percentile_99: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetrics {
    pub file_path: String,
    pub file_size_bytes: u64,
    pub lines_of_code: u32,
    pub lines_of_comments: u32,
    pub blank_lines: u32,
    pub entities_count: u32,
    pub metrics: Vec<CodeMetric>,
    pub overall_score: f64,
    pub issues: Vec<MetricIssue>,
    pub last_modified: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectoryMetrics {
    pub directory_path: String,
    pub file_count: u32,
    pub total_lines: u64,
    pub total_entities: u64,
    pub average_metrics: HashMap<MetricType, f64>,
    pub worst_files: Vec<String>, // Files with lowest scores
    pub best_files: Vec<String>,  // Files with highest scores
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendAnalysis {
    pub period_days: u32,
    pub metrics_trends: HashMap<MetricType, TrendData>,
    pub overall_trend: TrendDirection,
    pub significant_changes: Vec<TrendChange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendData {
    pub direction: TrendDirection,
    pub magnitude: f64, // Percentage change
    pub confidence: f64, // Statistical confidence 0-1
    pub data_points: Vec<DataPoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataPoint {
    pub timestamp: DateTime<Utc>,
    pub value: f64,
    pub context: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TrendDirection {
    Improving,
    Degrading,
    Stable,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendChange {
    pub metric_type: MetricType,
    pub change_date: DateTime<Utc>,
    pub previous_value: f64,
    pub new_value: f64,
    pub magnitude: f64,
    pub possible_causes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recommendation {
    pub id: String,
    pub priority: Priority,
    pub category: RecommendationCategory,
    pub title: String,
    pub description: String,
    pub affected_files: Vec<String>,
    pub estimated_effort: EffortEstimate,
    pub impact_assessment: ImpactAssessment,
    pub action_steps: Vec<String>,
    pub resources: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Priority {
    Critical,
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecommendationCategory {
    Complexity,
    Testing,
    Documentation,
    Refactoring,
    Security,
    Performance,
    Maintainability,
    Standards,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffortEstimate {
    pub hours_min: u32,
    pub hours_max: u32,
    pub confidence: f64,
    pub factors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImpactAssessment {
    pub quality_improvement: f64, // 0-1
    pub maintainability_improvement: f64,
    pub risk_reduction: f64,
    pub developer_productivity_gain: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkComparison {
    pub industry_benchmarks: HashMap<MetricType, BenchmarkData>,
    pub peer_comparison: Option<PeerComparison>,
    pub historical_comparison: HistoricalComparison,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkData {
    pub industry_average: f64,
    pub industry_best: f64,
    pub percentile_25: f64,
    pub percentile_75: f64,
    pub source: String,
    pub last_updated: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerComparison {
    pub similar_projects: Vec<ProjectMetric>,
    pub your_percentile: f64,
    pub competitive_advantages: Vec<String>,
    pub improvement_areas: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMetric {
    pub project_name: String,
    pub metric_value: f64,
    pub project_size: ProjectSize,
    pub industry: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProjectSize {
    Small,   // < 10K LOC
    Medium,  // 10K-100K LOC
    Large,   // 100K-1M LOC
    Enterprise, // > 1M LOC
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoricalComparison {
    pub previous_period_data: Vec<HistoricalDataPoint>,
    pub improvements_made: Vec<String>,
    pub regressions_detected: Vec<String>,
    pub trend_stability: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoricalDataPoint {
    pub timestamp: DateTime<Utc>,
    pub metric_type: MetricType,
    pub value: f64,
    pub context: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[repr(u8)]
pub enum Grade {
    A = 1, // Excellent (90-100)
    B = 2, // Good (80-89)
    C = 3, // Average (70-79)
    D = 4, // Below Average (60-69)
    F = 5, // Poor (< 60)
}

impl Grade {
    pub fn from_score(score: f64) -> Self {
        match score {
            s if s >= 90.0 => Grade::A,
            s if s >= 80.0 => Grade::B,
            s if s >= 70.0 => Grade::C,
            s if s >= 60.0 => Grade::D,
            _ => Grade::F,
        }
    }

    pub fn score(&self) -> f64 {
        match self {
            Grade::A => 95.0,
            Grade::B => 85.0,
            Grade::C => 75.0,
            Grade::D => 65.0,
            Grade::F => 50.0,
        }
    }

    pub fn letter(&self) -> char {
        match self {
            Grade::A => 'A',
            Grade::B => 'B',
            Grade::C => 'C',
            Grade::D => 'D',
            Grade::F => 'F',
        }
    }
}

#[async_trait]
pub trait MetricsService: Send + Sync {
    /// Initialize the metrics service with configuration
    async fn initialize(&mut self, config: MetricsConfig) -> Result<()>;

    /// Calculate metrics for a single file
    async fn calculate_file_metrics(&self, file_path: &str) -> Result<FileMetrics>;

    /// Calculate metrics for a directory
    async fn calculate_directory_metrics(&self, directory_path: &str) -> Result<DirectoryMetrics>;

    /// Generate comprehensive metrics report
    async fn generate_report(&self, codebase_id: &str, period_days: u32) -> Result<MetricsReport>;

    /// Get historical metrics data
    async fn get_historical_metrics(&self, codebase_id: &str, metric_type: MetricType, days: u32) -> Result<Vec<DataPoint>>;

    /// Get metrics trends
    async fn get_metrics_trends(&self, codebase_id: &str, days: u32) -> Result<TrendAnalysis>;

    /// Get recommendations based on metrics
    async fn get_recommendations(&self, codebase_id: &str) -> Result<Vec<Recommendation>>;

    /// Compare metrics with benchmarks
    async fn benchmark_comparison(&self, codebase_id: &str) -> Result<BenchmarkComparison>;

    /// Store metrics for historical tracking
    async fn store_metrics(&self, codebase_id: &str, metrics: &[CodeMetric]) -> Result<()>;

    /// Get metrics summary
    async fn get_metrics_summary(&self, codebase_id: &str) -> Result<MetricsSummary>;

    /// Validate metrics configuration
    fn validate_config(&self, config: &MetricsConfig) -> Result<()>;
}

pub struct DefaultMetricsService {
    config: Option<MetricsConfig>,
    metrics_cache: HashMap<String, FileMetrics>,
    benchmarks: HashMap<MetricType, BenchmarkData>,
}

impl DefaultMetricsService {
    pub fn new() -> Self {
        Self {
            config: None,
            metrics_cache: HashMap::new(),
            benchmarks: Self::load_default_benchmarks(),
        }
    }

    fn load_default_benchmarks() -> HashMap<MetricType, BenchmarkData> {
        let mut benchmarks = HashMap::new();

        // Industry benchmarks for various metrics
        benchmarks.insert(MetricType::CyclomaticComplexity, BenchmarkData {
            industry_average: 10.0,
            industry_best: 3.0,
            percentile_25: 5.0,
            percentile_75: 15.0,
            source: "Software Engineering Institute".to_string(),
            last_updated: Utc::now(),
        });

        benchmarks.insert(MetricType::MaintainabilityIndex, BenchmarkData {
            industry_average: 70.0,
            industry_best: 90.0,
            percentile_25: 60.0,
            percentile_75: 80.0,
            source: "Microsoft DevLabs".to_string(),
            last_updated: Utc::now(),
        });

        benchmarks.insert(MetricType::TestCoverage, BenchmarkData {
            industry_average: 80.0,
            industry_best: 95.0,
            percentile_25: 70.0,
            percentile_75: 90.0,
            source: "Code Climate".to_string(),
            last_updated: Utc::now(),
        });

        benchmarks
    }

    fn calculate_cyclomatic_complexity(&self, content: &str) -> f64 {
        let mut complexity = 1.0; // Base complexity
        
        // Count decision points
        complexity += content.matches("if").count() as f64;
        complexity += content.matches("else").count() as f64;
        complexity += content.matches("for").count() as f64;
        complexity += content.matches("while").count() as f64;
        complexity += content.matches("do").count() as f64;
        complexity += content.matches("switch").count() as f64;
        complexity += content.matches("case").count() as f64;
        complexity += content.matches("catch").count() as f64;
        complexity += content.matches("&&").count() as f64;
        complexity += content.matches("||").count() as f64;

        complexity
    }

    fn calculate_maintainability_index(&self, complexity: f64, loc: u32, comments: u32) -> f64 {
        let volume = loc as f64 * 2.0f64.log2();
        let comment_ratio = if loc > 0 { comments as f64 / loc as f64 } else { 0.0 };
        
        // Maintainability Index formula (simplified)
        let mi = 171.0 
            - 5.2 * volume.ln()
            - 0.23 * complexity
            - 16.2 * volume.ln()
            + 50.0 * comment_ratio.sqrt();

        mi.max(0.0).min(100.0)
    }

    fn calculate_test_coverage(&self, _content: &str) -> f64 {
        // This would require test execution coverage data
        // For now, return a placeholder
        75.0
    }

    fn calculate_technical_debt(&self, complexity: f64, loc: u32, issues: &[MetricIssue]) -> f64 {
        let base_debt = complexity * 0.5; // Hours per complexity point
        let loc_debt = loc as f64 * 0.01; // 0.01 hours per line of code
        let issue_debt = issues.len() as f64 * 2.0; // 2 hours per issue
        
        base_debt + loc_debt + issue_debt
    }

    fn generate_recommendations(&self, file_metrics: &[FileMetrics]) -> Vec<Recommendation> {
        let mut recommendations = Vec::new();

        // Analyze all files for common issues
        let high_complexity_files: Vec<_> = file_metrics
            .iter()
            .filter(|f| {
                f.metrics
                    .iter()
                    .any(|m| matches!(m.metric_type, MetricType::CyclomaticComplexity) && m.value > 15.0)
            })
            .collect();

        if !high_complexity_files.is_empty() {
            recommendations.push(Recommendation {
                id: "refactor-complexity".to_string(),
                priority: Priority::High,
                category: RecommendationCategory::Complexity,
                title: "Reduce Cyclomatic Complexity".to_string(),
                description: format!(
                    "Found {} files with high cyclomatic complexity (>15). Consider refactoring these files to improve maintainability.",
                    high_complexity_files.len()
                ),
                affected_files: high_complexity_files.iter().map(|f| f.file_path.clone()).collect(),
                estimated_effort: EffortEstimate {
                    hours_min: 8,
                    hours_max: 40,
                    confidence: 0.7,
                    factors: vec!["File size".to_string(), "Complexity level".to_string()],
                },
                impact_assessment: ImpactAssessment {
                    quality_improvement: 0.8,
                    maintainability_improvement: 0.9,
                    risk_reduction: 0.6,
                    developer_productivity_gain: 0.7,
                },
                action_steps: vec![
                    "Extract complex methods into smaller functions".to_string(),
                    "Use design patterns to simplify control flow".to_string(),
                    "Consider state machines for complex state logic".to_string(),
                    "Add unit tests before refactoring".to_string(),
                ],
                resources: vec![
                    "Refactoring: Improving the Design of Existing Code".to_string(),
                    "Clean Code: A Handbook of Agile Software Craftsmanship".to_string(),
                ],
            });
        }

        // Add more recommendation types based on other metrics
        recommendations
    }
}

#[async_trait]
impl MetricsService for DefaultMetricsService {
    async fn initialize(&mut self, config: MetricsConfig) -> Result<()> {
        self.validate_config(&config)?;
        self.config = Some(config);
        Ok(())
    }

    async fn calculate_file_metrics(&self, file_path: &str) -> Result<FileMetrics> {
        // Check cache first
        if let Some(cached) = self.metrics_cache.get(file_path) {
            return Ok(cached.clone());
        }

        let content = std::fs::read_to_string(file_path)
            .map_err(|e| Error::msg(format!("Failed to read file: {}", e)))?;

        let metadata = std::fs::metadata(file_path)
            .map_err(|e| Error::msg(format!("Failed to read file metadata: {}", e)))?;

        let lines: Vec<&str> = content.lines().collect();
        let total_lines = lines.len() as u32;
        let comment_lines = lines.iter()
            .filter(|line| line.trim().starts_with("//") || line.trim().starts_with("/*") || line.trim().starts_with("*"))
            .count() as u32;
        let blank_lines = lines.iter()
            .filter(|line| line.trim().is_empty())
            .count() as u32;
        let code_lines = total_lines - comment_lines - blank_lines;

        // Calculate metrics
        let complexity = self.calculate_cyclomatic_complexity(&content);
        let maintainability = self.calculate_maintainability_index(complexity, total_lines, comment_lines);
        let test_coverage = self.calculate_test_coverage(&content);

        let mut metrics = Vec::new();
        
        metrics.push(CodeMetric::new(
            format!("metric-{}-complexity", file_path),
            format!("file-{}", file_path),
            "file".to_string(),
            file_path.to_string(),
            MetricType::CyclomaticComplexity,
            complexity,
            "count".to_string(),
        ));

        metrics.push(CodeMetric::new(
            format!("metric-{}-maintainability", file_path),
            format!("file-{}", file_path),
            "file".to_string(),
            file_path.to_string(),
            MetricType::MaintainabilityIndex,
            maintainability,
            "score".to_string(),
        ));

        metrics.push(CodeMetric::new(
            format!("metric-{}-coverage", file_path),
            format!("file-{}", file_path),
            "file".to_string(),
            file_path.to_string(),
            MetricType::TestCoverage,
            test_coverage,
            "percentage".to_string(),
        ));

        // Generate issues based on thresholds
        let thresholds = MetricThreshold::standard_defaults();
        let mut issues = Vec::new();

        for metric in &metrics {
            for threshold in &thresholds {
                if matches!(metric.metric_type, threshold.metric_type) {
                    if metric.value > threshold.error_threshold {
                        issues.push(MetricIssue {
                            metric_type: metric.metric_type.clone(),
                            severity: IssueSeverity::Error,
                            value: metric.value,
                            threshold: threshold.error_threshold,
                            message: format!(
                                "{} exceeds error threshold: {:.2} > {:.2} {}",
                                format!("{:?}", metric.metric_type),
                                metric.value,
                                threshold.error_threshold,
                                threshold.unit
                            ),
                            suggestion: self.get_suggestion_for_metric(&metric.metric_type),
                        });
                    } else if metric.value > threshold.warning_threshold {
                        issues.push(MetricIssue {
                            metric_type: metric.metric_type.clone(),
                            severity: IssueSeverity::Warning,
                            value: metric.value,
                            threshold: threshold.warning_threshold,
                            message: format!(
                                "{} exceeds warning threshold: {:.2} > {:.2} {}",
                                format!("{:?}", metric.metric_type),
                                metric.value,
                                threshold.warning_threshold,
                                threshold.unit
                            ),
                            suggestion: self.get_suggestion_for_metric(&metric.metric_type),
                        });
                    }
                }
            }
        }

        let technical_debt = self.calculate_technical_debt(complexity, total_lines, &issues);
        
        metrics.push(CodeMetric::new(
            format!("metric-{}-debt", file_path),
            format!("file-{}", file_path),
            "file".to_string(),
            file_path.to_string(),
            MetricType::TechnicalDebt,
            technical_debt,
            "hours".to_string(),
        ));

        let overall_score = self.calculate_overall_score(&metrics, &thresholds);

        let file_metrics = FileMetrics {
            file_path: file_path.to_string(),
            file_size_bytes: metadata.len(),
            lines_of_code: code_lines,
            lines_of_comments: comment_lines,
            blank_lines,
            entities_count: 0, // Would need entity parsing to calculate
            metrics,
            overall_score,
            issues,
            last_modified: metadata.modified()
                .map_err(|e| Error::msg(format!("Failed to get modification time: {}", e)))?
                .into(),
        };

        Ok(file_metrics)
    }

    async fn calculate_directory_metrics(&self, directory_path: &str) -> Result<DirectoryMetrics> {
        let mut file_count = 0;
        let mut total_lines = 0;
        let mut total_entities = 0;
        let mut file_scores = Vec::new();
        let mut average_metrics: HashMap<MetricType, Vec<f64>> = HashMap::new();

        // Walk through directory
        for entry in walkdir::WalkDir::new(directory_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            let file_path = entry.path().to_string_lossy().to_string();
            
            // Only process source code files
            if self.is_source_code_file(&file_path) {
                if let Ok(file_metrics) = self.calculate_file_metrics(&file_path).await {
                    file_count += 1;
                    total_lines += file_metrics.lines_of_code as u64;
                    total_entities += file_metrics.entities_count as u64;
                    file_scores.push((file_metrics.file_path.clone(), file_metrics.overall_score));

                    // Collect metric values for averaging
                    for metric in &file_metrics.metrics {
                        average_metrics
                            .entry(metric.metric_type.clone())
                            .or_insert_with(Vec::new)
                            .push(metric.value);
                    }
                }
            }
        }

        // Calculate averages
        let mut average_final: HashMap<MetricType, f64> = HashMap::new();
        for (metric_type, values) in average_metrics {
            if !values.is_empty() {
                let sum: f64 = values.iter().sum();
                let count = values.len() as f64;
                average_final.insert(metric_type, sum / count);
            }
        }

        // Sort files by score
        file_scores.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
        let worst_files = file_scores.iter().take(10).map(|(path, _)| path.clone()).collect();
        let best_files = file_scores.iter().rev().take(10).map(|(path, _)| path.clone()).collect();

        Ok(DirectoryMetrics {
            directory_path: directory_path.to_string(),
            file_count,
            total_lines,
            total_entities,
            average_metrics: average_final,
            worst_files,
            best_files,
        })
    }

    async fn generate_report(&self, codebase_id: &str, period_days: u32) -> Result<MetricsReport> {
        // This would typically scan the entire codebase
        // For now, return a placeholder report
        let now = Utc::now();
        let period_start = now - chrono::Duration::days(period_days as i64);

        Ok(MetricsReport {
            id: uuid::Uuid::new_v4().to_string(),
            codebase_id: codebase_id.to_string(),
            generated_at: now,
            period_start,
            period_end: now,
            summary: MetricsSummary {
                total_files: 0,
                total_lines: 0,
                total_entities: 0,
                average_complexity: 0.0,
                maintainability_score: 0.0,
                test_coverage_percentage: 0.0,
                technical_debt_hours: 0.0,
                code_quality_grade: Grade::C,
                metrics_by_type: HashMap::new(),
            },
            file_metrics: Vec::new(),
            directory_metrics: Vec::new(),
            trend_analysis: None,
            recommendations: Vec::new(),
            benchmark_comparison: None,
        })
    }

    async fn get_historical_metrics(&self, _codebase_id: &str, _metric_type: MetricType, _days: u32) -> Result<Vec<DataPoint>> {
        // This would typically fetch from a database
        Ok(Vec::new())
    }

    async fn get_metrics_trends(&self, _codebase_id: &str, _days: u32) -> Result<TrendAnalysis> {
        // This would analyze historical data
        Ok(TrendAnalysis {
            period_days: 30,
            metrics_trends: HashMap::new(),
            overall_trend: TrendDirection::Stable,
            significant_changes: Vec::new(),
        })
    }

    async fn get_recommendations(&self, codebase_id: &str) -> Result<Vec<Recommendation>> {
        // Generate recommendations based on codebase metrics
        // For now, return empty recommendations
        Ok(Vec::new())
    }

    async fn benchmark_comparison(&self, _codebase_id: &str) -> Result<BenchmarkComparison> {
        Ok(BenchmarkComparison {
            industry_benchmarks: self.benchmarks.clone(),
            peer_comparison: None,
            historical_comparison: HistoricalComparison {
                previous_period_data: Vec::new(),
                improvements_made: Vec::new(),
                regressions_detected: Vec::new(),
                trend_stability: 0.8,
            },
        })
    }

    async fn store_metrics(&self, _codebase_id: &str, _metrics: &[CodeMetric]) -> Result<()> {
        // This would typically store in a database
        Ok(())
    }

    async fn get_metrics_summary(&self, _codebase_id: &str) -> Result<MetricsSummary> {
        // This would aggregate metrics across the codebase
        Ok(MetricsSummary {
            total_files: 0,
            total_lines: 0,
            total_entities: 0,
            average_complexity: 0.0,
            maintainability_score: 0.0,
            test_coverage_percentage: 0.0,
            technical_debt_hours: 0.0,
            code_quality_grade: Grade::C,
            metrics_by_type: HashMap::new(),
        })
    }

    fn validate_config(&self, config: &MetricsConfig) -> Result<()> {
        if config.enabled_metrics.is_empty() {
            return Err(Error::msg("At least one metric must be enabled"));
        }

        if config.cache_ttl_hours == 0 {
            return Err(Error::msg("Cache TTL must be greater than 0"));
        }

        Ok(())
    }
}

impl DefaultMetricsService {
    fn is_source_code_file(&self, file_path: &str) -> bool {
        let extensions = [".js", ".ts", ".py", ".rs", ".cpp", ".hpp", ".c", ".h", ".java", ".go"];
        let path = Path::new(file_path);
        
        path.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| extensions.contains(&ext))
            .unwrap_or(false)
    }

    fn calculate_overall_score(&self, metrics: &[CodeMetric], thresholds: &[MetricThreshold]) -> f64 {
        if metrics.is_empty() {
            return 0.0;
        }

        let mut total_score = 0.0;
        let mut weight_sum = 0.0;

        for metric in metrics {
            let threshold = thresholds.iter()
                .find(|t| matches!(metric.metric_type, t.metric_type));
            
            if let Some(threshold) = threshold {
                let weight = match metric.metric_type {
                    MetricType::MaintainabilityIndex | MetricType::TestCoverage => 2.0,
                    MetricType::CyclomaticComplexity => 1.5,
                    _ => 1.0,
                };

                let normalized_score = self.normalize_metric_score(metric, threshold);
                total_score += normalized_score * weight;
                weight_sum += weight;
            }
        }

        if weight_sum > 0.0 {
            total_score / weight_sum
        } else {
            0.0
        }
    }

    fn normalize_metric_score(&self, metric: &CodeMetric, threshold: &MetricThreshold) -> f64 {
        match metric.metric_type {
            MetricType::MaintainabilityIndex | MetricType::TestCoverage => {
                // Higher is better
                if metric.value >= threshold.warning_threshold {
                    100.0
                } else if metric.value >= threshold.error_threshold {
                    70.0
                } else {
                    30.0
                }
            },
            _ => {
                // Lower is better (complexity metrics)
                if metric.value <= threshold.warning_threshold {
                    100.0
                } else if metric.value <= threshold.error_threshold {
                    70.0
                } else {
                    30.0
                }
            }
        }
    }

    fn get_suggestion_for_metric(&self, metric_type: &MetricType) -> Option<String> {
        match metric_type {
            MetricType::CyclomaticComplexity => Some(
                "Consider breaking down complex functions into smaller, more focused functions.".to_string()
            ),
            MetricType::MaintainabilityIndex => Some(
                "Refactor code to improve structure and reduce complexity.".to_string()
            ),
            MetricType::TestCoverage => Some(
                "Add unit tests to increase code coverage and ensure reliability.".to_string()
            ),
            MetricType::TechnicalDebt => Some(
                "Address technical debt items to improve code quality and maintainability.".to_string()
            ),
            _ => None,
        }
    }
}

impl Default for MetricsConfig {
    fn default() -> Self {
        Self {
            enabled_metrics: vec![
                MetricType::CyclomaticComplexity,
                MetricType::MaintainabilityIndex,
                MetricType::TestCoverage,
                MetricType::TechnicalDebt,
            ],
            thresholds: MetricThreshold::standard_defaults(),
            calculation_mode: CalculationMode::Comprehensive,
            cache_results: true,
            cache_ttl_hours: 24,
            enable_trending: true,
            trend_period_days: 30,
            custom_calculators: Vec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_metrics_service_initialization() {
        let mut service = DefaultMetricsService::new();
        let config = MetricsConfig::default();

        let result = service.initialize(config).await;
        assert!(result.is_ok());
    }

    #[test]
    fn test_complexity_calculation() {
        let service = DefaultMetricsService::new();
        
        let simple_code = "function test() { return 42; }";
        assert_eq!(service.calculate_cyclomatic_complexity(simple_code), 1.0);
        
        let complex_code = "if (x) { for (let i = 0; i < 10; i++) { if (y) { doSomething(); } } }";
        assert!(service.calculate_cyclomatic_complexity(complex_code) > 1.0);
    }

    #[test]
    fn test_maintainability_index() {
        let service = DefaultMetricsService::new();
        
        let mi = service.calculate_maintainability_index(5.0, 100, 20);
        assert!(mi >= 0.0 && mi <= 100.0);
    }

    #[test]
    fn test_grade_from_score() {
        assert!(matches!(Grade::from_score(95.0), Grade::A));
        assert!(matches!(Grade::from_score(85.0), Grade::B));
        assert!(matches!(Grade::from_score(75.0), Grade::C));
        assert!(matches!(Grade::from_score(65.0), Grade::D));
        assert!(matches!(Grade::from_score(55.0), Grade::F));
    }

    #[test]
    fn test_config_validation() {
        let service = DefaultMetricsService::new();
        
        let valid_config = MetricsConfig::default();
        assert!(service.validate_config(&valid_config).is_ok());
        
        let invalid_config = MetricsConfig {
            enabled_metrics: vec![],
            ..Default::default()
        };
        assert!(service.validate_config(&invalid_config).is_err());
    }
}