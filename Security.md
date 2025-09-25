# Security Policy

## 🛡️ Security Reporting

### Reporting a Vulnerability

We take security seriously and appreciate your efforts to responsibly disclose your findings.

**Please DO NOT**:
- Create a public GitHub issue for security vulnerabilities
- Discuss the vulnerability in public channels (Discord, social media, etc.)
- Attempt to exploit the vulnerability beyond what's necessary to demonstrate it

**Please DO**:
- Report vulnerabilities privately to our security team
- Provide as much detail as possible about the vulnerability
- Include steps to reproduce the issue
- Suggest potential mitigations if possible

### How to Report

**Email**: security@codesight-mcp.com
**PGP Key**: [Available upon request]

Please include the following information in your report:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Affected versions
- Suggested fix (if known)

Our security team will acknowledge receipt within 48 hours and provide an estimated timeline for resolution.

## 🔒 Security Features

### Data Privacy

- **Local Processing**: All code analysis happens locally on your machine
- **No Telemetry**: We do not collect any telemetry or usage data
- **No Data Transmission**: Your code never leaves your local environment
- **Encrypted Storage**: SQLite database uses encrypted storage when available

### Access Control

- **File System Access**: Limited to directories you explicitly specify for indexing
- **Network Access**: No outbound network connections required for core functionality
- **Process Isolation**: MCP protocol runs in isolated process
- **User Permissions**: Respects system file permissions

### Code Security

- **Input Validation**: All file inputs are validated before processing
- **Path Traversal Protection**: Prevents directory traversal attacks
- **Safe Deserialization**: Secure handling of serialized data
- **Memory Safety**: Rust components provide memory safety guarantees

## 🚨 Supported Versions

| Version | Security Support |
|---------|------------------|
| 0.1.x   | ✅ Supported     |
| < 0.1.0 | ❌ Unsupported   |

Security updates are provided for the latest stable version only.

## 🧪 Vulnerability Management

### Response Timeline

- **Critical**: 48 hours - Public disclosure within 7 days of fix
- **High**: 7 days - Public disclosure within 14 days of fix
- **Medium**: 14 days - Public disclosure within 30 days of fix
- **Low**: 30 days - Public disclosure within 60 days of fix

### Severity Classification

**Critical**:
- Remote code execution
- Privilege escalation
- Data exfiltration

**High**:
- Local code execution
- Bypass of security controls
- Sensitive data exposure

**Medium**:
- Denial of service
- Information disclosure
- Authorization bypass

**Low**:
- Minor information leaks
- Configuration issues
- UI redress attacks

## 🔐 Dependencies

We regularly audit and update dependencies to address security vulnerabilities:

- **Automated Scanning**: GitHub Dependabot and npm audit
- **Manual Review**: Critical dependencies manually reviewed
- **Update Policy**: Security patches applied within 7 days
- **Vendored Dependencies**: All third-party code is audited

### Current Dependencies

**TypeScript Dependencies**:
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `better-sqlite3` - SQLite database access
- `zod` - Runtime type validation

**Rust Dependencies**:
- `napi` & `napi-derive` - Node.js bindings
- `tree-sitter` - Parser generation
- `serde` - Serialization

## 📋 Security Best Practices

### For Users

1. **Source Code Verification**
   - Only install from official sources
   - Verify checksums when available
   - Review code before using in production

2. **Environment Security**
   - Run with appropriate user permissions
   - Use in isolated development environments when possible
   - Regular updates to dependencies

3. **Data Protection**
   - Only index code you have permission to analyze
   - Be cautious with sensitive code repositories
   - Regular backup of indexed data

### For Developers

1. **Code Review**
   - All code changes require security review
   - Focus on FFI boundary security
   - Regular security audits

2. **Testing**
   - Security testing included in CI/CD pipeline
   - Fuzz testing for parser components
   - Memory safety validation for Rust code

3. **Documentation**
   - Security considerations documented
   - Secure usage examples provided
   - Known limitations clearly stated

## 🤝 Coordinated Disclosure

We follow responsible disclosure practices and believe in coordinated vulnerability disclosure. We will work with reporters to ensure vulnerabilities are addressed before public disclosure.

### Credit

Security researchers will be credited in security advisories unless they prefer to remain anonymous.

### Bounty Program

We currently do not offer a formal bug bounty program, but significant security contributions may be rewarded with:

- Public acknowledgment
- Project merchandise
- Invitation to private beta programs

## 📞 Contact

- **Security Team**: security@codesight-mcp.com
- **GitHub Security**: [Private vulnerability reporting](https://github.com/your-org/codesight-mcp/security/advisories/new)
- **Emergencies**: Contact maintainers directly via PGP encrypted email

## 🔄 Updates

This security policy will be reviewed and updated:
- Every 6 months
- After significant security incidents
- When new threats or vulnerabilities are identified

---

Last updated: September 2024