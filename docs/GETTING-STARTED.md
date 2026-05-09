# Getting Started

**Version**: v0.1.1
**Last Updated**: May 9, 2026

## Prerequisites

- [Node.js](https://nodejs.org/) v20 or higher
- [Rust](https://www.rust-lang.org/) 1.75 or higher
- Git

## Setup (3 Steps)

### 1. Clone

```bash
git clone https://github.com/msenol/CodeSight.git
cd CodeSight
```

### 2. Install & Build

```bash
npm run setup
```

This single command:
- Installs all npm dependencies (root + typescript-mcp)
- Compiles the Rust native module (NAPI-RS)
- Builds TypeScript

### 3. Verify

```bash
cd typescript-mcp && npm test
```

## Use as MCP Server

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "codesight": {
      "command": "node",
      "args": ["/path/to/CodeSight/typescript-mcp/dist/index.js"]
    }
  }
}
```

### VS Code (with MCP extension)

Same configuration as Claude Desktop — point to `dist/index.js`.

## Use as CLI

```bash
cd typescript-mcp

# Index a project
node dist/cli/index.js index /path/to/your/project

# Search code
node dist/cli/index.js search "authentication functions"

# View stats
node dist/cli/index.js stats
```

## AI Features (Optional)

CodeSight supports AI-powered code review, bug prediction, and more via LLM providers.

```bash
cd typescript-mcp
cp .env.example .env
```

Edit `.env` and set your API key:

```
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_MODEL=xiaomi/mimo-v2-flash:free
```

Get a free API key at [openrouter.ai/keys](https://openrouter.ai/keys).

## Development

```bash
# Watch mode (auto-reload on changes)
cd typescript-mcp && npm run dev

# Build only native module
npm run build:native

# Run specific test suites
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
cd ../rust-core && cargo test  # Rust tests
```

## Troubleshooting

**`npm run setup` fails on Rust build:**
- Ensure Rust is installed: `rustc --version`
- If using Windows, use WSL2 or install Visual Studio Build Tools

**MCP server not connecting in Claude Desktop:**
- Check the path in `claude_desktop_config.json` is absolute
- Restart Claude Desktop after config changes
- Test manually: `node dist/index.js` should start without errors

**Search returns no results:**
- Run `node dist/cli/index.js stats` to verify the index has data
- Re-index: `node dist/cli/index.js index /path/to/project`
