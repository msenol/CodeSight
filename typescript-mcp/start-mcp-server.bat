@echo off
echo Starting Code Intelligence MCP Server...
cd /d F:\Development\Projects\ProjectAra\typescript-mcp
set LOG_LEVEL=debug
set LOG_DIR=F:\Development\Projects\ProjectAra\typescript-mcp\logs
node dist\index.js
pause