# Git Workflow Guide

This project follows the GitHub Flow branching strategy, which is a lightweight, branch-based workflow that supports teams and projects where deployments are made regularly.

## Workflow Steps

### 1. Create an Issue

#### Manual Method

- Navigate to the project's Issues tab
- Use appropriate issue template
- Fill in all required information
- Add relevant labels and assignees
- Link to related issues/PRs if applicable

#### Automated Method (Recommended)

```bash
npm run task "Task Title" "Task Description"
```

This command:

- Creates a GitHub issue using GitHub CLI
- Creates and switches to a task-specific branch
- Updates currentTask.md with task details

Prerequisites:

- GitHub CLI installed (`sudo apt install gh` or `brew install gh`)
- Authenticated with GitHub (`gh auth login`)

Example:

```bash
npm run task "Add Login Page" "Implement user authentication with:
- GitHub OAuth provider
- Protected routes
- Session management
- User profile page"
```

### 2. Create a Branch

#### Automated (via npm run task)

The branch is automatically created following our naming convention:

```
task/{issue-number}-{sanitized-title}
```

#### Manual Method

- Branch naming convention: `type/issue-number-brief-description`
  - Types: feature/, bugfix/, hotfix/, docs/, refactor/
  - Example: `feature/123-add-login-page`
- Create branch from latest main:
  ```bash
  git checkout main
  git pull origin main
  git checkout -b feature/123-add-login-page
  ```

### 3. Make Changes

- Follow project coding standards
- Commit messages must follow Conventional Commits:

  ```
  type(scope): description

  [optional body]

  [optional footer]
  ```

  - Types: feat, fix, docs, style, refactor, test, chore
  - Example: `feat(auth): add login page component`

### 4. Create Pull Request

- Push your branch:
  ```bash
  git push origin feature/123-add-login-page
  ```
- Create PR using the template
- Link related issue(s)
- Add appropriate reviewers
- Fill in all sections of the PR template

### 5. Review Process

- At least one approval required
- All automated checks must pass
- Address review comments promptly
- Keep PR updated with main:
  ```bash
  git checkout feature/123-add-login-page
  git fetch origin
  git rebase origin/main
  git push origin feature/123-add-login-page --force
  ```

### 6. Merge and Cleanup

- Squash and merge PR
- Delete branch after merge
- Close related issue(s)
- Verify deployment (if applicable)

## Branch Protection Rules

### Main Branch

- Require pull request reviews before merging
- Require status checks to pass before merging
- Require conversation resolution before merging
- Include administrators in these restrictions
- Allow force pushes: Never
- Allow deletions: Never

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- feat: New feature
- fix: Bug fix
- docs: Documentation only changes
- style: Changes that do not affect the meaning of the code
- refactor: Code change that neither fixes a bug nor adds a feature
- test: Adding missing tests or correcting existing tests
- chore: Changes to the build process or auxiliary tools

### Examples

```bash
feat(auth): add login page component
fix(nav): correct dropdown menu positioning
docs(readme): update installation instructions
style(lint): format according to new rules
refactor(api): simplify error handling
test(auth): add unit tests for login
chore(deps): update dependencies
```

## Code Review Guidelines

### Reviewer Responsibilities

- Check code quality and standards
- Verify functionality
- Review documentation
- Ensure test coverage
- Check for security issues
- Verify performance impact

### Author Responsibilities

- Respond to feedback promptly
- Test changes thoroughly
- Keep PR size manageable
- Update documentation
- Resolve conflicts with main

## Hotfix Process

For urgent production fixes:

1. Create hotfix branch from main
2. Make minimal required changes
3. Follow expedited review process
4. Deploy immediately after merge
5. Document incident and resolution

## Troubleshooting

### Task Creation Issues

1. **GitHub CLI Authentication**:

   ```bash
   gh auth status
   gh auth login
   ```

2. **Branch Creation Fails**:

   - Ensure you have no uncommitted changes
   - Verify GitHub CLI is properly authenticated
   - Check repository permissions

3. **Documentation Updates**:
   - Verify write permissions to cline_docs directory
   - Check for file lock issues

## Additional Resources

- [GitHub Flow Guide](https://guides.github.com/introduction/flow/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Documentation](https://git-scm.com/doc)
- [GitHub CLI Documentation](https://cli.github.com/manual/)

## Updates and Revisions

Last Updated: November 16, 2024

- Added automated task creation workflow using GitHub CLI
- Added troubleshooting section for task creation
- Updated Additional Resources with GitHub CLI documentation
- Added Prerequisites section for automated workflow
