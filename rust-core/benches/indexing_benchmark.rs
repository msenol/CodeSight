use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use codesight_core::services::{IndexerService, ParserService};
use codesight_core::models::Codebase;
use std::path::{Path, PathBuf};
use tempfile::TempDir;
use tokio::runtime::Runtime;

fn create_test_codebase() -> (TempDir, Codebase) {
    let temp_dir = TempDir::new().unwrap();
    let codebase_path = temp_dir.path();

    // Create test files
    let test_files = vec![
        ("src/main.ts", r#"
export class UserService {
    constructor(private database: Database) {}

    async getUser(id: string): Promise<User | null> {
        return await this.database.users.findById(id);
    }

    async createUser(userData: CreateUserDto): Promise<User> {
        const user = new User();
        Object.assign(user, userData);
        return await this.database.users.save(user);
    }
}

interface User {
    id: string;
    name: string;
    email: string;
}

interface CreateUserDto {
    name: string;
    email: string;
}
"#),
        ("src/auth.ts", r#"
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export class AuthService {
    constructor(private jwtSecret: string) {}

    async hashPassword(password: string): Promise<string> {
        return await bcrypt.hash(password, 10);
    }

    async verifyPassword(password: string, hash: string): Promise<boolean> {
        return await bcrypt.compare(password, hash);
    }

    generateToken(userId: string): string {
        return jwt.sign({ userId }, this.jwtSecret, { expiresIn: '24h' });
    }
}
"#),
        ("src/database.ts", r#"
export class Database {
    users: UserRepository;
    posts: PostRepository;

    constructor() {
        this.users = new UserRepository();
        this.posts = new PostRepository();
    }
}

export class UserRepository {
    private users: Map<string, User> = new Map();

    async findById(id: string): Promise<User | null> {
        return this.users.get(id) || null;
    }

    async save(user: User): Promise<User> {
        this.users.set(user.id, user);
        return user;
    }
}

export class PostRepository {
    private posts: Map<string, Post> = new Map();

    async findById(id: string): Promise<Post | null> {
        return this.posts.get(id) || null;
    }

    async save(post: Post): Promise<Post> {
        this.posts.set(post.id, post);
        return post;
    }
}
"#),
        ("utils/helpers.ts", r#"
export function formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
    }).format(amount);
}

export function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}
"#),
    ];

    for (file_path, content) in test_files {
        let full_path = codebase_path.join(file_path);
        if let Some(parent) = full_path.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        std::fs::write(full_path, content).unwrap();
    }

    let codebase = Codebase {
        id: "test-codebase".to_string(),
        name: "Test Codebase".to_string(),
        path: codebase_path.to_string_lossy().to_string(),
        size_bytes: 0,
        file_count: test_files.len() as u32,
        language_stats: [("typescript".to_string(), test_files.len() as u32)].into_iter().collect(),
        index_version: "1.0.0".to_string(),
        last_indexed: None,
        configuration_id: "default".to_string(),
        status: codesight_core::models::CodebaseStatus::Unindexed,
    };

    (temp_dir, codebase)
}

fn bench_indexing_performance(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let mut group = c.benchmark_group("indexing");

    // Benchmark different file counts
    for file_count in [1, 5, 10, 25, 50].iter() {
        group.bench_with_input(
            BenchmarkId::new("files", file_count),
            file_count,
            |b, &file_count| {
                b.to_async(&rt).iter(|| async {
                    let (_temp_dir, codebase) = create_test_codebase();
                    let parser = ParserService::new();
                    let indexer = IndexerService::new();

                    // Create additional test files if needed
                    let mut files_to_process = vec![];
                    for entry in walkdir::WalkDir::new(&codebase.path)
                        .into_iter()
                        .filter_map(|e| e.ok())
                        .filter(|e| {
                            e.path().extension().map(|ext| ext == "ts").unwrap_or(false)
                        })
                        .take(file_count)
                    {
                        files_to_process.push(entry.path().to_path_buf());
                    }

                    for file_path in &files_to_process {
                        let content = std::fs::read_to_string(file_path).unwrap();
                        let ast = parser.parse(&content, "typescript").unwrap();
                        let entities = indexer.extract_entities(&ast, file_path).unwrap();
                        black_box(entities);
                    }
                });
            },
        );
    }

    group.finish();
}

fn bench_parsing_performance(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let parser = ParserService::new();

    let mut group = c.benchmark_group("parsing");

    // Test different languages
    let test_cases = vec![
        ("typescript", r#"
export class ComplexClass<T> {
    private items: T[] = [];

    constructor(private config: Config) {}

    async process<U>(data: U[], transform: (item: U) => T): Promise<T[]> {
        return data.map(transform);
    }

    *[Symbol.iterator](): Iterator<T> {
        for (const item of this.items) {
            yield item;
        }
    }
}
"#),
        ("javascript", r#"
function createUser({ name, email, role = 'user' } = {}) {
    const user = {
        id: generateId(),
        name,
        email,
        role,
        createdAt: new Date(),
        permissions: getPermissions(role)
    };

    return database.users.save(user);
}

const generateId = () => Math.random().toString(36).substr(2, 9);
"#),
        ("python", r#"
from typing import List, Dict, Optional, TypeVar, Generic
from dataclasses import dataclass
from abc import ABC, abstractmethod

T = TypeVar('T')

class Repository(Generic[T], ABC):
    @abstractmethod
    async def find_by_id(self, id: str) -> Optional[T]:
        pass

    @abstractmethod
    async def save(self, entity: T) -> T:
        pass

@dataclass
class User:
    id: str
    name: str
    email: str
    created_at: datetime

class UserRepository(Repository[User]):
    async def find_by_id(self, id: str) -> Optional[User]:
        return self._users.get(id)

    async def save(self, user: User) -> User:
        self._users[user.id] = user
        return user
"#),
    ];

    for (language, code) in test_cases {
        group.bench_with_input(
            BenchmarkId::new("language", language),
            language,
            |b, &language| {
                b.to_async(&rt).iter(|| async {
                    let ast = parser.parse(black_box(code), language).unwrap();
                    black_box(ast);
                });
            },
        );
    }

    group.finish();
}

fn bench_entity_extraction(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let parser = ParserService::new();
    let indexer = IndexerService::new();

    let mut group = c.benchmark_group("entity_extraction");

    let test_code = r#"
export class ServiceManager {
    private services: Map<string, Service> = new Map();

    constructor(private config: Configuration) {}

    registerService<T extends Service>(name: string, service: T): void {
        this.services.set(name, service);
    }

    getService<T extends Service>(name: string): T | null {
        return (this.services.get(name) as T) || null;
    }

    async initializeServices(): Promise<void> {
        for (const [name, service] of this.services) {
            await service.initialize();
        }
    }
}

interface Service {
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
}

interface Configuration {
    database: DatabaseConfig;
    cache: CacheConfig;
    logging: LoggingConfig;
}

type ServiceFactory<T extends Service> = () => T;
"#;

    group.bench_function("typescript_entities", |b| {
        b.to_async(&rt).iter(|| async {
            let ast = parser.parse(test_code, "typescript").unwrap();
            let entities = indexer.extract_entities(&ast, Path::new("test.ts")).unwrap();
            black_box(entities);
        });
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_indexing_performance,
    bench_parsing_performance,
    bench_entity_extraction
);
criterion_main!(benches);