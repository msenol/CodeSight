use criterion::{black_box, criterion_group, criterion_main, Criterion};
use std::collections::HashMap;

fn memory_allocation_benchmark(c: &mut Criterion) {
    c.bench_function("vector_allocation", |b| {
        b.iter(|| {
            let mut vec: Vec<i32> = Vec::new();
            for i in 0..1000 {
                vec.push(black_box(i));
            }
            vec
        })
    });
}

fn hashmap_operations_benchmark(c: &mut Criterion) {
    c.bench_function("hashmap_operations", |b| {
        b.iter(|| {
            let mut map: HashMap<i32, String> = HashMap::new();
            for i in 0..100 {
                map.insert(black_box(i), black_box(format!("value_{}", i)));
            }
            map
        })
    });
}

fn string_operations_benchmark(c: &mut Criterion) {
    c.bench_function("string_concatenation", |b| {
        b.iter(|| {
            let mut result = String::new();
            for i in 0..100 {
                result.push_str(&black_box(format!("item_{} ", i)));
            }
            result
        })
    });
}

criterion_group!(
    benches,
    memory_allocation_benchmark,
    hashmap_operations_benchmark,
    string_operations_benchmark
);
criterion_main!(benches);