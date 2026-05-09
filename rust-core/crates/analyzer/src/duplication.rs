//! Duplicate code detection using Rabin-Karp rolling hash.

use anyhow::Result;
use std::collections::HashMap;

/// A detected duplicate block.
#[derive(Debug, Clone)]
pub struct DuplicateBlock {
    pub file_a: String,
    pub file_b: String,
    pub start_line_a: u32,
    pub start_line_b: u32,
    pub length: u32,
    pub content: String,
}

/// Find duplicate code blocks across files.
///
/// `files` — slice of `(file_path, content)` pairs.
/// `min_lines` — minimum block length to consider a duplicate.
pub fn find_duplicates(
    files: &[(&str, &str)],
    min_lines: usize,
) -> Result<Vec<DuplicateBlock>> {
    if min_lines == 0 || files.is_empty() {
        return Ok(vec![]);
    }

    // 1. Normalize each file into lines and compute rolling hashes.
    let base: u64 = 257;
    let modulus: u64 = 1_000_000_007;

    let mut file_lines: Vec<(String, Vec<String>)> = Vec::with_capacity(files.len());
    for (path, content) in files {
        let lines: Vec<String> = content
            .lines()
            .map(|l| l.trim().to_lowercase())
            .collect();
        file_lines.push((path.to_string(), lines));
    }

    // 2. Build a map: hash → [(file_idx, start_line)]
    let mut hash_map: HashMap<u64, Vec<(usize, usize)>> = HashMap::new();

    for (file_idx, (_path, lines)) in file_lines.iter().enumerate() {
        if lines.len() < min_lines {
            continue;
        }

        // Precompute powers
        let mut pow = 1u64;
        for _ in 0..min_lines {
            pow = (pow * base) % modulus;
        }

        let mut window_hash = 0u64;
        for i in 0..min_lines {
            let line_hash = fast_hash(&lines[i]);
            window_hash = (window_hash * base + line_hash) % modulus;
        }
        hash_map
            .entry(window_hash)
            .or_default()
            .push((file_idx, 0));

        for start in 1..=lines.len() - min_lines {
            let outgoing = fast_hash(&lines[start - 1]);
            let incoming = fast_hash(&lines[start + min_lines - 1]);
            window_hash = (window_hash + modulus - (outgoing * pow) % modulus) % modulus;
            window_hash = (window_hash * base + incoming) % modulus;

            hash_map
                .entry(window_hash)
                .or_default()
                .push((file_idx, start));
        }
    }

    // 3. For each hash with >1 occurrence, verify exact match and emit blocks.
    let mut duplicates = Vec::new();
    let mut seen_pairs: HashMap<(usize, usize, usize, usize), bool> = HashMap::new();

    for (_hash, occurrences) in hash_map {
        if occurrences.len() < 2 {
            continue;
        }

        for i in 0..occurrences.len() {
            for j in (i + 1)..occurrences.len() {
                let (file_a_idx, start_a) = occurrences[i];
                let (file_b_idx, start_b) = occurrences[j];

                // Skip same-file duplicates for now (can be enabled later)
                if file_a_idx == file_b_idx {
                    continue;
                }

                let key = (file_a_idx, start_a, file_b_idx, start_b);
                if seen_pairs.contains_key(&key) {
                    continue;
                }
                seen_pairs.insert(key, true);

                let (_path_a, lines_a) = &file_lines[file_a_idx];
                let (_path_b, lines_b) = &file_lines[file_b_idx];

                let max_len = (lines_a.len() - start_a).min(lines_b.len() - start_b);
                let mut match_len = 0usize;
                for k in 0..max_len {
                    if lines_a[start_a + k] == lines_b[start_b + k] {
                        match_len += 1;
                    } else {
                        break;
                    }
                }

                if match_len >= min_lines {
                    let content = lines_a[start_a..start_a + match_len].join("\n");
                    duplicates.push(DuplicateBlock {
                        file_a: file_lines[file_a_idx].0.clone(),
                        file_b: file_lines[file_b_idx].0.clone(),
                        start_line_a: (start_a + 1) as u32,
                        start_line_b: (start_b + 1) as u32,
                        length: match_len as u32,
                        content,
                    });
                }
            }
        }
    }

    Ok(duplicates)
}

/// Fast string hash for a single line.
fn fast_hash(s: &str) -> u64 {
    let mut h: u64 = 5381;
    for b in s.bytes() {
        h = ((h << 5).wrapping_add(h)).wrapping_add(b as u64);
    }
    h
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_no_duplicates() {
        let files = vec![
            ("a.ts", "function a() { return 1; }"),
            ("b.ts", "function b() { return 2; }"),
        ];
        let dups = find_duplicates(&files, 2).unwrap();
        assert!(dups.is_empty());
    }

    #[test]
    fn test_exact_duplicate() {
        let files = vec![
            (
                "a.ts",
                "function helper() {\n  return 42;\n}\n",
            ),
            (
                "b.ts",
                "function helper() {\n  return 42;\n}\n",
            ),
        ];
        let dups = find_duplicates(&files, 2).unwrap();
        assert!(!dups.is_empty());
        assert_eq!(dups[0].file_a, "a.ts");
        assert_eq!(dups[0].file_b, "b.ts");
    }
}
