@echo off
echo ========================================
echo Code Intelligence MCP Server - Real Test
echo ========================================
echo.

cd /d F:\Development\Projects\ProjectAra\typescript-mcp

echo 1. Building the project...
call npm run build
echo.

echo 2. Indexing the current project...
node dist\cli\index.js index .
echo.

echo 3. Running sample searches...
echo.
echo Searching for "search":
node dist\cli\index.js search "search" --limit 3
echo.
echo Searching for "index":
node dist\cli\index.js search "index" --limit 3
echo.
echo Searching for "function":
node dist\cli\index.js search "function" --limit 3
echo.

echo 4. Showing statistics...
node dist\cli\index.js stats
echo.

echo ========================================
echo Test Complete!
echo.
echo You can now:
echo 1. Start MCP server: node dist\index.js
echo 2. Use in Claude Desktop with the config
echo ========================================

pause