# Semantic Versioning Guide

This workspace uses [Semantic Versioning (SemVer)](https://semver.org/) for release management.

## Version Format

```
MAJOR.MINOR.PATCH
```

- **MAJOR**: Breaking changes, incompatible API changes
- **MINOR**: New features, backwards compatible
- **PATCH**: Bug fixes, backwards compatible

## Project Versions

| Project | Current Version | Versioning Strategy |
|---------|-----------------|---------------------|
| EasyBill (Flutter) | `2.x.x+build` | Independent (App Store/Play Store constraints) |
| Analog Water Backend | `1.0.0` | Aligned SemVer |
| Angular Frontend | `1.0.0` | Aligned SemVer |
| Realtor Backend | `1.0.0` | Aligned SemVer |

## Version Locations

| Project | File | Field |
|---------|------|-------|
| EasyBill | `easybill/pubspec.yaml` | `version: "X.Y.Z+build"` |
| Analog Water Backend | `analog-meter-project/app/package.json` | `"version": "X.Y.Z"` |
| Angular Frontend | `frontend-analog-meter-project/app/package.json` | `"version": "X.Y.Z"` |
| Realtor Backend | `realator_backend/app/package.json` | `"version": "X.Y.Z"` |

## When to Increment

### MAJOR (1.0.0 → 2.0.0)
- Breaking API changes
- Database schema changes requiring migration
- Incompatible GraphQL schema changes
- Major UI/UX overhauls

### MINOR (1.0.0 → 1.1.0)
- New features
- New API endpoints
- New UI components
- Non-breaking GraphQL additions

### PATCH (1.0.0 → 1.0.1)
- Bug fixes
- Performance improvements
- Documentation updates
- Dependency updates (non-breaking)

## Release Process

### 1. Update Version
```bash
# For npm projects (backends, Angular)
npm version patch|minor|major

# For Flutter
# Edit pubspec.yaml manually: version: "X.Y.Z+build"
```

### 2. Create Git Tag
```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z - Description"
```

### 3. Push Tag
```bash
git push origin vX.Y.Z
```

## EasyBill Mobile App Notes

The Flutter app follows app store versioning rules:
- **version**: Marketing version shown to users (e.g., `2.0.0`)
- **build number**: Internal build identifier (e.g., `+2018`)
- Build number must always increase for store submissions
- Version can stay same for multiple builds (bug fixes)

## Cross-Project Compatibility

When making changes that span multiple projects:
1. Update all affected projects
2. Use matching MINOR versions for coordinated releases
3. Document breaking changes in CHANGELOG.md

## Documentation Standards

Each project should maintain only these .md files:
- `README.md` - Project overview, setup instructions
- `CLAUDE.md` - AI assistant context (optional)
- `STYLING_GUIDE.md` - UI conventions (frontend only)

**Do NOT create:**
- Planning docs for features (delete after implementation)
- AI prompt files (use CLAUDE.md)
- Credentials in .md files (use .env)
- Status tracking docs (use GitHub issues/PRs)

Git history preserves deleted docs if needed for reference.
