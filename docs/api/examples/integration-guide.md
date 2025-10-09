# Integration Guide

This guide provides detailed instructions for integrating the CodeSight MCP Server API into various applications and workflows.

## Table of Contents

1. [Client SDKs](#client-sdks)
2. [Language-Specific Integrations](#language-specific-integrations)
3. [CI/CD Integration](#cicd-integration)
4. [IDE Extensions](#ide-extensions)
5. [Web Applications](#web-applications)
6. [Mobile Applications](#mobile-applications)
7. [Microservices Architecture](#microservices-architecture)

## Client SDKs

### TypeScript/JavaScript SDK

```typescript
// @codesight/sdk - npm package
export class CodeSightClient {
  private baseURL: string;
  private authToken: string;
  private cache: Map<string, { data: any; timestamp: number }>;

  constructor(config: CodeSightConfig) {
    this.baseURL = config.baseURL;
    this.authToken = config.authToken;
    this.cache = new Map();
  }

  // Search code with intelligent caching
  async searchCode(query: SearchQuery): Promise<SearchResult> {
    const cacheKey = this.getCacheKey('search', query);
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const response = await this.makeRequest('/api/queries', {
      method: 'POST',
      body: JSON.stringify(query)
    });

    this.setCache(cacheKey, response);
    return response;
  }

  // Analyze security issues
  async analyzeSecurity(filePath: string, codebaseId: string): Promise<SecurityAnalysis> {
    return this.makeRequest('/api/tools/analyze_security', {
      method: 'POST',
      body: JSON.stringify({
        file_path: filePath,
        codebase_id: codebaseId,
        analysis_level: 'comprehensive'
      })
    });
  }

  // Batch operations
  async batchAnalyze(files: string[], codebaseId: string): Promise<BatchAnalysis> {
    const analyses = await Promise.allSettled(
      files.map(file => this.analyzeSecurity(file, codebaseId))
    );

    return {
      total: files.length,
      successful: analyses.filter(a => a.status === 'fulfilled').length,
      failed: analyses.filter(a => a.status === 'rejected').length,
      results: analyses.map(a => a.status === 'fulfilled' ? a.value : null)
    };
  }

  // Real-time search with debouncing
  createRealTimeSearch(delay = 300): (query: string) => Promise<SearchResult> {
    let timeoutId: NodeJS.Timeout;
    let lastQuery = '';

    return (query: string) => {
      if (query === lastQuery) return Promise.resolve(null);
      lastQuery = query;

      clearTimeout(timeoutId);
      return new Promise((resolve) => {
        timeoutId = setTimeout(async () => {
          try {
            const result = await this.searchCode({
              query,
              codebase_id: this.defaultCodebaseId,
              limit: 10
            });
            resolve(result);
          } catch (error) {
            resolve(null);
          }
        }, delay);
      });
    };
  }

  private async makeRequest(endpoint: string, options: RequestInit): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  private getCacheKey(operation: string, data: any): string {
    return `${operation}:${JSON.stringify(data)}`;
  }

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}

// Usage example
const client = new CodeSightClient({
  baseURL: 'http://localhost:4000',
  authToken: 'your-jwt-token',
  defaultCodebaseId: 'your-codebase-id'
});

// Real-time search for IDE integration
const realTimeSearch = client.createRealTimeSearch(250);

// In your text editor:
// onTextChange: debounce(async (newText) => {
//   const results = await realTimeSearch(newText);
//   updateSuggestions(results);
// }, 250)
```

### Python SDK

```python
# codesight-sdk - pip package
import asyncio
import aiohttp
import json
from typing import Dict, List, Optional, Union
from dataclasses import dataclass
from functools import wraps
import time

@dataclass
class SearchQuery:
    query: str
    codebase_id: str
    limit: int = 10
    filters: Optional[Dict] = None
    include_content: bool = False

@dataclass
class SecurityAnalysisRequest:
    file_path: str
    codebase_id: str
    analysis_level: str = "standard"

class AsyncCodeSightClient:
    def __init__(self, base_url: str, auth_token: str, timeout: int = 30):
        self.base_url = base_url
        self.auth_token = auth_token
        self.timeout = aiohttp.ClientTimeout(total=timeout)
        self._session = None

    async def __aenter__(self):
        self._session = aiohttp.ClientSession(
            headers={
                'Authorization': f'Bearer {self.auth_token}',
                'Content-Type': 'application/json'
            },
            timeout=self.timeout
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._session:
            await self._session.close()

    async def search_code(self, query: SearchQuery) -> Dict:
        """Search code asynchronously"""
        if not self._session:
            raise RuntimeError("Client must be used as async context manager")

        data = {
            'query': query.query,
            'codebase_id': query.codebase_id,
            'limit': query.limit,
            'filters': query.filters or {},
            'include_content': query.include_content
        }

        async with self._session.post(f'{self.base_url}/api/queries', json=data) as response:
            response.raise_for_status()
            return await response.json()

    async def analyze_security(self, request: SecurityAnalysisRequest) -> Dict:
        """Analyze security asynchronously"""
        data = {
            'file_path': request.file_path,
            'codebase_id': request.codebase_id,
            'analysis_level': request.analysis_level
        }

        async with self._session.post(f'{self.base_url}/api/tools/analyze_security', json=data) as response:
            response.raise_for_status()
            return await response.json()

    async def batch_analyze(self, requests: List[Union[SearchQuery, SecurityAnalysisRequest]]) -> List[Dict]:
        """Batch analyze multiple requests"""
        tasks = []
        for request in requests:
            if isinstance(request, SearchQuery):
                tasks.append(self.search_code(request))
            elif isinstance(request, SecurityAnalysisRequest):
                tasks.append(self.analyze_security(request))

        return await asyncio.gather(*tasks, return_exceptions=True)

    def search_code_sync(self, query: SearchQuery) -> Dict:
        """Synchronous wrapper for search"""
        return asyncio.run(self.search_code(query))

    def analyze_security_sync(self, request: SecurityAnalysisRequest) -> Dict:
        """Synchronous wrapper for security analysis"""
        return asyncio.run(self.analyze_security(request))

# Decorator for automatic retry
def retry_on_failure(max_retries: int = 3, delay: float = 1.0):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None

            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except aiohttp.ClientError as e:
                    last_exception = e
                    if attempt < max_retries:
                        await asyncio.sleep(delay * (2 ** attempt))  # Exponential backoff
                    else:
                        raise last_exception

            raise last_exception
        return wrapper
    return decorator

class CodeSightClient:
    """Synchronous client for backwards compatibility"""
    def __init__(self, base_url: str, auth_token: str):
        self.base_url = base_url
        self.auth_token = auth_token

    async def _run_async(self, coro):
        async with AsyncCodeSightClient(self.base_url, self.auth_token) as client:
            return await coro(client)

    def search_code(self, query: SearchQuery) -> Dict:
        return asyncio.run(self._run_async(lambda client: client.search_code(query)))

    def analyze_security(self, request: SecurityAnalysisRequest) -> Dict:
        return asyncio.run(self._run_async(lambda client: client.analyze_security(request)))

# Usage examples
async def example_usage():
    async with AsyncCodeSightClient('http://localhost:4000', 'your-token') as client:
        # Search for code
        search_query = SearchQuery(
            query="authentication function",
            codebase_id="your-codebase-id",
            limit=10
        )
        results = await client.search_code(search_query)
        print(f"Found {len(results['results'])} results")

        # Batch security analysis
        security_requests = [
            SecurityAnalysisRequest('src/auth/auth.service.ts', 'codebase-id'),
            SecurityAnalysisRequest('src/user/user.service.ts', 'codebase-id')
        ]
        analyses = await client.batch_analyze(security_requests)

        for i, analysis in enumerate(analyses):
            if isinstance(analysis, Exception):
                print(f"Analysis {i} failed: {analysis}")
            else:
                print(f"Analysis {i} found {len(analysis['result']['vulnerabilities'])} vulnerabilities")

# Synchronous usage
client = CodeSightClient('http://localhost:4000', 'your-token')
results = client.search_code(SearchQuery("authentication", "codebase-id"))
```

## Language-Specific Integrations

### VS Code Extension

```typescript
// VS Code extension - codesight-vscode
import * as vscode from 'vscode';
import { CodeSightClient } from '@codesight/sdk';

export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('codesight');
  const client = new CodeSightClient({
    baseURL: config.get('serverUrl', 'http://localhost:4000'),
    authToken: config.get('authToken', ''),
    defaultCodebaseId: config.get('codebaseId', '')
  });

  // Register commands
  const searchCommand = vscode.commands.registerCommand('codesight.search', async () => {
    const query = await vscode.window.showInputBox({
      prompt: 'Enter search query',
      placeHolder: 'e.g., authentication function with JWT'
    });

    if (query) {
      await performSearch(client, query);
    }
  });

  const explainFunctionCommand = vscode.commands.registerCommand('codesight.explainFunction', async () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);

      if (selectedText) {
        await explainFunction(client, selectedText, editor.document.fileName);
      }
    }
  });

  const analyzeSecurityCommand = vscode.commands.registerCommand('codesight.analyzeSecurity', async () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      await analyzeFileSecurity(client, editor.document.fileName);
    }
  });

  // Real-time search as you type
  const realTimeSearch = client.createRealTimeSearch(500);

  let searchTimeout: NodeJS.Timeout;
  const disposable = vscode.workspace.onDidChangeTextDocument((event) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document) {
        const currentLine = editor.document.lineAt(editor.selection.active.line).text;
        if (currentLine.trim().length > 3) {
          const results = await realTimeSearch(currentLine);
          updateSearchResults(results);
        }
      }
    }, 500);
  });

  context.subscriptions.push(
    searchCommand,
    explainFunctionCommand,
    analyzeSecurityCommand,
    disposable
  );

  // Create status bar item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
  statusBarItem.text = '$(search) CodeSight';
  statusBarItem.tooltip = 'CodeSight MCP Server';
  statusBarItem.command = 'codesight.search';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
}

async function performSearch(client: CodeSightClient, query: string) {
  try {
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Searching code...',
      cancellable: false
    }, async (progress) => {
      const results = await client.searchCode({
        query,
        codebase_id: 'default',
        limit: 20
      });

      displaySearchResults(results);
    });
  } catch (error) {
    vscode.window.showErrorMessage(`Search failed: ${error.message}`);
  }
}

function displaySearchResults(results: any) {
  const panel = vscode.window.createWebviewPanel(
    'codesightSearchResults',
    'CodeSight Search Results',
    vscode.ViewColumn.One,
    {}
  );

  panel.webview.html = getSearchResultsHtml(results);
}

function getSearchResultsHtml(results: any): string {
  const items = results.results.map((result: any) => `
    <div class="result-item">
      <h3><a href="#" class="file-link" data-file="${result.file_path}" data-line="${result.line_number}">
        ${result.name} (${result.type})
      </a></h3>
      <p><strong>File:</strong> ${result.file_path}:${result.line_number}</p>
      <p><strong>Score:</strong> ${result.score.toFixed(2)}</p>
      <pre><code>${result.snippet}</code></pre>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Search Results</title>
      <style>
        body { font-family: var(--vscode-font-family); padding: 20px; }
        .result-item { margin-bottom: 20px; padding: 15px; border: 1px solid var(--vscode-panel-border); border-radius: 5px; }
        .file-link { text-decoration: none; color: var(--vscode-textLink-foreground); }
        .file-link:hover { text-decoration: underline; }
        pre { background: var(--vscode-editor-background); padding: 10px; border-radius: 3px; overflow-x: auto; }
      </style>
    </head>
    <body>
      <h1>Search Results (${results.results.length} found)</h1>
      ${items}
      <script>
        const vscode = acquireVsCodeApi();
        document.querySelectorAll('.file-link').forEach(link => {
          link.addEventListener('click', (e) => {
            e.preventDefault();
            const file = e.target.getAttribute('data-file');
            const line = e.target.getAttribute('data-line');
            vscode.postMessage({ command: 'openFile', file, line });
          });
        });
      </script>
    </body>
    </html>
  `;
}

async function explainFunction(client: CodeSightClient, functionText: string, filePath: string) {
  try {
    const result = await client.makeRequest('/api/tools/explain_function', {
      method: 'POST',
      body: JSON.stringify({
        function_identifier: functionText.split('(')[0].trim(),
        codebase_id: 'default',
        detail_level: 'comprehensive'
      })
    });

    const explanation = result.result.explanation;
    vscode.window.showInformationMessage(
      `Function: ${explanation.summary}\n\nComplexity: ${explanation.complexity}\nSide effects: ${explanation.side_effects.join(', ')}`,
      { modal: true }
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to explain function: ${error.message}`);
  }
}

async function analyzeFileSecurity(client: CodeSightClient, filePath: string) {
  try {
    const result = await client.analyzeSecurity(filePath, 'default');
    const vulnerabilities = result.result.vulnerabilities;

    if (vulnerabilities.length === 0) {
      vscode.window.showInformationMessage('No security vulnerabilities found!');
    } else {
      const vulnerabilityList = vulnerabilities.map((v: any) =>
        `- ${v.type}: ${v.description} (${v.severity})`
      ).join('\n');

      vscode.window.showWarningMessage(
        `Found ${vulnerabilities.length} security vulnerabilities:\n\n${vulnerabilityList}`,
        { modal: true }
      );
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Security analysis failed: ${error.message}`);
  }
}

function updateSearchResults(results: any) {
  // Update sidebar or status bar with search suggestions
  const suggestions = results.results.slice(0, 5).map((r: any) => r.name);
  // Update UI with suggestions
}
```

### JetBrains Plugin (Kotlin)

```kotlin
// JetBrains IDE plugin - codesight-jetbrains
package com.codesight.plugin

import com.intellij.openapi.project.Project
import com.intellij.openapi.components.service
import com.intellij.openapi.ui.popup.JBPopupFactory
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefBrowserBuilder
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.util.ui.JBUI
import java.awt.BorderLayout
import java.awt.FlowLayout
import javax.swing.*

class CodeSightToolWindowFactory : ToolWindowFactory {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val codeSightService = project.service<CodeSightService>()
        val browser = JBCefBrowserBuilder()
            .setUrl("about:blank")
            .build()

        val content = ContentFactory.getInstance().createContent(browser.component, "Search", false)
        toolWindow.contentManager.addContent(content)

        // Load search interface
        browser.loadHTML(getSearchInterfaceHTML())
    }

    private fun getSearchInterfaceHTML(): String {
        return """
            <!DOCTYPE html>
            <html>
            <head>
                <title>CodeSight Search</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; }
                    .search-box { width: 100%; padding: 10px; margin-bottom: 10px; }
                    .search-btn { padding: 10px 20px; background: #007ACC; color: white; border: none; cursor: pointer; }
                    .result-item { margin: 10px 0; padding: 10px; border: 1px solid #ddd; }
                </style>
            </head>
            <body>
                <h2>CodeSight Code Search</h2>
                <input type="text" id="searchInput" class="search-box" placeholder="Search for code...">
                <button onclick="performSearch()" class="search-btn">Search</button>
                <div id="results"></div>

                <script>
                    function performSearch() {
                        const query = document.getElementById('searchInput').value;
                        if (!query) return;

                        // Send message to IDE plugin
                        window.postMessage({ type: 'search', query: query }, '*');
                    }

                    window.addEventListener('message', (event) => {
                        if (event.data.type === 'searchResults') {
                            displayResults(event.data.results);
                        }
                    });

                    function displayResults(results) {
                        const resultsDiv = document.getElementById('results');
                        resultsDiv.innerHTML = results.map(result =>
                            '<div class="result-item">' +
                            '<h3>' + result.name + ' (' + result.type + ')</h3>' +
                            '<p>File: ' + result.file_path + ':' + result.line_number + '</p>' +
                            '<p>Score: ' + result.score.toFixed(2) + '</p>' +
                            '<pre>' + result.snippet + '</pre>' +
                            '</div>'
                        ).join('');
                    }
                </script>
            </body>
            </html>
        """.trimIndent()
    }
}

class CodeSightSearchAction : AnAction("CodeSight Search") {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val editor = e.getData(CommonDataKeys.EDITOR) ?: return

        val selectedText = editor.selectionModel.selectedText
        if (selectedText.isNotEmpty()) {
            performQuickSearch(project, selectedText)
        } else {
            showSearchDialog(project)
        }
    }
}

private fun performQuickSearch(project: Project, query: String) {
    val codeSightService = project.service<CodeSightService>()

    ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Searching Code", false) {
        override fun run(indicator: ProgressIndicator) {
            indicator.text = "Searching for: $query"
            indicator.isIndeterminate = false

            try {
                val results = codeSightService.searchCode(query)
                // Show results in popup or tool window
                showSearchResults(project, results)
            } catch (e: Exception) {
                // Show error message
                JOptionPane.showMessageDialog(
                    null,
                    "Search failed: ${e.message}",
                    "CodeSight Error",
                    JOptionPane.ERROR_MESSAGE
                )
            }
        }
    })
}

class CodeSightService(private val project: Project) {
    private val client = CodeSightClient(
        baseURL = "http://localhost:4000",
        authToken = getAuthToken()
    )

    fun searchCode(query: String, codebaseId: String = "default"): SearchResult {
        return client.searchCode(SearchQuery(query, codebaseId, limit = 20))
    }

    fun analyzeSecurity(filePath: String, codebaseId: String = "default"): SecurityAnalysis {
        return client.analyzeSecurity(SecurityAnalysisRequest(filePath, codebaseId))
    }

    fun explainFunction(functionName: String, codebaseId: String = "default"): FunctionExplanation {
        return client.explainFunction(functionName, codebaseId)
    }

    private fun getAuthToken(): String {
        // Get auth token from IDE settings or environment
        return System.getenv("CODESIGHT_AUTH_TOKEN") ?: ""
    }
}

// Data classes
data class SearchQuery(
    val query: String,
    val codebaseId: String,
    val limit: Int = 10,
    val filters: Map<String, Any> = emptyMap()
)

data class SearchResult(
    val success: Boolean,
    val results: List<SearchResultItem>,
    val pagination: PaginationInfo,
    val executionTimeMs: Long
)

data class SearchResultItem(
    val id: String,
    val name: String,
    val type: String,
    val filePath: String,
    val lineNumber: Int,
    val score: Double,
    val snippet: String
)

data class SecurityAnalysisRequest(
    val filePath: String,
    val codebaseId: String,
    val analysisLevel: String = "standard"
)

data class SecurityAnalysis(
    val success: Boolean,
    val result: SecurityResult
)

data class SecurityResult(
    val vulnerabilities: List<Vulnerability>,
    val recommendations: List<String>
)

data class Vulnerability(
    val type: String,
    val severity: String,
    val description: String,
    val lineNumber: Int?
)
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/codesight-analysis.yml
name: CodeSight Analysis

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  security-analysis:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install CodeSight CLI
      run: npm install -g @codesight/cli

    - name: Create Codebase
      run: |
        codesight create-codebase \
          --name "${{ github.repository }}" \
          --path "$(pwd)" \
          --language "typescript" \
          --output codebase_id.txt

    - name: Index Codebase
      run: |
        CODEBASE_ID=$(cat codebase_id.txt)
        codesight index \
          --codebase-id "$CODEBASE_ID" \
          --wait

    - name: Security Analysis
      run: |
        CODEBASE_ID=$(cat codebase_id.txt)

        # Find authentication and security-related files
        AUTH_FILES=$(codesight search \
          --codebase-id "$CODEBASE_ID" \
          --query "authentication security login password" \
          --format json | jq -r '.results[].file_path')

        echo "Found security files: $AUTH_FILES"

        # Analyze each file for security issues
        VULNERABILITIES_FOUND=false
        for file in $AUTH_FILES; do
          echo "Analyzing: $file"
          ANALYSIS=$(codesight analyze-security \
            --codebase-id "$CODEBASE_ID" \
            --file-path "$file" \
            --format json)

          VULN_COUNT=$(echo "$ANALYSIS" | jq '.result.vulnerabilities | length')
          if [ "$VULN_COUNT" -gt 0 ]; then
            VULNERABILITIES_FOUND=true
            echo "⚠️ Found $VULN_COUNT vulnerabilities in $file"
            echo "$ANALYSIS" | jq '.result.vulnerabilities[] | {severity, type, description}'

            # Add comment to PR
            if [ "${{ github.event_name }}" = "pull_request" ]; then
              echo "$ANALYSIS" | jq -r '.result.vulnerabilities[] | "- **\(.severity)**: \(.type) - \(.description)"' > vulnerabilities.txt

              gh pr comment "${{ github.event.number }}" --body-file - << EOF
              ## 🔒 Security Analysis Results

              Found security vulnerabilities in \`$file\`:

              $(cat vulnerabilities.txt)

              Please review and address these issues before merging.
              EOF
            fi
          fi
        done

        if [ "$VULNERABILITIES_FOUND" = true ]; then
          echo "::warning::Security vulnerabilities detected. Please review the analysis above."
          exit 1
        fi

    - name: Code Quality Analysis
      run: |
        CODEBASE_ID=$(cat codebase_id.txt)

        # Find complex functions
        COMPLEX_FILES=$(codesight search \
          --codebase-id "$CODEBASE_ID" \
          --query "complex function with many parameters" \
          --filters '{"min_line_count": 50}' \
          --format json | jq -r '.results[].file_path')

        # Analyze complexity
        for file in $COMPLEX_FILES; do
          echo "Analyzing complexity: $file"
          COMPLEXITY=$(codesight check-complexity \
            --codebase-id "$CODEBASE_ID" \
            --file-path "$file" \
            --format json)

          SCORE=$(echo "$COMPLEXITY" | jq '.result.complexity_score')
          if [ "$SCORE" -gt 15 ]; then
            echo "⚠️ High complexity ($SCORE) in $file"

            # Get refactoring suggestions
            REFACTOR=$(codesight suggest-refactoring \
              --codebase-id "$CODEBASE_ID" \
              --file-path "$file" \
              --format json)

            echo "Refactoring suggestions:"
            echo "$REFACTOR" | jq -r '.result.suggestions[] | "- \(.type): \(.description)"'
          fi
        done

    - name: Duplicate Code Detection
      run: |
        CODEBASE_ID=$(cat codebase_id.txt)

        DUPLICATES=$(codesight find-duplicates \
          --codebase-id "$CODEBASE_ID" \
          --similarity-threshold 0.8 \
          --format json)

        DUPLICATE_COUNT=$(echo "$DUPLICATES" | jq '.result.duplicates | length')
        if [ "$DUPLICATE_COUNT" -gt 0 ]; then
          echo "⚠️ Found $DUPLICATE_COUNT duplicate code blocks"
          echo "$DUPLICATES" | jq '.result.duplicates[] | {similarity, files}'

          # Generate report
          echo "$DUPLICATES" | jq -r '.result.duplicates[] |
            "- \(.similarity * 100)% similarity between:\n" +
            (.files | map("  - \(.file_path):\(.line_number)") | join("\n"))' > duplicates.txt

          if [ "${{ github.event_name }}" = "pull_request" ]; then
            gh pr comment "${{ github.event.number }}" --body-file - << EOF
            ## 🔄 Duplicate Code Detection

            Found duplicate code blocks that should be refactored:

            $(cat duplicates.txt)

            Consider extracting common functionality into shared utilities.
            EOF
          fi
        fi

    - name: Generate Report
      run: |
        CODEBASE_ID=$(cat codebase_id.txt)

        # Generate comprehensive report
        codesight generate-report \
          --codebase-id "$CODEBASE_ID" \
          --output codesight-report.md \
          --format markdown

        # Upload report as artifact
        echo "::set-output name=report-path::codesight-report.md"

        # Add PR comment with summary
        if [ "${{ github.event_name }}" = "pull_request" ]; then
          SUMMARY=$(codesight get-stats --codebase-id "$CODEBASE_ID" --format json)

          gh pr comment "${{ github.event.number }}" --body << EOF
          ## 📊 CodeSight Analysis Summary

          - **Files analyzed**: $(echo "$SUMMARY" | jq '.total_files')
          - **Functions found**: $(echo "$SUMMARY" | jq '.total_functions')
          - **Classes found**: $(echo "$SUMMARY" | jq '.total_classes')
          - **Security vulnerabilities**: $(echo "$SUMMARY" | jq '.vulnerabilities_found')
          - **Average complexity**: $(echo "$SUMMARY" | jq '.average_complexity')

          [View detailed report](codesight-report.md)
          EOF
        fi

    - name: Upload Report
      uses: actions/upload-artifact@v3
      with:
        name: codesight-report
        path: codesight-report.md

  api-documentation:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install CodeSight CLI
      run: npm install -g @codesight/cli

    - name: Generate API Documentation
      run: |
        # Find API endpoints
        ENDPOINTS=$(codesight get-api-endpoints \
          --codebase-id "default" \
          --include-documentation true \
          --format json)

        # Generate OpenAPI spec
        echo "$ENDPOINTS" | codesight generate-openapi-spec \
          --output api-spec.yaml \
          --title "${{ github.repository }} API"

        # Generate documentation
        codesight generate-api-docs \
          --spec-file api-spec.yaml \
          --output docs/api/

        # Commit documentation changes
        git config --local user.email "action@github.com"
        git config --local user.name "GitHub Action"
        git add docs/api/
        git diff --staged --quiet || git commit -m "docs: update API documentation [skip ci]"
        git push
```

### GitLab CI/CD

```yaml
# .gitlab-ci.yml
stages:
  - analyze
  - test
  - deploy

variables:
  CODESIGHT_SERVER: "http://codesight-server:4000"
  CODESIGHT_TOKEN: "${CODESIGHT_AUTH_TOKEN}"

codesight-analysis:
  stage: analyze
  image: node:18-alpine
  services:
    - name: codesight/codesight-server:latest
      alias: codesight-server
  before_script:
    - npm install -g @codesight/cli
    - apk add --no-cache jq curl
  script:
    - echo "🔍 Starting CodeSight analysis..."

    # Create and index codebase
    - CODEBASE_ID=$(codesight create-codebase --name "$CI_PROJECT_NAME" --path "$(pwd)" --language auto | jq -r '.id')
    - echo "Created codebase: $CODEBASE_ID"

    - codesight index --codebase-id "$CODEBASE_ID" --wait

    # Security analysis
    - echo "🔒 Running security analysis..."
    - SECURITY_REPORT=$(codesight comprehensive-security-analysis --codebase-id "$CODEBASE_ID" --format json)

    # Check for critical vulnerabilities
    - CRITICAL_VULNS=$(echo "$SECURITY_REPORT" | jq '.vulnerabilities | map(select(.severity == "critical")) | length')
    - if [ "$CRITICAL_VULNS" -gt 0 ]; then
        echo "❌ Found $CRITICAL_VULNS critical vulnerabilities"
        echo "$SECURITY_REPORT" | jq '.vulnerabilities[] | select(.severity == "critical")'
        exit 1
      fi

    # Code quality analysis
    - echo "📊 Running code quality analysis..."
    - QUALITY_REPORT=$(codesight quality-analysis --codebase-id "$CODEBASE_ID" --format json)

    # Check complexity thresholds
    - HIGH_COMPLEXITY=$(echo "$QUALITY_REPORT" | jq '.complexity_analysis | map(select(.score > 15)) | length')
    - if [ "$HIGH_COMPLEXITY" -gt 0 ]; then
        echo "⚠️ Found $HIGH_COMPLEXITY high complexity functions"
        # Create merge request comment
        curl --request POST \
          --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
          --header "Content-Type: application/json" \
          "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$CI_MERGE_REQUEST_IID/notes" \
          --data "{\"body\": \"⚠️ Code quality alert: Found $HIGH_COMPLEXITY functions with high complexity. Consider refactoring.\"}"
      fi

    # Duplicate code detection
    - echo "🔄 Checking for duplicate code..."
    - DUPLICATE_REPORT=$(codesight find-duplicates --codebase-id "$CODEBASE_ID" --similarity-threshold 0.85 --format json)
    - DUPLICATE_COUNT=$(echo "$DUPLICATE_REPORT" | jq '.duplicates | length')

    - if [ "$DUPLICATE_COUNT" -gt 0 ]; then
        echo "ℹ️ Found $DUPLICATE_COUNT duplicate code blocks"
        # Add to merge request
        curl --request POST \
          --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
          --header "Content-Type: application/json" \
          "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$CI_MERGE_REQUEST_IID/notes" \
          --data "{\"body\": \"🔄 Found $DUPLICATE_COUNT duplicate code blocks. Consider refactoring to improve maintainability.\"}"
      fi

    # Generate comprehensive report
    - codesight generate-report --codebase-id "$CODEBASE_ID" --output codesight-report.html --format html

    # Upload artifacts
    - echo "📤 Uploading analysis artifacts..."
  artifacts:
    reports:
      junit: codesight-junit-report.xml
    paths:
      - codesight-report.html
      - security-report.json
      - quality-report.json
    expire_in: 1 week
  only:
    - merge_requests
    - main

security-scan:
  stage: test
  image: node:18-alpine
  script:
    - npm install -g @codesight/cli
    - echo "🔒 Deep security scan..."

    # Focus on security-critical files
    - SECURITY_FILES=$(find . -name "*.ts" -o -name "*.js" -o -name "*.py" | grep -E "(auth|security|password|token)" | head -10)

    - for file in $SECURITY_FILES; do
        echo "Scanning $file..."
        ANALYSIS=$(codesight analyze-security --file-path "$file" --codebase-id "$CI_PROJECT_NAME" --level comprehensive)
        VULN_COUNT=$(echo "$ANALYSIS" | jq '.vulnerabilities | length')

        if [ "$VULN_COUNT" -gt 0 ]; then
          echo "❌ Security issues found in $file"
          echo "$ANALYSIS" | jq '.vulnerabilities[]'
        fi
      done
  allow_failure: true
  only:
    - merge_requests
```

## Web Applications

### React Integration

```tsx
// React components for CodeSight integration
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CodeSightClient } from '@codesight/sdk';

interface CodeSightProviderProps {
  children: React.ReactNode;
  config: {
    baseURL: string;
    authToken: string;
    defaultCodebaseId: string;
  };
}

const CodeSightContext = React.createContext<{
  client: CodeSightClient;
  search: (query: string) => Promise<SearchResult>;
  analyzeSecurity: (filePath: string) => Promise<SecurityAnalysis>;
  explainFunction: (functionName: string) => Promise<FunctionExplanation>;
  isSearching: boolean;
  error: string | null;
} | null>(null);

export function CodeSightProvider({ children, config }: CodeSightProviderProps) {
  const [client] = useState(() => new CodeSightClient(config));
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string): Promise<SearchResult> => {
    setIsSearching(true);
    setError(null);

    try {
      const result = await client.searchCode({
        query,
        codebase_id: config.defaultCodebaseId,
        limit: 20
      });
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsSearching(false);
    }
  }, [client, config.defaultCodebaseId]);

  const analyzeSecurity = useCallback(async (filePath: string): Promise<SecurityAnalysis> => {
    try {
      return await client.analyzeSecurity(filePath, config.defaultCodebaseId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Security analysis failed';
      setError(errorMessage);
      throw err;
    }
  }, [client, config.defaultCodebaseId]);

  const explainFunction = useCallback(async (functionName: string): Promise<FunctionExplanation> => {
    try {
      const result = await client.makeRequest('/api/tools/explain_function', {
        method: 'POST',
        body: JSON.stringify({
          function_identifier: functionName,
          codebase_id: config.defaultCodebaseId,
          detail_level: 'comprehensive'
        })
      });
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Function explanation failed';
      setError(errorMessage);
      throw err;
    }
  }, [client, config.defaultCodebaseId]);

  const value = useMemo(() => ({
    client,
    search,
    analyzeSecurity,
    explainFunction,
    isSearching,
    error
  }), [client, search, analyzeSecurity, explainFunction, isSearching, error]);

  return (
    <CodeSightContext.Provider value={value}>
      {children}
    </CodeSightContext.Provider>
  );
}

export function useCodeSight() {
  const context = React.useContext(CodeSightContext);
  if (!context) {
    throw new Error('useCodeSight must be used within a CodeSightProvider');
  }
  return context;
}

// Search Component
export function CodeSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const { search, isSearching, error } = useCodeSight();

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    try {
      const searchResults = await search(query);
      setResults(searchResults);
    } catch (err) {
      console.error('Search failed:', err);
    }
  }, [query, search]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  return (
    <div className="code-search">
      <div className="search-input">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search code... (e.g., authentication function with JWT)"
          disabled={isSearching}
        />
        <button onClick={handleSearch} disabled={isSearching || !query.trim()}>
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {results && (
        <div className="search-results">
          <h3>Results ({results.results.length} found)</h3>
          <div className="results-list">
            {results.results.map((result) => (
              <SearchResultItem key={result.id} result={result} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface SearchResultItemProps {
  result: SearchResultItem;
}

function SearchResultItem({ result }: SearchResultItemProps) {
  const { explainFunction } = useCodeSight();
  const [explanation, setExplanation] = useState<FunctionExplanation | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);

  const handleExplain = useCallback(async () => {
    if (result.type !== 'function' && result.type !== 'method') return;

    setIsExplaining(true);
    try {
      const funcExplanation = await explainFunction(result.name);
      setExplanation(funcExplanation);
    } catch (err) {
      console.error('Failed to explain function:', err);
    } finally {
      setIsExplaining(false);
    }
  }, [result.name, result.type, explainFunction]);

  return (
    <div className="search-result-item">
      <div className="result-header">
        <h4>
          <span className="result-name">{result.name}</span>
          <span className="result-type">({result.type})</span>
        </h4>
        <div className="result-meta">
          <span className="file-path">{result.file_path}:{result.line_number}</span>
          <span className="score">Score: {result.score.toFixed(2)}</span>
        </div>
      </div>

      <pre className="code-snippet">
        <code>{result.snippet}</code>
      </pre>

      {(result.type === 'function' || result.type === 'method') && (
        <div className="result-actions">
          <button
            onClick={handleExplain}
            disabled={isExplaining}
            className="explain-button"
          >
            {isExplaining ? 'Explaining...' : 'Explain Function'}
          </button>
        </div>
      )}

      {explanation && (
        <div className="function-explanation">
          <h5>Function Explanation</h5>
          <p><strong>Summary:</strong> {explanation.result.explanation.summary}</p>
          <p><strong>Complexity:</strong> {explanation.result.explanation.complexity}</p>
          <p><strong>Side Effects:</strong> {explanation.result.explanation.side_effects.join(', ')}</p>

          {explanation.result.explanation.parameters.length > 0 && (
            <div>
              <strong>Parameters:</strong>
              <ul>
                {explanation.result.explanation.parameters.map((param, idx) => (
                  <li key={idx}>
                    <code>{param.name}</code> ({param.type}): {param.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Security Analysis Component
export function SecurityAnalysis() {
  const [filePath, setFilePath] = useState('');
  const [analysis, setAnalysis] = useState<SecurityAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { analyzeSecurity, error } = useCodeSight();

  const handleAnalyze = useCallback(async () => {
    if (!filePath.trim()) return;

    setIsAnalyzing(true);
    try {
      const securityAnalysis = await analyzeSecurity(filePath);
      setAnalysis(securityAnalysis);
    } catch (err) {
      console.error('Security analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [filePath, analyzeSecurity]);

  return (
    <div className="security-analysis">
      <h2>Security Analysis</h2>

      <div className="analysis-input">
        <input
          type="text"
          value={filePath}
          onChange={(e) => setFilePath(e.target.value)}
          placeholder="Enter file path (e.g., src/auth/auth.service.ts)"
          disabled={isAnalyzing}
        />
        <button onClick={handleAnalyze} disabled={isAnalyzing || !filePath.trim()}>
          {isAnalyzing ? 'Analyzing...' : 'Analyze Security'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {analysis && (
        <div className="analysis-results">
          <SecurityAnalysisResults analysis={analysis} />
        </div>
      )}
    </div>
  );
}

interface SecurityAnalysisResultsProps {
  analysis: SecurityAnalysis;
}

function SecurityAnalysisResults({ analysis }: SecurityAnalysisResultsProps) {
  const vulnerabilities = analysis.result.vulnerabilities;
  const recommendations = analysis.result.recommendations;

  return (
    <div className="security-results">
      <h3>Security Analysis Results</h3>

      {vulnerabilities.length === 0 ? (
        <div className="no-vulnerabilities">
          ✅ No security vulnerabilities found!
        </div>
      ) : (
        <div className="vulnerabilities">
          <h4>⚠️ Vulnerabilities Found ({vulnerabilities.length})</h4>
          {vulnerabilities.map((vuln, idx) => (
            <div key={idx} className={`vulnerability ${vuln.severity}`}>
              <h5>{vuln.type} ({vuln.severity})</h5>
              <p>{vuln.description}</p>
              {vuln.line_number && (
                <p className="location">Line {vuln.line_number}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="recommendations">
          <h4>💡 Security Recommendations</h4>
          <ul>
            {recommendations.map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Usage in your app
export function App() {
  const [config] = useState({
    baseURL: 'http://localhost:4000',
    authToken: 'your-jwt-token',
    defaultCodebaseId: 'your-codebase-id'
  });

  return (
    <CodeSightProvider config={config}>
      <div className="app">
        <header>
          <h1>CodeSight Integration</h1>
        </header>

        <main>
          <CodeSearch />
          <SecurityAnalysis />
        </main>
      </div>
    </CodeSightProvider>
  );
}
```

## Next Steps

- [Explore Monitoring and Observability](../monitoring/)
- [Check Performance Optimization Techniques](./performance-guide.md)
- [Review Error Handling Best Practices](./error-handling.md)
- [Try the Postman Collection](../testing/postman/)

---

This integration guide should help you successfully integrate CodeSight MCP Server into various applications and workflows. Each example includes production-ready code with proper error handling and best practices.