# Claude Desktop MCP Integration Guide

## Setup Complete! 🎉

Your Code Intelligence MCP server is ready to integrate with Claude Desktop.

## What We've Built

✅ **9 MCP Tools Registered:**

1. `search_code` - Natural language code search
2. `explain_function` - Function explanation
3. `find_references` - Find symbol references
4. `trace_data_flow` - Data flow tracing
5. `analyze_security` - Security vulnerability analysis
6. `get_api_endpoints` - API endpoint discovery
7. `check_complexity` - Code complexity analysis
8. `find_duplicates` - Duplicate code detection
9. `suggest_refactoring` - Refactoring suggestions

✅ **Mock Responses** - Each tool returns sample data for testing

✅ **Logging System** - Logs written to `typescript-mcp/logs/`

## Claude Desktop Configuration

### Option 1: Manual Configuration

1. Open Claude Desktop
2. Go to Settings → Developer → MCP Servers
3. Add new server with this configuration:

```json
{
  "code-intelligence": {
    "command": "node",
    "args": [
      "F:\\Development\\Projects\\ProjectAra\\typescript-mcp\\dist\\index.js"
    ],
    "env": {
      "LOG_LEVEL": "debug",
      "LOG_DIR": "F:\\Development\\Projects\\ProjectAra\\typescript-mcp\\logs"
    }
  }
}
```

### Option 2: Import Configuration

1. Copy `claude-desktop-config.json` to:
   - Windows: `%APPDATA%\Claude\`
   - macOS: `~/Library/Application Support/Claude/`
   - Linux: `~/.config/Claude/`

2. Restart Claude Desktop

## Testing the Integration

### Quick Test

1. Double-click `start-mcp-server.bat` to test server startup
2. Check logs in `typescript-mcp/logs/combined.log`

### In Claude Desktop

1. Open a new conversation
2. Type: `/tools` to see available tools
3. Test a tool:

   ```
   Use the search_code tool to find functions related to "data processing" in codebase "my-project"
   ```

## Debugging

### Check Logs

```bash
# View real-time logs
tail -f typescript-mcp/logs/combined.log

# View error logs
cat typescript-mcp/logs/error.log
```

### Common Issues

1. **Server not appearing in Claude Desktop**
   - Restart Claude Desktop
   - Check the config path is correct
   - Verify Node.js is in PATH

2. **Tools not working**
   - Check `combined.log` for errors
   - Ensure the server built successfully: `npm run build`
   - Try running manually: `node dist/index.js`

3. **Permission errors**
   - Run as administrator
   - Check file permissions on logs directory

## Development Mode

To modify and test changes:

```bash
cd typescript-mcp

# Watch mode for development
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Next Steps

1. **Test in Claude Desktop** - Restart Claude and test the tools
2. **Implement Real Functionality** - Replace mock responses with actual Rust core integration
3. **Add More Tools** - Extend with additional code intelligence features
4. **Production Setup** - Configure for production use with PostgreSQL and Redis

## File Structure

```
typescript-mcp/
├── dist/                 # Compiled JavaScript
├── logs/                 # Log files
├── src/
│   ├── tools/           # MCP tool implementations
│   │   └── index.ts     # Tool registration (9 tools)
│   ├── services/        # Service layer
│   └── index.ts         # Main entry point
├── claude-desktop-config.json  # Claude Desktop config
├── start-mcp-server.bat        # Windows test script
└── package.json
```

## Support

- Logs are in: `F:\Development\Projects\ProjectAra\typescript-mcp\logs\`
- Server runs on: stdio (standard input/output)
- Node version: 20+
- TypeScript: 5.3+

Happy testing! 🚀
