use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeMetric {
    pub id: String,
    pub entity_id: String,
    pub entity_type: String,
    pub file_path: String,
    pub metric_type: MetricType,
    pub value: f64,
    pub unit: String,
    pub context: Option<serde_json::Value>,
    pub computed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MetricType {
    /// Cyclomatic complexity - measures code complexity
    CyclomaticComplexity,
    /// Lines of Code - total lines in entity
    LinesOfCode,
    /// Cognitive complexity - mental effort to understand
    CognitiveComplexity,
    /// Maintainability index - ease of maintenance (0-100)
    MaintainabilityIndex,
    /// Test coverage - percentage of code covered by tests
    TestCoverage,
    /// Code duplication - percentage of duplicated code
    CodeDuplication,
    /// Technical debt - estimated effort in hours
    TechnicalDebt,
    /// Halstead complexity - measures vocabulary and volume
    HalsteadComplexity,
    /// Coupling - number of dependencies
    Coupling,
    /// Cohesion - relatedness of code elements
    Cohesion,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricThreshold {
    pub metric_type: MetricType,
    pub warning_threshold: f64,
    pub error_threshold: f64,
    pub unit: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricSummary {
    pub entity_id: String,
    pub entity_type: String,
    pub file_path: String,
    pub metrics: Vec<CodeMetric>,
    pub overall_score: f64,
    pub issues: Vec<MetricIssue>,
    pub computed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricIssue {
    pub metric_type: MetricType,
    pub severity: IssueSeverity,
    pub value: f64,
    pub threshold: f64,
    pub message: String,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IssueSeverity {
    Info,
    Warning,
    Error,
    Critical,
}

impl CodeMetric {
    pub fn new(
        id: String,
        entity_id: String,
        entity_type: String,
        file_path: String,
        metric_type: MetricType,
        value: f64,
        unit: String,
    ) -> Self {
        Self {
            id,
            entity_id,
            entity_type,
            file_path,
            metric_type,
            value,
            unit,
            context: None,
            computed_at: Utc::now(),
        }
    }

    pub fn with_context(mut self, context: serde_json::Value) -> Self {
        self.context = Some(context);
        self
    }

    pub fn is_critical(&self, threshold: &MetricThreshold) -> bool {
        matches!(self.metric_type, threshold.metric_type) && self.value > threshold.error_threshold
    }

    pub fn is_warning(&self, threshold: &MetricThreshold) -> bool {
        matches!(self.metric_type, threshold.metric_type) && 
        self.value > threshold.warning_threshold && 
        self.value <= threshold.error_threshold
    }
}

impl Default for MetricThreshold {
    fn default() -> Self {
        match std::env::var("CODE_QUALITY_MODE").as_deref() {
            Some("strict") => Self::strict_defaults(),
            Some("lenient") => Self::lenient_defaults(),
            _ => Self::standard_defaults(),
        }
    }
}

impl MetricThreshold {
    pub fn standard_defaults() -> Vec<Self> {
        vec![
            Self {
                metric_type: MetricType::CyclomaticComplexity,
                warning_threshold: 10.0,
                error_threshold: 20.0,
                unit: "count".to_string(),
            },
            Self {
                metric_type: MetricType::CognitiveComplexity,
                warning_threshold: 15.0,
                error_threshold: 25.0,
                unit: "count".to_string(),
            },
            Self {
                metric_type: MetricType::MaintainabilityIndex,
                warning_threshold: 70.0,
                error_threshold: 50.0,
                unit: "score".to_string(),
            },
            Self {
                metric_type: MetricType::TestCoverage,
                warning_threshold: 80.0,
                error_threshold: 60.0,
                unit: "percentage".to_string(),
            },
            Self {
                metric_type: MetricType::CodeDuplication,
                warning_threshold: 5.0,
                error_threshold: 10.0,
                unit: "percentage".to_string(),
            },
            Self {
                metric_type: MetricType::TechnicalDebt,
                warning_threshold: 8.0,
                error_threshold: 16.0,
                unit: "hours".to_string(),
            },
        ]
    }

    pub fn strict_defaults() -> Vec<Self> {
        vec![
            Self {
                metric_type: MetricType::CyclomaticComplexity,
                warning_threshold: 5.0,
                error_threshold: 10.0,
                unit: "count".to_string(),
            },
            Self {
                metric_type: MetricType::CognitiveComplexity,
                warning_threshold: 8.0,
                error_threshold: 15.0,
                unit: "count".to_string(),
            },
            Self {
                metric_type: MetricType::MaintainabilityIndex,
                warning_threshold: 85.0,
                error_threshold: 70.0,
                unit: "score".to_string(),
            },
            Self {
                metric_type: MetricType::TestCoverage,
                warning_threshold: 90.0,
                error_threshold: 80.0,
                unit: "percentage".to_string(),
            },
            Self {
                metric_type: MetricType::CodeDuplication,
                warning_threshold: 3.0,
                error_threshold: 5.0,
                unit: "percentage".to_string(),
            },
        ]
    }

    pub fn lenient_defaults() -> Vec<Self> {
        vec![
            Self {
                metric_type: MetricType::CyclomaticComplexity,
                warning_threshold: 15.0,
                error_threshold: 25.0,
                unit: "count".to_string(),
            },
            Self {
                metric_type: MetricType::CognitiveComplexity,
                warning_threshold: 20.0,
                error_threshold: 35.0,
                unit: "count".to_string(),
            },
            Self {
                metric_type: MetricType::MaintainabilityIndex,
                warning_threshold: 60.0,
                error_threshold: 40.0,
                unit: "score".to_string(),
            },
            Self {
                metric_type: MetricType::TestCoverage,
                warning_threshold: 70.0,
                error_threshold: 50.0,
                unit: "percentage".to_string(),
            },
            Self {
                metric_type: MetricType::CodeDuplication,
                warning_threshold: 8.0,
                error_threshold: 15.0,
                unit: "percentage".to_string(),
            },
        ]
    }
}

impl MetricSummary {
    pub fn new(
        entity_id: String,
        entity_type: String,
        file_path: String,
    ) -> Self {
        Self {
            entity_id,
            entity_type,
            file_path,
            metrics: Vec::new(),
            overall_score: 0.0,
            issues: Vec::new(),
            computed_at: Utc::now(),
        }
    }

    pub fn add_metric(&mut self, metric: CodeMetric) {
        self.metrics.push(metric);
    }

    pub fn calculate_score(&mut self, thresholds: &[MetricThreshold]) {
        if self.metrics.is_empty() {
            return;
        }

        let mut total_score = 0.0;
        let mut weight_sum = 0.0;

        for metric in &self.metrics {
            let threshold = thresholds.iter()
                .find(|t| matches!(metric.metric_type, t.metric_type));
            
            if let Some(threshold) = threshold {
                let weight = match metric.metric_type {
                    MetricType::MaintainabilityIndex | MetricType::TestCoverage => 2.0,
                    MetricType::CyclomaticComplexity | MetricType::CognitiveComplexity => 1.5,
                    _ => 1.0,
                };

                let normalized_score = self.normalize_metric_score(metric, threshold);
                total_score += normalized_score * weight;
                weight_sum += weight;
            }
        }

        self.overall_score = if weight_sum > 0.0 {
            total_score / weight_sum
        } else {
            0.0
        };

        self.generate_issues(thresholds);
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

    fn generate_issues(&mut self, thresholds: &[MetricThreshold]) {
        self.issues.clear();
        
        for metric in &self.metrics {
            if let Some(threshold) = thresholds.iter()
                .find(|t| matches!(metric.metric_type, t.metric_type)) {
                
                if metric.is_critical(threshold) {
                    self.issues.push(MetricIssue {
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
                        suggestion: self.get_suggestion(&metric.metric_type),
                    });
                } else if metric.is_warning(threshold) {
                    self.issues.push(MetricIssue {
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
                        suggestion: self.get_suggestion(&metric.metric_type),
                    });
                }
            }
        }
    }

    fn get_suggestion(&self, metric_type: &MetricType) -> Option<String> {
        match metric_type {
            MetricType::CyclomaticComplexity => Some(
                "Consider breaking down complex functions into smaller, more focused functions.".to_string()
            ),
            MetricType::CognitiveComplexity => Some(
                "Simplify control flow and reduce nesting to improve readability.".to_string()
            ),
            MetricType::MaintainabilityIndex => Some(
                "Refactor code to improve structure and reduce complexity.".to_string()
            ),
            MetricType::TestCoverage => Some(
                "Add unit tests to increase code coverage and ensure reliability.".to_string()
            ),
            MetricType::CodeDuplication => Some(
                "Extract common code into reusable functions or classes.".to_string()
            ),
            MetricType::TechnicalDebt => Some(
                "Address technical debt items to improve code quality and maintainability.".to_string()
            ),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_code_metric_creation() {
        let metric = CodeMetric::new(
            "metric-1".to_string(),
            "entity-1".to_string(),
            "function".to_string(),
            "src/main.rs".to_string(),
            MetricType::CyclomaticComplexity,
            12.0,
            "count".to_string(),
        );

        assert_eq!(metric.id, "metric-1");
        assert_eq!(metric.entity_id, "entity-1");
        assert_eq!(metric.value, 12.0);
    }

    #[test]
    fn test_metric_thresholds() {
        let thresholds = MetricThreshold::standard_defaults();
        let complexity_threshold = thresholds.iter()
            .find(|t| matches!(t.metric_type, MetricType::CyclomaticComplexity))
            .unwrap();

        assert_eq!(complexity_threshold.warning_threshold, 10.0);
        assert_eq!(complexity_threshold.error_threshold, 20.0);
    }

    #[test]
    fn test_metric_summary() {
        let mut summary = MetricSummary::new(
            "entity-1".to_string(),
            "function".to_string(),
            "src/main.rs".to_string(),
        );

        let metric = CodeMetric::new(
            "metric-1".to_string(),
            "entity-1".to_string(),
            "function".to_string(),
            "src/main.rs".to_string(),
            MetricType::CyclomaticComplexity,
            15.0,
            "count".to_string(),
        );

        summary.add_metric(metric);
        assert_eq!(summary.metrics.len(), 1);
    }
}