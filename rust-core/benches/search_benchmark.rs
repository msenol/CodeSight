use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use codesight_core::services::{SearchService, IndexerService, ParserService};
use codesight_core::models::{Codebase, CodeEntity, Query};
use std::path::{Path, PathBuf};
use tempfile::TempDir;
use tokio::runtime::Runtime;

fn create_test_search_data() -> (TempDir, Codebase, Vec<CodeEntity>) {
    let temp_dir = TempDir::new().unwrap();
    let codebase_path = temp_dir.path();

    // Create a comprehensive test codebase
    let test_files = vec![
        ("src/controllers/user.controller.ts", r#"
import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';

export class UserController {
    constructor(
        private userService: UserService,
        private authService: AuthService
    ) {}

    async getUser(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        const user = await this.userService.getUser(id);

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        res.json(user);
    }

    async createUser(req: Request, res: Response): Promise<void> {
        const userData = req.body;
        const user = await this.userService.createUser(userData);
        const token = this.authService.generateToken(user.id);

        res.status(201).json({ user, token });
    }

    async updateUser(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        const updates = req.body;

        const user = await this.userService.updateUser(id, updates);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        res.json(user);
    }

    async deleteUser(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        await this.userService.deleteUser(id);
        res.status(204).send();
    }
}
"#),
        ("src/services/user.service.ts", r#"
import { DatabaseService } from './database.service';
import { CacheService } from './cache.service';
import { User, CreateUserDto, UpdateUserDto } from '../types/user.types';

export class UserService {
    constructor(
        private db: DatabaseService,
        private cache: CacheService
    ) {}

    async getUser(id: string): Promise<User | null> {
        // Try cache first
        const cached = await this.cache.get(`user:${id}`);
        if (cached) return cached;

        // Query database
        const user = await this.db.users.findById(id);
        if (user) {
            await this.cache.set(`user:${id}`, user, 3600);
        }
        return user;
    }

    async createUser(userData: CreateUserDto): Promise<User> {
        const user = await this.db.users.create({
            ...userData,
            id: this.generateId(),
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await this.cache.set(`user:${user.id}`, user, 3600);
        return user;
    }

    async updateUser(id: string, updates: UpdateUserDto): Promise<User | null> {
        const user = await this.db.users.update(id, {
            ...updates,
            updatedAt: new Date()
        });

        if (user) {
            await this.cache.set(`user:${id}`, user, 3600);
        }
        return user;
    }

    async deleteUser(id: string): Promise<boolean> {
        await this.cache.delete(`user:${id}`);
        return await this.db.users.delete(id);
    }

    async searchUsers(query: string, limit: number = 10): Promise<User[]> {
        return await this.db.users.search(query, limit);
    }

    private generateId(): string {
        return Math.random().toString(36).substr(2, 9);
    }
}
"#),
        ("src/services/auth.service.ts", r#"
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { UserService } from './user.service';

export class AuthService {
    constructor(
        private userService: UserService,
        private jwtSecret: string
    ) {}

    async login(email: string, password: string): Promise<{ user: User; token: string } | null> {
        const user = await this.userService.findByEmail(email);
        if (!user) return null;

        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        if (!isValidPassword) return null;

        const token = this.generateToken(user.id);
        return { user, token };
    }

    async register(userData: CreateUserDto & { password: string }): Promise<{ user: User; token: string }> {
        const passwordHash = await bcrypt.hash(userData.password, 10);
        const user = await this.userService.createUser({
            ...userData,
            passwordHash
        });

        const token = this.generateToken(user.id);
        return { user, token };
    }

    generateToken(userId: string): string {
        return jwt.sign({ userId }, this.jwtSecret, { expiresIn: '7d' });
    }

    verifyToken(token: string): { userId: string } | null {
        try {
            return jwt.verify(token, this.jwtSecret) as { userId: string };
        } catch {
            return null;
        }
    }

    async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<boolean> {
        const user = await this.userService.getUser(userId);
        if (!user) return false;

        const isValidOldPassword = await bcrypt.compare(oldPassword, user.passwordHash);
        if (!isValidOldPassword) return false;

        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        await this.userService.updateUser(userId, { passwordHash: newPasswordHash });
        return true;
    }
}
"#),
        ("src/models/user.model.ts", r#"
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    email: string;

    @Column()
    name: string;

    @Column({ select: false })
    passwordHash: string;

    @Column({ default: 'user' })
    role: string;

    @Column({ nullable: true })
    avatar?: string;

    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column({ nullable: true })
    lastLoginAt?: Date;
}

export interface CreateUserDto {
    email: string;
    name: string;
    role?: string;
    avatar?: string;
}

export interface UpdateUserDto {
    name?: string;
    avatar?: string;
    isActive?: boolean;
}

export interface UserProfileDto {
    id: string;
    email: string;
    name: string;
    role: string;
    avatar?: string;
    isActive: boolean;
    createdAt: Date;
    lastLoginAt?: Date;
}
"#),
        ("src/utils/validation.ts", r#"
import Joi from 'joi';

export const userValidationSchemas = {
    createUser: Joi.object({
        email: Joi.string().email().required(),
        name: Joi.string().min(2).max(100).required(),
        password: Joi.string().min(8).required(),
        role: Joi.string().valid('user', 'admin').default('user'),
        avatar: Joi.string().uri().optional()
    }),

    updateUser: Joi.object({
        name: Joi.string().min(2).max(100).optional(),
        avatar: Joi.string().uri().optional(),
        isActive: Joi.boolean().optional()
    }),

    login: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
    }),

    changePassword: Joi.object({
        oldPassword: Joi.string().required(),
        newPassword: Joi.string().min(8).required()
    })
};

export function validateInput<T>(schema: Joi.ObjectSchema<T>, data: unknown): T {
    const { error, value } = schema.validate(data);
    if (error) {
        throw new Error(`Validation error: ${error.details[0].message}`);
    }
    return value;
}

export function sanitizeString(input: string): string {
    return input.trim().replace(/[<>]/g, '');
}

export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
"#),
    ];

    // Write test files
    for (file_path, content) in test_files {
        let full_path = codebase_path.join(file_path);
        if let Some(parent) = full_path.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        std::fs::write(full_path, content).unwrap();
    }

    // Create mock entities for testing
    let entities = vec![
        CodeEntity {
            id: "entity-1".to_string(),
            codebase_id: "test-codebase".to_string(),
            entity_type: codesight_core::models::EntityType::Class,
            name: "UserController".to_string(),
            qualified_name: "UserController".to_string(),
            file_path: "src/controllers/user.controller.ts".to_string(),
            start_line: 5,
            end_line: 50,
            start_column: 0,
            end_column: 0,
            language: "typescript".to_string(),
            signature: None,
            visibility: codesight_core::models::Visibility::Public,
            documentation: Some("Handles user-related HTTP requests".to_string()),
            ast_hash: "hash1".to_string(),
            embedding_id: None,
        },
        CodeEntity {
            id: "entity-2".to_string(),
            codebase_id: "test-codebase".to_string(),
            entity_type: codesight_core::models::EntityType::Function,
            name: "getUser".to_string(),
            qualified_name: "UserController.getUser".to_string(),
            file_path: "src/controllers/user.controller.ts".to_string(),
            start_line: 12,
            end_line: 20,
            start_column: 4,
            end_column: 4,
            language: "typescript".to_string(),
            signature: Some("async getUser(req: Request, res: Response): Promise<void>".to_string()),
            visibility: codesight_core::models::Visibility::Public,
            documentation: Some("Retrieves a user by ID".to_string()),
            ast_hash: "hash2".to_string(),
            embedding_id: None,
        },
        CodeEntity {
            id: "entity-3".to_string(),
            codebase_id: "test-codebase".to_string(),
            entity_type: codesight_core::models::EntityType::Class,
            name: "UserService".to_string(),
            qualified_name: "UserService".to_string(),
            file_path: "src/services/user.service.ts".to_string(),
            start_line: 5,
            end_line: 60,
            start_column: 0,
            end_column: 0,
            language: "typescript".to_string(),
            signature: None,
            visibility: codesight_core::models::Visibility::Public,
            documentation: Some("Business logic for user management".to_string()),
            ast_hash: "hash3".to_string(),
            embedding_id: None,
        },
        CodeEntity {
            id: "entity-4".to_string(),
            codebase_id: "test-codebase".to_string(),
            entity_type: codesight_core::models::EntityType::Function,
            name: "createUser".to_string(),
            qualified_name: "UserService.createUser".to_string(),
            file_path: "src/services/user.service.ts".to_string(),
            start_line: 25,
            end_line: 35,
            start_column: 4,
            end_column: 4,
            language: "typescript".to_string(),
            signature: Some("async createUser(userData: CreateUserDto): Promise<User>".to_string()),
            visibility: codesight_core::models::Visibility::Public,
            documentation: Some("Creates a new user in the system".to_string()),
            ast_hash: "hash4".to_string(),
            embedding_id: None,
        },
        CodeEntity {
            id: "entity-5".to_string(),
            codebase_id: "test-codebase".to_string(),
            entity_type: codesight_core::models::EntityType::Interface,
            name: "CreateUserDto".to_string(),
            qualified_name: "CreateUserDto".to_string(),
            file_path: "src/models/user.model.ts".to_string(),
            start_line: 35,
            end_line: 42,
            start_column: 0,
            end_column: 0,
            language: "typescript".to_string(),
            signature: None,
            visibility: codesight_core::models::Visibility::Public,
            documentation: Some("Data transfer object for user creation".to_string()),
            ast_hash: "hash5".to_string(),
            embedding_id: None,
        },
    ];

    let codebase = Codebase {
        id: "test-codebase".to_string(),
        name: "Test Search Codebase".to_string(),
        path: codebase_path.to_string_lossy().to_string(),
        size_bytes: 0,
        file_count: test_files.len() as u32,
        language_stats: [("typescript".to_string(), test_files.len() as u32)].into_iter().collect(),
        index_version: "1.0.0".to_string(),
        last_indexed: None,
        configuration_id: "default".to_string(),
        status: codesight_core::models::CodebaseStatus::Indexed,
    };

    (temp_dir, codebase, entities)
}

fn bench_search_performance(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let search_service = SearchService::new();
    let (_temp_dir, codebase, entities) = create_test_search_data();

    let mut group = c.benchmark_group("search");

    let search_queries = vec![
        "user authentication",
        "create user function",
        "database operations",
        "validation logic",
        "controller methods",
        "service layer",
        "user management",
        "password hashing",
        "token generation",
        "email validation"
    ];

    for query in &search_queries {
        group.bench_with_input(
            BenchmarkId::new("query", query),
            query,
            |b, &query| {
                b.to_async(&rt).iter(|| async {
                    let search_query = Query {
                        id: "test-query".to_string(),
                        query_text: query.to_string(),
                        query_type: codesight_core::models::QueryType::NaturalLanguage,
                        intent: codesight_core::models::QueryIntent::FindFunction,
                        codebase_id: codebase.id.clone(),
                        user_id: None,
                        timestamp: chrono::Utc::now(),
                        execution_time_ms: 0,
                        result_count: 0,
                        cache_hit: false,
                    };

                    let results = search_service.search(black_box(&search_query), black_box(&entities)).await;
                    black_box(results);
                });
            },
        );
    }

    group.finish();
}

fn bench_different_search_types(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let search_service = SearchService::new();
    let (_temp_dir, codebase, entities) = create_test_search_data();

    let mut group = c.benchmark_group("search_types");

    // Benchmark different search intents
    let intents = vec![
        codesight_core::models::QueryIntent::FindFunction,
        codesight_core::models::QueryIntent::ExplainCode,
        codesight_core::models::QueryIntent::FindUsage,
        codesight_core::models::QueryIntent::TraceFlow,
        codesight_core::models::QueryIntent::SecurityAudit,
    ];

    for intent in &intents {
        group.bench_with_input(
            BenchmarkId::new("intent", format!("{:?}", intent)),
            intent,
            |b, &intent| {
                b.to_async(&rt).iter(|| async {
                    let search_query = Query {
                        id: "test-query".to_string(),
                        query_text: "user service authentication".to_string(),
                        query_type: codesight_core::models::QueryType::NaturalLanguage,
                        intent: intent.clone(),
                        codebase_id: codebase.id.clone(),
                        user_id: None,
                        timestamp: chrono::Utc::now(),
                        execution_time_ms: 0,
                        result_count: 0,
                        cache_hit: false,
                    };

                    let results = search_service.search(black_box(&search_query), black_box(&entities)).await;
                    black_box(results);
                });
            },
        );
    }

    group.finish();
}

fn bench_ranking_algorithms(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let search_service = SearchService::new();
    let (_temp_dir, codebase, entities) = create_test_search_data();

    let mut group = c.benchmark_group("ranking");

    let search_query = Query {
        id: "test-query".to_string(),
        query_text: "user authentication service".to_string(),
        query_type: codesight_core::models::QueryType::NaturalLanguage,
        intent: codesight_core::models::QueryIntent::FindFunction,
        codebase_id: codebase.id.clone(),
        user_id: None,
        timestamp: chrono::Utc::now(),
        execution_time_ms: 0,
        result_count: 0,
        cache_hit: false,
    };

    group.bench_function("hybrid_ranking", |b| {
        b.to_async(&rt).iter(|| async {
            let results = search_service.search_with_hybrid_ranking(black_box(&search_query), black_box(&entities)).await;
            black_box(results);
        });
    });

    group.bench_function("keyword_ranking", |b| {
        b.to_async(&rt).iter(|| async {
            let results = search_service.search_with_keyword_ranking(black_box(&search_query), black_box(&entities)).await;
            black_box(results);
        });
    });

    group.bench_function("semantic_ranking", |b| {
        b.to_async(&rt).iter(|| async {
            let results = search_service.search_with_semantic_ranking(black_box(&search_query), black_box(&entities)).await;
            black_box(results);
        });
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_search_performance,
    bench_different_search_types,
    bench_ranking_algorithms
);
criterion_main!(benches);