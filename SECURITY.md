# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| < 0.2   | :x:                |

## Reporting a Vulnerability

We take the security of WhytChat seriously. If you discover a security vulnerability, please follow these steps:

### 1. **DO NOT** disclose the vulnerability publicly

Please do not create a public GitHub issue for security vulnerabilities.

### 2. Report privately

Send an email to: **security@whytcard.com** (or use GitHub Security Advisories)

Include:
- A description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Any suggested fixes (optional)

### 3. Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - **Critical**: Within 7 days
  - **High**: Within 14 days
  - **Medium**: Within 30 days
  - **Low**: Next release cycle

### 4. Disclosure Policy

Once a fix is available:
1. We will notify you
2. We will release a patch
3. We will publish a security advisory
4. We will credit you (unless you prefer to remain anonymous)

## Security Best Practices

### For Users

- **Keep WhytChat updated** to the latest version
- **Download models only from trusted sources** (Hugging Face official repositories)
- **Review system prompts** before using community-shared prompts
- **Enable firewall** (llama-server runs on localhost:8080)
- **Scan downloaded models** with antivirus if concerned
- **Back up your conversations** regularly (data/whytchat.db)

### For Developers

- **Never commit secrets** to the repository
- **Validate all user inputs** in Tauri commands
- **Use prepared statements** for SQLite queries (prevent SQL injection)
- **Sanitize file paths** to prevent path traversal
- **Review Rust unsafe code** (we currently have zero unsafe blocks)
- **Run `cargo clippy`** before committing Rust code
- **Run `npm run check:lint`** before committing TypeScript code

## Known Security Considerations

### 1. Local Server (llama-server)

- **Runs on localhost:8080** by default
- **Not exposed to network** (127.0.0.1 only)
- **No authentication** (not needed for local-only access)
- ⚠️ **Do NOT expose** this port to external networks

### 2. Model Files (GGUF)

- Downloaded from **Hugging Face** (community models)
- **User responsibility** to verify model sources
- Models are **binary files** that run in llama.cpp
- ⚠️ **Malicious models could potentially** execute arbitrary code during inference

### 3. System Prompts

- Stored in **SQLite database** (plaintext)
- **User-created content** (not sandboxed)
- ⚠️ **Avoid using untrusted** system prompts from unknown sources

### 4. Dependencies

- **Tauri v2**: Sandboxed environment, explicit permissions
- **llama.cpp**: Community-maintained, regular security updates
- **Rust dependencies**: Audited with `cargo audit`
- **npm dependencies**: Audited with `npm audit`

### 5. Data Privacy

✅ **100% Local**: All data stays on your machine  
✅ **No Telemetry**: Zero analytics or tracking  
✅ **No Cloud**: No external API calls (except model downloads)  
✅ **SQLite**: Local database with file permissions  

## Security Audits

We welcome security audits from the community. If you'd like to perform a security audit, please contact us first.

## CVE Disclosure

If a CVE is assigned to WhytChat, we will:
1. Publish a security advisory on GitHub
2. Release a patched version ASAP
3. Update this document with mitigation steps

## Questions?

For security-related questions (not vulnerabilities), open a GitHub issue with the `security` label.

---

**Last Updated**: January 2025  
**Next Review**: June 2025
