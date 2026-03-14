# Configure Reference Tables

## Project Type Detection

Check files in this order (first match wins):

| File Present | Dependency / Sub-check | Type |
|---|---|---|
| `package.json` | `next` | nextjs |
| `package.json` | `@nestjs/core` | nestjs |
| `package.json` | `express` | express |
| `package.json` | `react` | react |
| `package.json` | `vue` | vue |
| `package.json` | *(none matched)* | javascript |
| `build.gradle(.kts)` | — | gradle-java |
| `pom.xml` | — | maven-java |
| `requirements.txt` / `pyproject.toml` | + `manage.py` | django |
| `requirements.txt` / `pyproject.toml` | + `app.py`/`wsgi.py` | flask |
| `requirements.txt` / `pyproject.toml` | *(none matched)* | python |
| `Cargo.toml` | — | rust |
| `go.mod` | — | go |
| `Gemfile` | + `config/routes.rb` | rails |
| `Gemfile` | *(none matched)* | ruby |

## Build/Test Commands by Type

| Type | Build Command | Test Command |
|------|--------------|--------------|
| javascript | `npm run build` | `npm test` |
| nextjs | `npm run build` | `npm test` |
| nestjs | `npm run build` | `npm test` |
| express | `npm run build \|\| tsc` | `npm test` |
| gradle-java | `./gradlew build -x test -x javadoc --offline` | `./gradlew test --offline` |
| maven-java | `mvn package -DskipTests` | `mvn test` |
| python | `python -m py_compile **/*.py` | `pytest` |
| django | `python manage.py check` | `python manage.py test` |
| rust | `cargo build` | `cargo test` |
| go | `go build ./...` | `go test ./...` |

## Codebase Pattern Categories to Scan

Use Glob to scan for architectural patterns. For each, check both suffix-based (`*{Pattern}.{ts,js,java,py,rb}`) and directory-based (`{patterns}/**`) globs.

- **Core:** Controllers, Services, Repositories, Models/Entities, Handlers
- **Data Transfer:** DTOs, Requests, Responses, Mappers, Validators, Schemas
- **Frontend:** Components, Hooks, Contexts, Stores, Pages, Layouts
- **API/Routes:** API Routes, Middleware, Guards, Interceptors, Filters
- **Testing:** Tests/Specs, Fixtures, Factories, Mocks
- **Utilities:** Utils, Helpers, Constants, Types/Interfaces, Config
- **Framework-Specific:** Modules, Pipes, Decorators, Blueprints, Views, Serializers
- **Background/Async:** Jobs, Workers, Events, Listeners, Commands
- **Database:** Migrations, Seeds
- **Error Handling:** Exceptions, Errors

For each pattern found: count matching files, identify primary location, sample 1 filename.

## Runnable Command Categories

Scan config files (`package.json` scripts, `Makefile` targets, `pyproject.toml` scripts, `Cargo.toml`, `build.gradle` tasks, `composer.json` scripts, `Rakefile` tasks) for commands in these categories:

Build, Test, Lint, Format, Type Check, Dev Server, Database (migrate/seed), Docker, Deploy, Clean, Generate

Skill naming: `run-{category}` (e.g., `run-build`, `run-tests`, `run-lint`).

For each command found: record exact syntax, note variants (e.g., `test:unit`, `test:e2e`), and environment requirements. Only include commands that are actually detected.

## Config Schema

```json
{
  "projectType": "{type}",
  "ticket": {
    "pattern": "{regex-pattern-or-null}",
    "extractFromBranch": true
  },
  "branch": {
    "convention": "{convention}"
  },
  "build": {
    "command": "{build-command}",
    "testCommand": "{test-command}",
    "timeout": {
      "compile": 120000,
      "test": 300000
    }
  },
  "tools": {
    "coderabbit": {
      "available": false,
      "authenticated": false
    },
    "ide": {
      "available": false,
      "type": null
    },
    "context7": {
      "available": false
    },
    "skillCreator": {
      "available": false
    }
  },
  "reviewTool": "claude",
  "git": {
    "autoCommit": false,
    "commitMessage": {
      "pattern": "{ticket-id} {short-description}"
    }
  },
  "dotFiveFolder": {
    "gitignore": true
  }
}
```

Fill all values from user responses. Write with pretty-printed JSON. Read back to verify correctness.
