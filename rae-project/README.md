# rae-project

Workspace for [reverse-api-engineer](https://github.com/kalil0321/reverse-api-engineer) (`rae`):
give it a website and a goal, a browser captures the site's network traffic, and a model
writes a typed API client for the endpoints the site actually uses.

## Setup

```bash
./setup.sh
```

This installs `reverse-api-engineer[manual]` with `uv`, and copies `config.example.json` to
`~/.reverse-api/config.json` if you don't already have one. Requirements:

- Python 3.11+, Node.js 20.19+ (agent mode launches browser tooling via `npx`)
- Model access: `ANTHROPIC_API_KEY`, or a logged-in Claude Code

The example config uses the `auto` provider (Playwright, headless-friendly, saves a HAR so runs
can be re-engineered). Switch to `chrome-mcp` in `/settings` if you need your own Chrome logins.

## Usage

Run from this folder, so generated clients land in `./scripts/<name>/`:

```bash
# Interactive session (Shift+Tab cycles manual / agent / engineer / collector)
reverse-api-engineer

# Check config without opening a browser
reverse-api-engineer agent -p "fetch top posts with title and score" \
  -u https://news.ycombinator.com --headless --dry-run

# Real run, scripted
reverse-api-engineer agent -p "<goal>" -u "<start url>" --headless --json-stream \
  > rae-run.ndjson 2> rae-run.log

# Past runs
reverse-api-engineer list --json
reverse-api-engineer show <run_id> --json
reverse-api-engineer engineer <run_id>      # regenerate from a saved HAR
```

Permanent run storage is `~/.reverse-api/runs/`. Review generated code before running it.

## Claude Code skill

The upstream skill is vendored at `../.claude/skills/reverse-api-engineer/` (MIT, see its
`LICENSE`), so Claude Code sessions in this repo know how to drive the CLI. Ask for e.g.
"get me a typed client for the job search on this careers page".
