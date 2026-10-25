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
    "ide": {
      "available": false,
      "type": null
    },
    "context7": {
      "available": false
    }
  },
  "advisor": false,
  "git": {
    "autoCommit": false,
    "commitMessage": {
      "pattern": "{ticket-id} {short-description}"
    }
  },
  "dotFiveFolder": {
    "gitignore": true
  },
  "rules": {
    "generate": true
  }
}
```

Fill all values from user responses. Write with pretty-printed JSON. Read back to verify correctness.
