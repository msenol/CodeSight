# CodeSight MCP Server - Grafana Dashboards

This directory contains pre-configured Grafana dashboards for monitoring the CodeSight MCP Server.

## Available Dashboards

### 1. CodeSight Overview Dashboard (`codesight-overview.json`)

**Purpose**: Provides a comprehensive overview of server performance, search operations, and system health.

**Key Metrics**:
- HTTP request rate and response times
- Active codebases and total entities indexed
- Memory usage and system performance
- Search operation rates and performance
- Error rates across all operations
- Entity distribution by type

**Use Cases**:
- Monitor overall system health
- Track performance trends over time
- Identify bottlenecks and issues
- Capacity planning and resource optimization

---

### 2. Database Monitoring Dashboard (`codesight-database.json`)

**Purpose**: Focuses on database performance, query patterns, and connection health.

**Key Metrics**:
- Active database connections
- Query rate by operation type
- Query performance percentiles (P50, P95, P99)
- Database error rates
- Slow query identification
- Query distribution by table

**Use Cases**:
- Monitor database performance
- Identify slow queries and optimization opportunities
- Track connection pool health
- Database capacity planning

---

## Installation Instructions

### Prerequisites

1. **Grafana Server** (v8.0+ recommended)
2. **Prometheus Server** configured to scrape CodeSight metrics
3. **CodeSight MCP Server** with metrics enabled

### Step 1: Configure Prometheus

Add the following to your `prometheus.yml` configuration:

```yaml
scrape_configs:
  - job_name: 'codesight-mcp-server'
    static_configs:
      - targets: ['localhost:4000']
    metrics_path: '/metrics'
    scrape_interval: 30s
    scrape_timeout: 10s
```

### Step 2: Import Dashboards

1. Open Grafana in your browser
2. Navigate to **Dashboards** → **Manage**
3. Click **Import Dashboard**
4. Upload the JSON files from this directory
5. Configure the Prometheus data source when prompted

### Step 3: Verify Data Sources

Ensure that:
- Prometheus is successfully scraping metrics from CodeSight
- The data source is configured in Grafana
- Metrics are appearing in the dashboards

## Dashboard Configuration

### Data Source Variables

Each dashboard uses a variable `${DS_PROMETHEUS}` for the Prometheus data source. Make sure to:
1. Set up a Prometheus data source in Grafana
2. Name it appropriately or update the variable in the dashboard

### Time Ranges

Recommended time ranges for different use cases:

- **Real-time monitoring**: Last 15 minutes - 1 hour
- **Daily performance review**: Last 24 hours
- **Weekly trends**: Last 7 days
- **Monthly analysis**: Last 30 days

### Alerting

Set up alerts for critical metrics:

#### High Error Rate Alert
```yaml
- alert: CodeSightHighErrorRate
  expr: sum(rate(codesight_errors_total[5m])) / sum(rate(codesight_http_requests_total[5m])) > 0.05
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: "CodeSight error rate is above 5%"
    description: "Error rate: {{ $value | humanizePercentage }}"
```

#### High Response Time Alert
```yaml
- alert: CodeSightHighResponseTime
  expr: histogram_quantile(0.95, sum(rate(codesight_http_request_duration_ms_bucket[5m])) by (le, method, route)) > 2000
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "CodeSight 95th percentile response time is above 2 seconds"
    description: "P95 response time: {{ $value }}ms"
```

#### Memory Usage Alert
```yaml
- alert: CodeSightHighMemoryUsage
  expr: codesight_system_memory_usage_bytes{type="heap"} > 2147483648  # 2GB
  for: 10m
  labels:
    severity: critical
  annotations:
    summary: "CodeSight memory usage is above 2GB"
    description: "Heap memory usage: {{ $value | humanizeBytes }}"
```

## Customization Guide

### Adding New Panels

1. Click **Add Panel** in any dashboard
2. Select a visualization type
3. Configure the Prometheus query
4. Set appropriate thresholds and units
5. Add descriptive titles and descriptions

### Useful Prometheus Queries

#### Top 10 Slowest Search Operations
```promql
topk(10, histogram_quantile(0.95, sum(rate(codesight_search_duration_ms_bucket[5m])) by (le, codebase_id, query_type)))
```

#### Error Rate by Component
```promql
sum(rate(codesight_errors_total[5m])) by (error_type, component) / sum(rate(codesight_http_requests_total[5m]))
```

#### Most Active Codebases
```promql
topk(10, sum(rate(codesight_search_operations_total[1h])) by (codebase_id))
```

#### Cache Hit Rates
```promql
sum(codesight_cache_hits_total) / (sum(codesight_cache_hits_total) + sum(codesight_cache_misses_total)) by (cache_type)
```

### Panel Templates

#### Single Stat Panel
```json
{
  "type": "stat",
  "targets": [
    {
      "expr": "sum(codesight_http_requests_total)",
      "legendFormat": "Total Requests"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "unit": "short",
      "thresholds": {
        "steps": [
          {"color": "green", "value": null},
          {"color": "red", "value": 1000}
        ]
      }
    }
  }
}
```

#### Time Series Panel
```json
{
  "type": "timeseries",
  "targets": [
    {
      "expr": "rate(codesight_http_requests_total[5m])",
      "legendFormat": "{{method}} {{route}}"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "unit": "reqps"
    }
  }
}
```

## Performance Optimization

### Grafana Configuration

Optimize Grafana for better performance:

1. **Reduce refresh interval** for dashboards with many queries
2. **Use query caching** in Prometheus
3. **Limit time range** for high-cardinality queries
4. **Use aggregation** instead of raw metrics when possible

### Dashboard Best Practices

1. **Keep dashboards focused** - don't try to show everything in one view
2. **Use consistent color schemes** - red for errors, green for healthy
3. **Add descriptions** to explain what each metric means
4. **Set appropriate thresholds** based on your SLAs
5. **Use annotations** to mark deployments or incidents

## Troubleshooting

### Common Issues

#### No Data Showing
1. Check Prometheus is scraping CodeSight: `curl http://localhost:9090/api/v1/query?query=up`
2. Verify CodeSight metrics endpoint: `curl http://localhost:4000/metrics`
3. Check Grafana data source configuration

#### Metrics Missing
1. Ensure the CodeSight server has metrics enabled
2. Check that the appropriate services are instrumented
3. Verify metric names match between Prometheus and Grafana

#### Performance Issues
1. Reduce dashboard refresh rate
2. Optimize PromQL queries
3. Use recording rules for complex queries
4. Consider increasing Grafana memory limits

### Debugging Queries

Use the Prometheus UI to test queries:

1. Navigate to `http://localhost:9090/graph`
2. Enter your PromQL query
3. Check the **Graph** and **Table** tabs
4. Verify the query returns expected data

## Integration with Monitoring Tools

### Alertmanager Integration

Configure Alertmanager to route alerts:

```yaml
route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: 'http://your-alertmanager-webhook'
```

### Slack Integration

Add Slack notifications to Alertmanager:

```yaml
receivers:
  - name: 'slack-notifications'
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#alerts'
        title: 'CodeSight Alert: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
```

### PagerDuty Integration

Add PagerDuty notifications for critical alerts:

```yaml
receivers:
  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_SERVICE_KEY'
        severity: 'critical'
        class: 'CodeSight MCP Server'
        component: 'API'
        group: 'operations'
```

## Maintenance

### Regular Tasks

1. **Review dashboards monthly** for relevance and accuracy
2. **Update alert thresholds** based on performance changes
3. **Archive old dashboards** that are no longer needed
4. **Backup dashboard configurations** regularly
5. **Monitor Grafana performance** and optimize as needed

### Dashboard Updates

When updating CodeSight:

1. **Test metric compatibility** with new versions
2. **Update dashboard queries** if metric names change
3. **Add new panels** for new features
4. **Update documentation** with new metrics
5. **Communicate changes** to the team

---

For support and questions:
- 📖 Check the [CodeSight Documentation](../../README.md)
- 🐛 Report issues: [GitHub Issues](https://github.com/codesight-mcp/issues)
- 💬 Join discussions: [GitHub Discussions](https://github.com/codesight-mcp/discussions)