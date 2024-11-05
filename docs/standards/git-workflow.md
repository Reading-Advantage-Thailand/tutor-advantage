# Git Workflow Guidelines

## Branch Strategy

### Main Branches

- `main` - Production-ready code
- `develop` - Integration branch for features
- `staging` - Pre-production testing

### Feature Branches

- Branch from: `develop`
- Merge back into: `develop`
- Naming convention: `feature/[issue-number]-brief-description`
- Example: `feature/123-oauth-implementation`

### Bugfix Branches

- Branch from: `develop`
- Merge back into: `develop`
- Naming convention: `bugfix/[issue-number]-brief-description`
- Example: `bugfix/124-fix-login-validation`

### Hotfix Branches

- Branch from: `main`
- Merge back into: `main` and `develop`
- Naming convention: `hotfix/[issue-number]-brief-description`
- Example: `hotfix/125-critical-security-fix`

## Branch Protection Rules

### Main Branch (`main`)

- Requires pull request reviews before merging
- Requires status checks to pass before merging
- Requires linear history (no merge commits)
- Enforces up-to-date branches before merging
- Includes administrators in restrictions

### Develop Branch (`develop`)

- Requires pull request reviews before merging
- Requires status checks to pass before merging
- Allows squash merging

## Commit Guidelines

### Conventional Commits

Follow the Conventional Commits specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc)
- `refactor`: Code changes that neither fix bugs nor add features
- `test`: Adding or modifying tests
- `chore`: Changes to build process or auxiliary tools

#### Examples

```
feat(auth): implement password reset functionality

- Add reset password form
- Create reset token generation
- Send reset email functionality

Closes #127
```

```
fix(validation): correct email validation regex

Updated regex pattern to properly validate email addresses
containing plus signs.

Fixes #128
```

## Pull Request Process

1. **Creation**

   - Create PR from feature branch to target branch
   - Fill out PR template completely
   - Link related issues
   - Assign reviewers

2. **Review Process**

   - At least one approval required
   - All comments must be resolved
   - All checks must pass
   - Maintain civil and constructive discourse

3. **Merging**
   - Squash and merge for feature branches
   - Ensure linear history
   - Delete branch after merging

### PR Template

```markdown
## Description

[Provide a brief description of the changes]

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## How Has This Been Tested?

[Describe the tests that you ran]

## Checklist

- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code where necessary
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix/feature works
- [ ] New and existing tests pass locally
```

## Code Review Guidelines

### Reviewer Responsibilities

1. **Code Quality**

   - Check for clean, readable code
   - Verify proper error handling
   - Ensure appropriate test coverage
   - Look for potential security issues

2. **Architecture**

   - Evaluate design decisions
   - Check for proper separation of concerns
   - Verify scalability considerations

3. **Standards Compliance**
   - Verify adherence to coding standards
   - Check documentation completeness
   - Ensure proper typing (TypeScript)

### Author Responsibilities

1. **PR Quality**

   - Keep PRs focused and reasonable in size
   - Provide clear description and context
   - Respond to feedback promptly
   - Keep PR up-to-date with target branch

2. **Testing**
   - Include appropriate tests
   - Verify all tests pass
   - Test edge cases
   - Document test scenarios

## Git Best Practices

### Daily Workflow

1. Start of day:

   ```bash
   git checkout develop
   git pull origin develop
   ```

2. Create/update feature branch:

   ```bash
   git checkout -b feature/new-feature
   # or
   git checkout feature/existing-feature
   git rebase develop
   ```

3. Regular commits:

   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

4. Push changes:
   ```bash
   git push origin feature/new-feature
   ```

### Keeping Branches Updated

```bash
# Update develop
git checkout develop
git pull origin develop

# Update feature branch
git checkout feature/my-feature
git rebase develop
```

### Handling Conflicts

1. During rebase:

   ```bash
   git rebase develop
   # Fix conflicts
   git add .
   git rebase --continue
   ```

2. During merge:
   ```bash
   git merge develop
   # Fix conflicts
   git add .
   git commit -m "resolve merge conflicts"
   ```

## Release Process

1. **Create Release Branch**

   ```bash
   git checkout develop
   git checkout -b release/v1.0.0
   ```

2. **Version Bump**

   - Update version in package.json
   - Update CHANGELOG.md
   - Commit changes

3. **Testing**

   - Deploy to staging environment
   - Run full test suite
   - Perform QA testing

4. **Finalize Release**

   ```bash
   git checkout main
   git merge release/v1.0.0
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin main --tags
   ```

5. **Post-Release**
   ```bash
   git checkout develop
   git merge main
   git push origin develop
   ```

## Troubleshooting

### Common Issues

1. **Accidentally committed to wrong branch**

   ```bash
   git reset HEAD~1
   git stash
   git checkout correct-branch
   git stash pop
   ```

2. **Need to undo last commit**

   ```bash
   # Undo commit but keep changes
   git reset --soft HEAD~1

   # Undo commit and discard changes
   git reset --hard HEAD~1
   ```

3. **Clean up local branches**
   ```bash
   git fetch -p
   git branch -vv | grep ': gone]' | awk '{print $1}' | xargs git branch -D
   ```
