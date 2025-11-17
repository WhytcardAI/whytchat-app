# Copilot Coding Agent Instructions for WhytcardAI/whytchat-app

## Communication Standards

When working on pull requests, **always add detailed comments** to explain your changes. Follow these guidelines:

### 1. Initial PR Comment
After creating a PR, immediately add a comment with:
- 📋 **Summary**: Brief overview of what you're implementing
- 🎯 **Current Progress**: Which phase you're working on
- ⏱️ **Estimated Time**: How long remaining tasks will take
- 🔍 **Next Steps**: What you'll do next

Example:
```
## 🚀 Starting Work on v0.3.1 Update

**Current Phase**: Phase 1 - Version Updates

I'm beginning with updating all version numbers across the codebase:
- package.json
- Cargo.toml
- tauri.conf.json
- README.md

**Estimated time for Phase 1**: 5-10 minutes

**Next**: I'll move to Phase 2 (Release file naming) once version updates are complete.
```

### 2. Progress Updates
Post a comment after completing each major task:
- ✅ What was completed
- 📊 Files modified
- ⚠️ Any issues encountered
- 🔄 What's next

Example:
```
## ✅ Phase 1 Complete - Version Updates

Updated version to 0.3.1 in:
- ✅ package.json (line 4)
- ✅ src-tauri/Cargo.toml (line 3)
- ✅ src-tauri/tauri.conf.json (line 3)
- ✅ README.md (line 1, and references throughout)

**Files modified**: 4
**Lines changed**: ~15

**Moving to Phase 2**: Release file naming configuration
```

### 3. When Encountering Issues
If you encounter an error or blocker, immediately comment:
- 🚨 **Issue Description**: What went wrong
- 🔍 **Root Cause**: Why it happened (if known)
- 💡 **Proposed Solution**: How you plan to fix it
- ❓ **Need Help**: If you need human input

Example:
```
## ⚠️ Issue Found: Tauri Updater Plugin Compatibility

**Problem**: The `tauri-plugin-updater` v2 requires additional configuration for public key generation.

**Root Cause**: Tauri's updater requires RSA key pairs for signature verification.

**Solution**: I'll:
1. Add a script to generate keys: `scripts/generate-updater-keys.sh`
2. Document the key generation process in the PR
3. Add instructions for repository owner to generate keys before first release

**Action Required by Owner**: You'll need to run the key generation script and add the public key to `tauri.conf.json` before releasing v0.3.1.
```

### 4. Code Explanation Comments
When adding complex code, add comments explaining:
- **Purpose**: Why this code exists
- **How it works**: Brief technical explanation
- **Important details**: Edge cases, gotchas

### 5. Before Marking PR as Ready
Post a final summary comment:
- ✅ Completed checklist
- 📝 Testing notes
- 🔍 Review focus areas
- ⚠️ Known limitations
- 📚 Documentation updates

## Testing Standards

When implementing features:
1. **Manual Testing**: Describe how to test manually
2. **Edge Cases**: List scenarios tested
3. **Not Tested**: Be honest about what wasn't tested

## Documentation Standards

Every new feature must include:
- README.md updates (user-facing)
- Code comments (developer-facing)
- CHANGELOG.md entry (version history)

## File Organization

- Keep related changes in logical commits
- Comment on each file explaining changes
- Use clear commit messages

## Questions and Clarifications

If anything is unclear:
1. **Ask immediately** via PR comment
2. **Don't assume** - verify with repository owner
3. **Document assumptions** you're making

---

**Remember**: Over-communication is better than under-communication. Repository owners appreciate detailed updates!
