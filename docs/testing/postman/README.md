# CodeSight MCP Server API - Postman Collection

This directory contains a comprehensive Postman collection for testing the CodeSight MCP Server API endpoints.

## Files

- **`codesight-mcp-api.postman_collection.json`** - Main Postman collection with all API endpoints
- **`environment.json`** - Environment variables configuration
- **`README.md`** - This documentation file

## Setup Instructions

### 1. Import Collection and Environment

1. Open Postman desktop application
2. Click **Import** in the top left
3. Select **File** and choose `codesight-mcp-api.postman_collection.json`
4. Click **Import** again and choose `environment.json`
5. In the top right dropdown, select the "CodeSight MCP Development Environment"

### 2. Configure Environment Variables

1. In the top right, click the gear icon next to the environment dropdown
2. Edit the following variables:
   - **`baseUrl`**: Set to your CodeSight MCP Server URL (default: `http://localhost:4000`)
   - **`authToken`**: Set to your JWT Bearer token for authentication
   - **`codebaseId`**: Will be automatically populated when you run the "List All Codebases" request
   - **`newCodebaseId`**: Will be automatically populated when you run the "Create New Codebase" request

### 3. Generate Authentication Token

If you need an authentication token:

```bash
# Example: Generate token (if you have an auth endpoint)
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your-username",
    "password": "your-password"
  }'
```

Copy the token from the response and paste it into the `authToken` environment variable.

## Using the Collection

### Request Organization

The collection is organized into logical folders:

1. **Health Checks** - Server health and readiness endpoints
2. **Codebase Management** - Create, list, get, and delete codebases
3. **Search Operations** - Natural language search with filters
4. **MCP Tools** - All MCP protocol tools (search, explain, analyze, etc.)
5. **Monitoring & Metrics** - Performance metrics and usage statistics
6. **Error Handling Tests** - Test error scenarios and edge cases

### Running Requests

#### Individual Requests
1. Select any request from the collection
2. Click **Send** to execute it
3. View the response in the bottom panel

#### Automated Testing
1. Select a folder or the entire collection
2. Click **Run** in the top right
3. Choose which requests to run
4. Configure iterations and delays if needed
5. Click **Run Collection**

### Key Features

#### Automatic Variable Population
- `codebaseId` is automatically set after running "List All Codebases"
- `newCodebaseId` is automatically set after running "Create New Codebase"

#### Comprehensive Test Scripts
Each request includes automated tests that verify:
- HTTP status codes
- Response structure validation
- Performance thresholds
- Data integrity

#### Error Handling
- Validation of error responses
- Proper error code checking
- Rate limiting header verification

## Test Scenarios

### Basic Workflow
1. **Health Check** → Verify server is running
2. **List Codebases** → Get available codebases
3. **Natural Language Search** → Test search functionality
4. **MCP Tools** → Test various analysis tools
5. **Monitoring** → Check metrics and stats

### Error Testing
1. **Invalid Query** → Test validation error handling
2. **Unauthorized** → Test authentication requirements
3. **Rate Limiting** → Test rate limit behavior

## Customization

### Adding New Tests
1. Duplicate an existing request
2. Modify the request body or parameters
3. Update test scripts as needed
4. Save to the collection

### Environment Variables
You can add custom environment variables for:
- Different server endpoints (staging, production)
- Different authentication tokens
- Custom test data
- Configuration values

## Performance Testing

### Load Testing
1. Use the **Run Collection** feature
2. Set high iteration counts (100+)
3. Configure delays between requests
4. Monitor response times and error rates

### Benchmarking
The collection includes performance tests that verify:
- Response times under 1 second for most endpoints
- Search performance under 2 seconds
- Memory usage patterns

## Troubleshooting

### Common Issues

#### "authToken not set"
- Make sure you've configured the environment variable
- Check that your token is valid and not expired
- Verify the token format (should be "Bearer your-token-here")

#### "codebaseId not set"
- Run the "List All Codebases" request first
- Ensure you have at least one codebase created
- Check that the response contains valid codebase data

#### Connection refused
- Verify the server is running (`npm start` in typescript-mcp directory)
- Check the `baseUrl` environment variable
- Ensure the port (4000) is correct and not blocked

#### 401 Unauthorized
- Check your `authToken` is properly set
- Verify the token hasn't expired
- Ensure you're using the correct authentication method

### Debug Mode
Enable console logging in Postman:
1. Go to Settings → General
2. Enable "Show console"
3. Run requests to see detailed logs

## Best Practices

1. **Always run health checks first** - Verify server status before testing
2. **Use variables** - Avoid hardcoded values in requests
3. **Check test results** - Review failed tests to identify issues
4. **Monitor performance** - Keep an eye on response times
5. **Clean up test data** - Remove test codebases after testing

## API Coverage

This collection tests all major API endpoints:

- ✅ Health checks (`/health`, `/health/detailed`, `/health/ready`)
- ✅ Codebase CRUD operations (`/api/codebases`)
- ✅ Search operations (`/api/queries`)
- ✅ All MCP tools (`/api/tools/*`)
- ✅ Monitoring endpoints (`/metrics`, `/api/stats`)
- ✅ Error handling and edge cases

## Support

For issues with:
- **API functionality**: Check the server logs
- **Postman collection**: Create an issue in the project repository
- **Authentication**: Refer to the authentication documentation

---

**Last Updated**: January 2025
**API Version**: v0.1.0
**Collection Version**: 1.0.0