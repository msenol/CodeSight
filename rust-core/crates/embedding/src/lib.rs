//! Embedding generation for Code Intelligence MCP Server
//!
//! Uses FastEmbed (ONNX Runtime) to generate sentence embeddings locally.
//! Default model: all-MiniLM-L6-v2 (384-dim, ~23MB download on first use).

use anyhow::Result;
use fastembed::{EmbeddingModel, InitOptions, TextEmbedding};
use std::sync::Mutex;

static EMBEDDING_MODEL: Mutex<Option<TextEmbedding>> = Mutex::new(None);

fn with_model<F, R>(f: F) -> Result<R>
where
    F: FnOnce(&mut TextEmbedding) -> Result<R>,
{
    let mut guard = EMBEDDING_MODEL.lock().unwrap();
    if guard.is_none() {
        tracing::info!("Loading embedding model (first use may download ~23MB)...");
        let mut opts = InitOptions::default();
        opts.model_name = EmbeddingModel::AllMiniLML6V2;
        opts.show_download_progress = true;
        let model = TextEmbedding::try_new(opts)?;
        *guard = Some(model);
    }
    f(guard.as_mut().unwrap())
}

/// Generate an embedding vector for a single text snippet.
pub fn generate_embedding(text: &str) -> Result<Vec<f32>> {
    with_model(|model| {
        let embeddings = model.embed(vec![text], None)?;
        Ok(embeddings.into_iter().next().unwrap_or_default())
    })
}

/// Generate embeddings for multiple texts in one batch (more efficient).
pub fn generate_embeddings_batch(texts: &[&str]) -> Result<Vec<Vec<f32>>> {
    with_model(|model| model.embed(texts.to_vec(), None))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_embedding_dimension() {
        let embedding = generate_embedding("test").unwrap();
        assert_eq!(embedding.len(), 384);
    }

    #[test]
    fn test_similar_texts_have_similar_embeddings() {
        let a = generate_embedding("hello world").unwrap();
        let b = generate_embedding("hello world").unwrap();
        let sim = cosine_similarity(&a, &b);
        assert!(
            sim > 0.99,
            "identical texts should have similarity > 0.99, got {}",
            sim
        );
    }

    fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
        let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
        let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
        dot / (norm_a * norm_b)
    }
}
