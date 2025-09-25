//! CodeRelationship model implementation
//!
//! Represents relationships between code entities (imports, calls, extends, etc.)

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::{ModelResult, Timestamped, Validate};
use crate::errors::CoreError;

/// Type of relationship between code entities
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RelationshipType {
    /// One entity imports another
    Imports,
    /// One entity calls another (function/method call)
    Calls,
    /// One entity extends another (inheritance)
    Extends,
    /// One entity implements another (interface implementation)
    Implements,
    /// One entity references another (variable reference, type usage)
    References,
    /// One entity uses another (general usage)
    Uses,
    /// One entity depends on another
    DependsOn,
}

/// Represents a relationship between two code entities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeRelationship {
    /// Unique identifier for the relationship
    pub id: Uuid,
    /// Source entity in the relationship
    pub source_entity_id: Uuid,
    /// Target entity in the relationship
    pub target_entity_id: Uuid,
    /// Type of relationship
    pub relationship_type: RelationshipType,
    /// Confidence score (0.0 to 1.0) for the relationship
    pub confidence: f32,
    /// Optional context snippet showing the relationship
    pub context: Option<String>,
    /// Timestamp when the relationship was created
    pub created_at: DateTime<Utc>,
    /// Timestamp when the relationship was last updated
    pub updated_at: Option<DateTime<Utc>>,
}

impl CodeRelationship {
    /// Create a new code relationship
    pub fn new(
        source_entity_id: Uuid,
        target_entity_id: Uuid,
        relationship_type: RelationshipType,
        confidence: f32,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            source_entity_id,
            target_entity_id,
            relationship_type,
            confidence: confidence.clamp(0.0, 1.0),
            context: None,
            created_at: Utc::now(),
            updated_at: None,
        }
    }

    /// Create a new relationship with context
    pub fn with_context(
        source_entity_id: Uuid,
        target_entity_id: Uuid,
        relationship_type: RelationshipType,
        confidence: f32,
        context: String,
    ) -> Self {
        let mut relationship = Self::new(source_entity_id, target_entity_id, relationship_type, confidence);
        relationship.context = Some(context);
        relationship
    }

    /// Set the context for this relationship
    pub fn set_context(&mut self, context: String) {
        self.context = Some(context);
        self.updated_at = Some(Utc::now());
    }

    /// Update the confidence score
    pub fn update_confidence(&mut self, confidence: f32) {
        self.confidence = confidence.clamp(0.0, 1.0);
        self.updated_at = Some(Utc::now());
    }

    /// Check if this is a high-confidence relationship
    pub fn is_high_confidence(&self) -> bool {
        self.confidence >= 0.8
    }

    /// Check if this is a low-confidence relationship
    pub fn is_low_confidence(&self) -> bool {
        self.confidence <= 0.3
    }

    /// Check if this relationship has context information
    pub fn has_context(&self) -> bool {
        self.context.as_ref().map_or(false, |ctx| !ctx.trim().is_empty())
    }

    /// Get a human-readable description of the relationship
    pub fn description(&self) -> String {
        match self.relationship_type {
            RelationshipType::Imports => "imports".to_string(),
            RelationshipType::Calls => "calls".to_string(),
            RelationshipType::Extends => "extends".to_string(),
            RelationshipType::Implements => "implements".to_string(),
            RelationshipType::References => "references".to_string(),
            RelationshipType::Uses => "uses".to_string(),
            RelationshipType::DependsOn => "depends on".to_string(),
        }
    }

    /// Check if this is a structural relationship (inheritance, implementation)
    pub fn is_structural(&self) -> bool {
        matches!(
            self.relationship_type,
            RelationshipType::Extends | RelationshipType::Implements
        )
    }

    /// Check if this is a behavioral relationship (calls, uses)
    pub fn is_behavioral(&self) -> bool {
        matches!(
            self.relationship_type,
            RelationshipType::Calls | RelationshipType::Uses
        )
    }

    /// Check if this is a dependency relationship
    pub fn is_dependency(&self) -> bool {
        matches!(
            self.relationship_type,
            RelationshipType::Imports | RelationshipType::DependsOn | RelationshipType::References
        )
    }

    /// Get the inverse relationship type if applicable
    pub fn inverse_type(&self) -> Option<RelationshipType> {
        match self.relationship_type {
            RelationshipType::Extends => Some(RelationshipType::Extends), // Bidirectional
            RelationshipType::Implements => Some(RelationshipType::Implements), // Bidirectional
            _ => None, // Most relationships are unidirectional
        }
    }

    /// Create the inverse relationship
    pub fn create_inverse(&self) -> Option<CodeRelationship> {
        self.inverse_type().map(|inv_type| {
            CodeRelationship::new(
                self.target_entity_id,
                self.source_entity_id,
                inv_type,
                self.confidence,
            )
        })
    }

    /// Get confidence level as a string
    pub fn confidence_level(&self) -> &'static str {
        if self.confidence >= 0.8 {
            "High"
        } else if self.confidence >= 0.5 {
            "Medium"
        } else if self.confidence >= 0.3 {
            "Low"
        } else {
            "Very Low"
        }
    }

    /// Check if two relationships are equivalent (same entities and type)
    pub fn is_equivalent(&self, other: &CodeRelationship) -> bool {
        self.source_entity_id == other.source_entity_id
            && self.target_entity_id == other.target_entity_id
            && self.relationship_type == other.relationship_type
    }

    /// Merge with another equivalent relationship (taking higher confidence)
    pub fn merge_with(&mut self, other: &CodeRelationship) -> Result<(), String> {
        if !self.is_equivalent(other) {
            return Err("Cannot merge non-equivalent relationships".to_string());
        }

        // Take the higher confidence
        if other.confidence > self.confidence {
            self.confidence = other.confidence;
        }

        // Merge context if available
        if other.has_context() && !self.has_context() {
            self.context = other.context.clone();
        }

        self.updated_at = Some(Utc::now());
        Ok(())
    }
}

impl Validate for CodeRelationship {
    fn validate(&self) -> ModelResult<()> {
        if self.source_entity_id == self.target_entity_id {
            return Err(CoreError::ValidationError(
                "Source and target entities cannot be the same".to_string(),
            ));
        }

        if !(0.0..=1.0).contains(&self.confidence) {
            return Err(CoreError::ValidationError(
                "Confidence must be between 0.0 and 1.0".to_string(),
            ));
        }

        // Validate context if present
        if let Some(ref context) = self.context {
            if context.len() > 1000 {
                return Err(CoreError::ValidationError(
                    "Context cannot exceed 1000 characters".to_string(),
                ));
            }
        }

        Ok(())
    }
}

impl Timestamped for CodeRelationship {
    fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    fn updated_at(&self) -> Option<DateTime<Utc>> {
        self.updated_at
    }
}

/// Helper struct for relationship statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationshipStats {
    /// Total number of relationships
    pub total: usize,
    /// Count by relationship type
    pub by_type: std::collections::HashMap<RelationshipType, usize>,
    /// Average confidence score
    pub average_confidence: f32,
    /// Number of high-confidence relationships
    pub high_confidence_count: usize,
}

impl RelationshipStats {
    /// Create statistics from a collection of relationships
    pub fn from_relationships(relationships: &[CodeRelationship]) -> Self {
        let mut by_type = std::collections::HashMap::new();
        let mut total_confidence = 0.0;
        let mut high_confidence_count = 0;

        for rel in relationships {
            *by_type.entry(rel.relationship_type.clone()).or_insert(0) += 1;
            total_confidence += rel.confidence;
            if rel.is_high_confidence() {
                high_confidence_count += 1;
            }
        }

        let average_confidence = if relationships.is_empty() {
            0.0
        } else {
            total_confidence / relationships.len() as f32
        };

        Self {
            total: relationships.len(),
            by_type,
            average_confidence,
            high_confidence_count,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_relationship() {
        let source_id = Uuid::new_v4();
        let target_id = Uuid::new_v4();
        let rel = CodeRelationship::new(
            source_id,
            target_id,
            RelationshipType::Calls,
            0.9,
        );

        assert_eq!(rel.source_entity_id, source_id);
        assert_eq!(rel.target_entity_id, target_id);
        assert_eq!(rel.relationship_type, RelationshipType::Calls);
        assert_eq!(rel.confidence, 0.9);
        assert!(rel.is_high_confidence());
        assert!(!rel.has_context());
    }

    #[test]
    fn test_confidence_clamping() {
        let rel1 = CodeRelationship::new(
            Uuid::new_v4(),
            Uuid::new_v4(),
            RelationshipType::Imports,
            1.5, // Should be clamped to 1.0
        );
        assert_eq!(rel1.confidence, 1.0);

        let rel2 = CodeRelationship::new(
            Uuid::new_v4(),
            Uuid::new_v4(),
            RelationshipType::Imports,
            -0.5, // Should be clamped to 0.0
        );
        assert_eq!(rel2.confidence, 0.0);
    }

    #[test]
    fn test_relationship_with_context() {
        let rel = CodeRelationship::with_context(
            Uuid::new_v4(),
            Uuid::new_v4(),
            RelationshipType::Calls,
            0.8,
            "function_call(param)".to_string(),
        );

        assert!(rel.has_context());
        assert_eq!(rel.context.as_ref().unwrap(), "function_call(param)");
    }

    #[test]
    fn test_relationship_types() {
        let calls_rel = CodeRelationship::new(
            Uuid::new_v4(),
            Uuid::new_v4(),
            RelationshipType::Calls,
            0.8,
        );
        assert!(calls_rel.is_behavioral());
        assert!(!calls_rel.is_structural());
        assert!(!calls_rel.is_dependency());

        let extends_rel = CodeRelationship::new(
            Uuid::new_v4(),
            Uuid::new_v4(),
            RelationshipType::Extends,
            0.9,
        );
        assert!(!extends_rel.is_behavioral());
        assert!(extends_rel.is_structural());
        assert!(!extends_rel.is_dependency());

        let imports_rel = CodeRelationship::new(
            Uuid::new_v4(),
            Uuid::new_v4(),
            RelationshipType::Imports,
            0.95,
        );
        assert!(!imports_rel.is_behavioral());
        assert!(!imports_rel.is_structural());
        assert!(imports_rel.is_dependency());
    }

    #[test]
    fn test_confidence_levels() {
        let high_conf = CodeRelationship::new(
            Uuid::new_v4(),
            Uuid::new_v4(),
            RelationshipType::Calls,
            0.9,
        );
        assert_eq!(high_conf.confidence_level(), "High");
        assert!(high_conf.is_high_confidence());

        let low_conf = CodeRelationship::new(
            Uuid::new_v4(),
            Uuid::new_v4(),
            RelationshipType::References,
            0.2,
        );
        assert_eq!(low_conf.confidence_level(), "Very Low");
        assert!(low_conf.is_low_confidence());
    }

    #[test]
    fn test_equivalence_and_merging() {
        let source_id = Uuid::new_v4();
        let target_id = Uuid::new_v4();
        
        let mut rel1 = CodeRelationship::new(
            source_id,
            target_id,
            RelationshipType::Calls,
            0.6,
        );
        
        let rel2 = CodeRelationship::with_context(
            source_id,
            target_id,
            RelationshipType::Calls,
            0.8,
            "call_context".to_string(),
        );

        assert!(rel1.is_equivalent(&rel2));
        assert!(rel1.merge_with(&rel2).is_ok());
        assert_eq!(rel1.confidence, 0.8); // Should take higher confidence
        assert!(rel1.has_context()); // Should get context from rel2
    }

    #[test]
    fn test_validation() {
        let same_id = Uuid::new_v4();
        let invalid_rel = CodeRelationship::new(
            same_id,
            same_id, // Same source and target
            RelationshipType::Calls,
            0.5,
        );
        assert!(invalid_rel.validate().is_err());

        let valid_rel = CodeRelationship::new(
            Uuid::new_v4(),
            Uuid::new_v4(),
            RelationshipType::Imports,
            0.7,
        );
        assert!(valid_rel.validate().is_ok());
    }

    #[test]
    fn test_relationship_stats() {
        let relationships = vec![
            CodeRelationship::new(
                Uuid::new_v4(),
                Uuid::new_v4(),
                RelationshipType::Calls,
                0.9,
            ),
            CodeRelationship::new(
                Uuid::new_v4(),
                Uuid::new_v4(),
                RelationshipType::Calls,
                0.8,
            ),
            CodeRelationship::new(
                Uuid::new_v4(),
                Uuid::new_v4(),
                RelationshipType::Imports,
                0.7,
            ),
        ];

        let stats = RelationshipStats::from_relationships(&relationships);
        assert_eq!(stats.total, 3);
        assert_eq!(stats.by_type[&RelationshipType::Calls], 2);
        assert_eq!(stats.by_type[&RelationshipType::Imports], 1);
        assert_eq!(stats.high_confidence_count, 2);
        assert!((stats.average_confidence - 0.8).abs() < 0.01);
    }
}