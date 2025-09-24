use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use rust_core::services::embedding::EmbeddingService;
use rust_core::models::code_entity::CodeEntity;
use rust_core::models::embedding::Embedding;

fn create_test_embedding_service() -> EmbeddingService {
    EmbeddingService::new()
}

fn create_test_code_entities() -> Vec<CodeEntity> {
    vec![
        CodeEntity {
            id: uuid::Uuid::new_v4(),
            codebase_id: uuid::Uuid::new_v4(),
            entity_type: rust_core::models::code_entity::EntityType::Function,
            name: "authenticate_user".to_string(),
            qualified_name: "auth::authenticate_user".to_string(),
            file_path: "src/auth.rs".to_string(),
            start_line: 10,
            end_line: 25,
            start_column: 0,
            end_column: 1,
            language: "rust".to_string(),
            signature: Some("fn authenticate_user(username: &str, password: &str) -> Result<User, AuthError>".to_string()),
            visibility: rust_core::models::code_entity::Visibility::Public,
            documentation: Some("Authenticates a user with username and password".to_string()),
            ast_hash: "hash123".to_string(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        },
        CodeEntity {
            id: uuid::Uuid::new_v4(),
            codebase_id: uuid::Uuid::new_v4(),
            entity_type: rust_core::models::code_entity::EntityType::Class,
            name: "UserService".to_string(),
            qualified_name: "services::UserService".to_string(),
            file_path: "src/services/user.rs".to_string(),
            start_line: 5,
            end_line: 50,
            start_column: 0,
            end_column: 1,
            language: "rust".to_string(),
            signature: Some("struct UserService".to_string()),
            visibility: rust_core::models::code_entity::Visibility::Public,
            documentation: Some("Service for managing user operations".to_string()),
            ast_hash: "hash456".to_string(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        },
        CodeEntity {
            id: uuid::Uuid::new_v4(),
            codebase_id: uuid::Uuid::new_v4(),
            entity_type: rust_core::models::code_entity::EntityType::Method,
            name: "create_user".to_string(),
            qualified_name: "services::UserService::create_user".to_string(),
            file_path: "src/services/user.rs".to_string(),
            start_line: 15,
            end_line: 30,
            start_column: 4,
            end_column: 5,
            language: "rust".to_string(),
            signature: Some("fn create_user(&self, user_data: CreateUserRequest) -> Result<User, ServiceError>".to_string()),
            visibility: rust_core::models::code_entity::Visibility::Public,
            documentation: Some("Creates a new user in the system".to_string()),
            ast_hash: "hash789".to_string(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        },
    ]
}

fn benchmark_single_embedding_generation(c: &mut Criterion) {
    let embedding_service = create_test_embedding_service();
    let entities = create_test_code_entities();
    
    c.bench_function("generate_single_embedding", |b| {
        b.iter(|| {
            black_box(embedding_service.generate_embedding(&entities[0]))
        })
    });
}

fn benchmark_batch_embedding_generation(c: &mut Criterion) {
    let mut group = c.benchmark_group("batch_embedding_generation");
    let embedding_service = create_test_embedding_service();
    
    for batch_size in [1, 5, 10, 25, 50].iter() {
        let entities: Vec<_> = (0..*batch_size)
            .map(|i| {
                let mut entity = create_test_code_entities()[i % 3].clone();
                entity.id = uuid::Uuid::new_v4();
                entity.name = format!("entity_{}", i);
                entity
            })
            .collect();
            
        group.bench_with_input(
            BenchmarkId::new("batch_size", batch_size),
            &entities,
            |b, entities| {
                b.iter(|| {
                    black_box(embedding_service.generate_batch_embeddings(entities))
                })
            },
        );
    }
    group.finish();
}

fn benchmark_embedding_similarity_search(c: &mut Criterion) {
    let embedding_service = create_test_embedding_service();
    let entities = create_test_code_entities();
    
    // Generate embeddings for search
    let embeddings: Vec<_> = entities.iter()
        .map(|entity| embedding_service.generate_embedding(entity).unwrap())
        .collect();
    
    let query_embedding = &embeddings[0];
    
    c.bench_function("similarity_search", |b| {
        b.iter(|| {
            black_box(embedding_service.find_similar_embeddings(query_embedding, &embeddings, 10))
        })
    });
}

fn benchmark_embedding_similarity_with_different_corpus_sizes(c: &mut Criterion) {
    let mut group = c.benchmark_group("similarity_search_corpus_size");
    let embedding_service = create_test_embedding_service();
    let base_entity = &create_test_code_entities()[0];
    
    for corpus_size in [100, 500, 1000, 5000].iter() {
        let embeddings: Vec<_> = (0..*corpus_size)
            .map(|i| {
                let mut entity = base_entity.clone();
                entity.id = uuid::Uuid::new_v4();
                entity.name = format!("entity_{}", i);
                embedding_service.generate_embedding(&entity).unwrap()
            })
            .collect();
            
        let query_embedding = &embeddings[0];
        
        group.bench_with_input(
            BenchmarkId::new("corpus_size", corpus_size),
            &embeddings,
            |b, embeddings| {
                b.iter(|| {
                    black_box(embedding_service.find_similar_embeddings(query_embedding, embeddings, 10))
                })
            },
        );
    }
    group.finish();
}

fn benchmark_embedding_caching(c: &mut Criterion) {
    let mut group = c.benchmark_group("embedding_caching");
    let embedding_service = create_test_embedding_service();
    let entity = &create_test_code_entities()[0];
    
    // First generation to populate cache
    embedding_service.generate_embedding(entity);
    
    group.bench_function("cache_hit", |b| {
        b.iter(|| {
            black_box(embedding_service.generate_embedding(entity))
        })
    });
    
    group.bench_function("cache_miss", |b| {
        b.iter(|| {
            let mut new_entity = entity.clone();
            new_entity.id = uuid::Uuid::new_v4();
            new_entity.ast_hash = format!("hash_{}", uuid::Uuid::new_v4());
            black_box(embedding_service.generate_embedding(&new_entity))
        })
    });
    
    group.finish();
}

fn benchmark_parallel_embedding_generation(c: &mut Criterion) {
    let mut group = c.benchmark_group("parallel_embedding_generation");
    let embedding_service = std::sync::Arc::new(create_test_embedding_service());
    
    for thread_count in [1, 2, 4, 8].iter() {
        let entities: Vec<_> = (0..100)
            .map(|i| {
                let mut entity = create_test_code_entities()[i % 3].clone();
                entity.id = uuid::Uuid::new_v4();
                entity.name = format!("entity_{}", i);
                entity
            })
            .collect();
            
        group.bench_with_input(
            BenchmarkId::new("threads", thread_count),
            thread_count,
            |b, &thread_count| {
                b.iter(|| {
                    let chunk_size = entities.len() / thread_count;
                    let handles: Vec<_> = entities
                        .chunks(chunk_size)
                        .map(|chunk| {
                            let service = embedding_service.clone();
                            let chunk = chunk.to_vec();
                            std::thread::spawn(move || {
                                for entity in chunk {
                                    black_box(service.generate_embedding(&entity));
                                }
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

criterion_group!(
    benches,
    benchmark_single_embedding_generation,
    benchmark_batch_embedding_generation,
    benchmark_embedding_similarity_search,
    benchmark_embedding_similarity_with_different_corpus_sizes,
    benchmark_embedding_caching,
    benchmark_parallel_embedding_generation
);
criterion_main!(benches);