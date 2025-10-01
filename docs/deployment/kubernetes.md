---
sidebar_position: 2
---

# Kubernetes Deployment

**Production-Ready Kubernetes Deployment** for CodeSight v0.1.0 - Enterprise MCP Server with hybrid TypeScript/Rust architecture, comprehensive monitoring, and multi-language support. This guide covers deploying the Code Intelligence MCP Server on Kubernetes clusters with enterprise-grade features including PostgreSQL, Redis, Prometheus, Grafana, and comprehensive security configurations.

## Prerequisites

- Kubernetes cluster 1.24 or later
- kubectl configured to access your cluster
- Helm 3.8 or later (optional but recommended)
- At least 8GB RAM and 4 CPU cores available in the cluster
- Persistent storage class configured

## Quick Start

### Using Helm Chart (Recommended)

```bash
# Add our Helm repository
helm repo add code-intelligence https://charts.code-intelligence.dev
helm repo update

# Install with default values
helm install code-intel code-intelligence/mcp-server

# Install with custom values
helm install code-intel code-intelligence/mcp-server \
  --set image.tag=v1.0.0 \
  --set resources.requests.memory=2Gi \
  --set replicaCount=3
```

### Using Raw Manifests

```bash
# Apply all manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -l app=code-intelligence
```

## Kubernetes Manifests

### Namespace

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: code-intelligence
  labels:
    name: code-intelligence
    app.kubernetes.io/name: code-intelligence
    app.kubernetes.io/version: "1.0.0"
```

### ConfigMap

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: code-intel-config
  namespace: code-intelligence
data:
  config.json: |
    {
      "server": {
        "port": 3000,
        "host": "0.0.0.0",
        "timeout": 30000
      },
      "indexing": {
        "maxWorkers": 8,
        "batchSize": 100,
        "memoryLimit": "2GB"
      },
      "search": {
        "cacheSize": 1000,
        "cacheTTL": 3600
      },
      "monitoring": {
        "metrics": {
          "enabled": true,
          "port": 9090
        }
      }
    }
  logging.conf: |
    level: info
    format: json
    outputs:
      - type: stdout
      - type: file
        path: /app/logs/app.log
        maxSize: 100MB
        maxFiles: 5
```

### Secret

```yaml
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: code-intel-secrets
  namespace: code-intelligence
type: Opaque
data:
  # Base64 encoded values
  database-url: cG9zdGdyZXNxbDovL3VzZXI6cGFzc0Bwb3N0Z3JlczozNTQzMi9jb2RlX2ludGVs
  redis-url: cmVkaXM6Ly9yZWRpczozNjM3OS8w
  api-key-secret: eW91ci1zZWNyZXQta2V5LWhlcmU=
  jwt-secret: eW91ci1qd3Qtc2VjcmV0LWhlcmU=
```

### Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: code-intelligence
  namespace: code-intelligence
  labels:
    app: code-intelligence
    version: v1.0.0
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1
  selector:
    matchLabels:
      app: code-intelligence
  template:
    metadata:
      labels:
        app: code-intelligence
        version: v1.0.0
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: code-intelligence
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
      - name: code-intelligence
        image: code-intelligence/mcp-server:v1.0.0
        imagePullPolicy: IfNotPresent
        ports:
        - name: http
          containerPort: 3000
          protocol: TCP
        - name: metrics
          containerPort: 9090
          protocol: TCP
        env:
        - name: NODE_ENV
          value: "production"
        - name: LOG_LEVEL
          value: "info"
        - name: MAX_WORKERS
          value: "8"
        - name: MEMORY_LIMIT
          value: "2048"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: code-intel-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: code-intel-secrets
              key: redis-url
        - name: API_KEY_SECRET
          valueFrom:
            secretKeyRef:
              name: code-intel-secrets
              key: api-key-secret
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: code-intel-secrets
              key: jwt-secret
        volumeMounts:
        - name: config
          mountPath: /app/config
          readOnly: true
        - name: data
          mountPath: /app/data
        - name: logs
          mountPath: /app/logs
        - name: workspace
          mountPath: /workspace
          readOnly: true
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 60
          periodSeconds: 30
          timeoutSeconds: 10
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        startupProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 10
      volumes:
      - name: config
        configMap:
          name: code-intel-config
      - name: data
        persistentVolumeClaim:
          claimName: code-intel-data
      - name: logs
        emptyDir: {}
      - name: workspace
        persistentVolumeClaim:
          claimName: code-intel-workspace
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - code-intelligence
              topologyKey: kubernetes.io/hostname
      tolerations:
      - key: "node.kubernetes.io/not-ready"
        operator: "Exists"
        effect: "NoExecute"
        tolerationSeconds: 300
      - key: "node.kubernetes.io/unreachable"
        operator: "Exists"
        effect: "NoExecute"
        tolerationSeconds: 300
```

### Service

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: code-intelligence
  namespace: code-intelligence
  labels:
    app: code-intelligence
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: nlb
spec:
  type: LoadBalancer
  ports:
  - name: http
    port: 80
    targetPort: http
    protocol: TCP
  - name: https
    port: 443
    targetPort: http
    protocol: TCP
  selector:
    app: code-intelligence
---
apiVersion: v1
kind: Service
metadata:
  name: code-intelligence-metrics
  namespace: code-intelligence
  labels:
    app: code-intelligence
    component: metrics
spec:
  type: ClusterIP
  ports:
  - name: metrics
    port: 9090
    targetPort: metrics
    protocol: TCP
  selector:
    app: code-intelligence
```

### Ingress

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: code-intelligence
  namespace: code-intelligence
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "300"
spec:
  tls:
  - hosts:
    - api.code-intelligence.dev
    secretName: code-intelligence-tls
  rules:
  - host: api.code-intelligence.dev
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: code-intelligence
            port:
              number: 80
```

### Persistent Volume Claims

```yaml
# k8s/pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: code-intel-data
  namespace: code-intelligence
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: fast-ssd
  resources:
    requests:
      storage: 100Gi
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: code-intel-workspace
  namespace: code-intelligence
spec:
  accessModes:
    - ReadOnlyMany
  storageClassName: shared-nfs
  resources:
    requests:
      storage: 500Gi
```

### ServiceAccount and RBAC

```yaml
# k8s/rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: code-intelligence
  namespace: code-intelligence
  labels:
    app: code-intelligence
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: code-intelligence
  name: code-intelligence
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: code-intelligence
  namespace: code-intelligence
subjects:
- kind: ServiceAccount
  name: code-intelligence
  namespace: code-intelligence
roleRef:
  kind: Role
  name: code-intelligence
  apiGroup: rbac.authorization.k8s.io
```

### HorizontalPodAutoscaler

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: code-intelligence
  namespace: code-intelligence
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: code-intelligence
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
      - type: Pods
        value: 2
        periodSeconds: 60
      selectPolicy: Max
```

### PodDisruptionBudget

```yaml
# k8s/pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: code-intelligence
  namespace: code-intelligence
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: code-intelligence
```

## Helm Chart

### Chart.yaml

```yaml
# helm/Chart.yaml
apiVersion: v2
name: code-intelligence-mcp
description: A Helm chart for Code Intelligence MCP Server
type: application
version: 1.0.0
appVersion: "1.0.0"
keywords:
  - code-intelligence
  - mcp
  - ai
  - code-analysis
home: https://code-intelligence.dev
sources:
  - https://github.com/your-org/code-intelligence-mcp
maintainers:
  - name: Code Intelligence Team
    email: team@code-intelligence.dev
```

### Values.yaml

```yaml
# helm/values.yaml
replicaCount: 3

image:
  repository: code-intelligence/mcp-server
  pullPolicy: IfNotPresent
  tag: "v1.0.0"

imagePullSecrets: []
nameOverride: ""
fullnameOverride: ""

serviceAccount:
  create: true
  annotations: {}
  name: ""

podAnnotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "9090"
  prometheus.io/path: "/metrics"

podSecurityContext:
  runAsNonRoot: true
  runAsUser: 1001
  fsGroup: 1001

securityContext:
  allowPrivilegeEscalation: false
  capabilities:
    drop:
    - ALL
  readOnlyRootFilesystem: true
  runAsNonRoot: true
  runAsUser: 1001

service:
  type: LoadBalancer
  port: 80
  targetPort: http
  annotations: {}

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
  hosts:
    - host: api.code-intelligence.dev
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: code-intelligence-tls
      hosts:
        - api.code-intelligence.dev

resources:
  requests:
    memory: "1Gi"
    cpu: "500m"
  limits:
    memory: "2Gi"
    cpu: "1000m"

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

nodeSelector: {}

tolerations: []

affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        labelSelector:
          matchExpressions:
          - key: app.kubernetes.io/name
            operator: In
            values:
            - code-intelligence-mcp
        topologyKey: kubernetes.io/hostname

persistence:
  data:
    enabled: true
    storageClass: "fast-ssd"
    size: 100Gi
    accessMode: ReadWriteOnce
  workspace:
    enabled: true
    storageClass: "shared-nfs"
    size: 500Gi
    accessMode: ReadOnlyMany

config:
  server:
    port: 3000
    timeout: 30000
  indexing:
    maxWorkers: 8
    batchSize: 100
    memoryLimit: "2GB"
  search:
    cacheSize: 1000
    cacheTTL: 3600
  monitoring:
    metrics:
      enabled: true
      port: 9090

secrets:
  databaseUrl: "postgresql://user:pass@postgres:5432/code_intel"
  redisUrl: "redis://redis:6379/0"
  apiKeySecret: "your-secret-key"
  jwtSecret: "your-jwt-secret"

monitoring:
  serviceMonitor:
    enabled: true
    interval: 30s
    path: /metrics
    labels: {}

postgresql:
  enabled: true
  auth:
    postgresPassword: "postgres-password"
    username: "code_intel_user"
    password: "user-password"
    database: "code_intel"
  primary:
    persistence:
      enabled: true
      size: 50Gi
      storageClass: "fast-ssd"

redis:
  enabled: true
  auth:
    enabled: true
    password: "redis-password"
  master:
    persistence:
      enabled: true
      size: 10Gi
      storageClass: "fast-ssd"
```

## Database Setup

### PostgreSQL

```yaml
# k8s/postgres.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: code-intelligence
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        env:
        - name: POSTGRES_DB
          value: code_intel
        - name: POSTGRES_USER
          value: code_intel_user
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
  volumeClaimTemplates:
  - metadata:
      name: postgres-data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 50Gi
```

## Monitoring Setup

### ServiceMonitor for Prometheus

```yaml
# k8s/servicemonitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: code-intelligence
  namespace: code-intelligence
  labels:
    app: code-intelligence
spec:
  selector:
    matchLabels:
      app: code-intelligence
      component: metrics
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
    honorLabels: true
```

### Grafana Dashboard ConfigMap

```yaml
# k8s/grafana-dashboard.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: code-intelligence-dashboard
  namespace: monitoring
  labels:
    grafana_dashboard: "1"
data:
  code-intelligence.json: |
    {
      "dashboard": {
        "title": "Code Intelligence MCP Server",
        "panels": [
          {
            "title": "Request Rate",
            "type": "graph",
            "targets": [
              {
                "expr": "rate(http_requests_total{job=\"code-intelligence\"}[5m])"
              }
            ]
          },
          {
            "title": "Response Time",
            "type": "graph",
            "targets": [
              {
                "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job=\"code-intelligence\"}[5m]))"
              }
            ]
          },
          {
            "title": "Memory Usage",
            "type": "graph",
            "targets": [
              {
                "expr": "process_resident_memory_bytes{job=\"code-intelligence\"}"
              }
            ]
          }
        ]
      }
    }
```

## Deployment Scripts

### Deploy Script

```bash
#!/bin/bash
# scripts/deploy-k8s.sh
set -e

NAMESPACE=${1:-code-intelligence}
ENVIRONMENT=${2:-production}

echo "Deploying to namespace: $NAMESPACE"
echo "Environment: $ENVIRONMENT"

# Create namespace if it doesn't exist
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Apply secrets (from external secret management)
kubectl apply -f k8s/secrets/$ENVIRONMENT/ -n $NAMESPACE

# Apply configuration
kubectl apply -f k8s/configmap.yaml -n $NAMESPACE

# Apply RBAC
kubectl apply -f k8s/rbac.yaml -n $NAMESPACE

# Apply storage
kubectl apply -f k8s/pvc.yaml -n $NAMESPACE

# Deploy database
kubectl apply -f k8s/postgres.yaml -n $NAMESPACE

# Wait for database to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=300s

# Deploy application
kubectl apply -f k8s/deployment.yaml -n $NAMESPACE
kubectl apply -f k8s/service.yaml -n $NAMESPACE
kubectl apply -f k8s/ingress.yaml -n $NAMESPACE

# Apply autoscaling
kubectl apply -f k8s/hpa.yaml -n $NAMESPACE
kubectl apply -f k8s/pdb.yaml -n $NAMESPACE

# Wait for deployment to be ready
kubectl rollout status deployment/code-intelligence -n $NAMESPACE

echo "Deployment completed successfully!"
echo "Service URL: https://api.code-intelligence.dev"
```

### Health Check Script

```bash
#!/bin/bash
# scripts/health-check.sh
NAMESPACE=${1:-code-intelligence}

echo "Checking deployment health in namespace: $NAMESPACE"

# Check pod status
echo "Pod Status:"
kubectl get pods -n $NAMESPACE -l app=code-intelligence

# Check service endpoints
echo "\nService Endpoints:"
kubectl get endpoints -n $NAMESPACE

# Check ingress
echo "\nIngress Status:"
kubectl get ingress -n $NAMESPACE

# Check HPA
echo "\nHPA Status:"
kubectl get hpa -n $NAMESPACE

# Test health endpoint
echo "\nHealth Check:"
SERVICE_IP=$(kubectl get service code-intelligence -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
if [ ! -z "$SERVICE_IP" ]; then
    curl -f http://$SERVICE_IP/health || echo "Health check failed"
else
    echo "Service IP not available yet"
fi
```

## Troubleshooting

### Common Issues

**Pods not starting:**
```bash
# Check pod events
kubectl describe pod <pod-name> -n code-intelligence

# Check logs
kubectl logs <pod-name> -n code-intelligence

# Check resource constraints
kubectl top pods -n code-intelligence
```

**Service not accessible:**
```bash
# Check service endpoints
kubectl get endpoints code-intelligence -n code-intelligence

# Check ingress configuration
kubectl describe ingress code-intelligence -n code-intelligence

# Test internal connectivity
kubectl run test-pod --image=curlimages/curl -it --rm -- /bin/sh
```

**Database connection issues:**
```bash
# Check database pod
kubectl logs postgres-0 -n code-intelligence

# Test database connectivity
kubectl exec -it <app-pod> -n code-intelligence -- nc -zv postgres 5432
```

### Debugging Commands

```bash
# Get all resources
kubectl get all -n code-intelligence

# Check resource usage
kubectl top pods -n code-intelligence
kubectl top nodes

# Check events
kubectl get events -n code-intelligence --sort-by='.lastTimestamp'

# Port forward for local testing
kubectl port-forward service/code-intelligence 3000:80 -n code-intelligence
```

## Security Best Practices

1. **Use NetworkPolicies for network segmentation**
2. **Implement Pod Security Standards**
3. **Use secrets management (e.g., External Secrets Operator)**
4. **Enable RBAC with least privilege**
5. **Scan images for vulnerabilities**
6. **Use admission controllers**

```yaml
# k8s/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: code-intelligence-netpol
  namespace: code-intelligence
spec:
  podSelector:
    matchLabels:
      app: code-intelligence
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
```

## Next Steps

- [Cloud Platforms](cloud-platforms) for managed Kubernetes
- [Scaling Guide](scaling) for advanced scaling strategies
- [Security Guide](security) for production hardening
- [Monitoring Guide](monitoring) for observability setup

---

**Need help?** Check our [troubleshooting guide](../troubleshooting/common-issues) or join the [community discussions](https://github.com/your-org/code-intelligence-mcp/discussions).