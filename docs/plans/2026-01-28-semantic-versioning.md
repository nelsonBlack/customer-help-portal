# Semantic Versioning Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement aligned Semantic Versioning (SemVer) across all four projects starting at v1.0.0

**Architecture:** Each project will use standard SemVer format (MAJOR.MINOR.PATCH). All projects start at 1.0.0 to represent current stable state. Git tags will mark releases. Flutter uses version+buildNumber format.

**Tech Stack:** npm (package.json), Flutter (pubspec.yaml), git tags

---

## SemVer Rules Reference

- **MAJOR**: Breaking API/UI changes, incompatible changes
- **MINOR**: New features, backwards compatible
- **PATCH**: Bug fixes, backwards compatible

---

### Task 1: Update EasyBill Flutter Version

**Files:**
- Modify: `easybill/pubspec.yaml:7`

**Step 1: Update version in pubspec.yaml**

Change from:
```yaml
version: "2.0.0+2018"
```

To:
```yaml
version: "1.0.0+1"
```

**Step 2: Verify pubspec.yaml is valid**

Run: `cd easybill && /Users/nelson/development/flutter/bin/flutter pub get`
Expected: "Got dependencies!"

**Step 3: Create git tag**

```bash
cd easybill
git add pubspec.yaml
git commit -m "chore: align version to SemVer 1.0.0"
git tag -a v1.0.0 -m "Release v1.0.0 - Initial aligned SemVer release"
```

---

### Task 2: Update Analog Water Backend Version

**Files:**
- Modify: `analog-meter-project/app/package.json:3`

**Step 1: Update version in package.json**

Version already at `1.0.0` - verify and tag.

**Step 2: Create git tag**

```bash
cd analog-meter-project
git tag -a v1.0.0 -m "Release v1.0.0 - Initial aligned SemVer release"
```

---

### Task 3: Update Angular Frontend Version

**Files:**
- Modify: `frontend-analog-meter-project/app/package.json:3`

**Step 1: Update version in package.json**

Change from:
```json
"version": "20.0.0",
```

To:
```json
"version": "1.0.0",
```

**Step 2: Verify package.json is valid**

Run: `cd frontend-analog-meter-project/app && npm pkg get version`
Expected: `"1.0.0"`

**Step 3: Create git tag**

```bash
cd frontend-analog-meter-project
git add app/package.json
git commit -m "chore: align version to SemVer 1.0.0"
git tag -a v1.0.0 -m "Release v1.0.0 - Initial aligned SemVer release"
```

---

### Task 4: Update Realtor Backend Version

**Files:**
- Modify: `realator_backend/app/package.json:3`

**Step 1: Update version in package.json**

Version already at `1.0.0` - verify and tag.

**Step 2: Create git tag**

```bash
cd realator_backend
git tag -a v1.0.0 -m "Release v1.0.0 - Initial aligned SemVer release"
```

---

### Task 5: Push All Tags to Remote

**Step 1: Push tags for all repositories**

```bash
cd easybill && git push origin v1.0.0
cd ../analog-meter-project && git push origin v1.0.0
cd ../frontend-analog-meter-project && git push origin v1.0.0
cd ../realator_backend && git push origin v1.0.0
```

---

### Task 6: Create VERSION_GUIDE.md

**Files:**
- Create: `docs/VERSION_GUIDE.md`

**Step 1: Create versioning guide document**

Document the SemVer conventions for the team.

---

## Verification Checklist

- [ ] All projects at version 1.0.0
- [ ] All repositories have v1.0.0 tag
- [ ] All tags pushed to remote
- [ ] VERSION_GUIDE.md created
