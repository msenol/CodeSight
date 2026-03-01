# CodeSight Production Deployment Guide

## Prerequisites

- Kubernetes cluster (1.25+)
- kubectl configured
- Docker installed
- Helm 3+ (optional)

## Quick Start

### 1. Create Namespace and Secrets

```bash
# Create namespace
kubectl apply -f kubernetes/namespace.yaml

# Create secrets (edit values first!)
kubectl apply -f kubernetes/secrets.yaml

# Apply configuration
kubectl apply -f kubernetes/configmap.yaml
```

### 2. Deploy Application

```bash
# Deploy MCP server
kubectl apply -f kubernetes/deployment.yaml

# Check deployment
kubectl get pods -n codesight -w
```

### 3. Expose Service

```bash
# Internal cluster access
kubectl apply -f kubernetes/service.yaml

# External access (optional)
kubectl apply -f kubernetes/ingress.yaml
```

### 4. Configure Auto-scaling

```bash
kubectl apply -f kubernetes/hpa.yaml
```

### 5. Deploy Monitoring

```bash
kubectl apply -f kubernetes/monitoring/prometheus.yaml
kubectl apply -f kubernetes/monitoring/grafana.yaml
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4000 | HTTP API port |
| `MCP_PORT` | 8080 | MCP protocol port |
| `NODE_ENV` | production | Environment |
| `LOG_LEVEL` | info | Logging level |
| `ENABLE_RUST_FFI` | true | Enable Rust FFI |
| `PREFERRED_AI_PROVIDER` | openrouter | Default AI provider |
| `AI_TIMEOUT_MS` | 30000 | AI request timeout |

### Resource Requirements

**Minimum:**
- CPU: 250m
- Memory: 512Mi

**Recommended:**
- CPU: 1000m
- Memory: 2Gi

### Scaling

- **Min Replicas:** 2
- **Max Replicas:** 10
- **Target CPU:** 70%
- **Target Memory:** 80%

## Health Checks

```bash
# Liveness probe
kubectl exec -n codesight <pod-name> -- node dist/health-check.js

# Readiness probe
curl http://<pod-ip>:4000/health

# Metrics endpoint
curl http://<pod-ip>:4000/metrics
```

## Monitoring

### Prometheus

- **Endpoint:** `http://prometheus:9090`
- **Metrics Path:** `/metrics`
- **Scrape Interval:** 15s

### Grafana

- **Endpoint:** `http://grafana:3000`
- **Default Login:** admin/admin
- **Dashboards:** Auto-imported

## Troubleshooting

### Check Pod Status

```bash
kubectl get pods -n codesight
kubectl describe pod <pod-name> -n codesight
```

### View Logs

```bash
kubectl logs -n codesight <pod-name>
kubectl logs -n codesight <pod-name> -f
```

### Debug Pod

```bash
kubectl exec -it -n codesight <pod-name> -- /bin/sh
```

### Restart Deployment

```bash
kubectl rollout restart deployment/codesight-mcp -n codesight
```

## Security

- Runs as non-root user (65534)
- Read-only root filesystem
- No privileged capabilities
- Network policies applied
- Secrets encrypted at rest

## Backup

```bash
# Backup data volume
kubectl exec -n codesight <pod-name> -- tar czf /tmp/backup.tar.gz /app/data

# Download backup
kubectl cp codesight/<pod-name>:/tmp/backup.tar.gz ./backup.tar.gz
```

## Upgrade

```bash
# Update image
kubectl set image deployment/codesight-mcp \
  codesight-mcp=ghcr.io/msenol/codesight-mcp:latest -n codesight

# Watch rollout
kubectl rollout status deployment/codesight-mcp -n codesight

# Rollback if needed
kubectl rollout undo deployment/codesight-mcp -n codesight
```

## Uninstall

```bash
kubectl delete namespace codesight
```
