import { logger } from './logger.js';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import type { ExtendedRequest, PerformanceMetrics, HealthStatus } from '../middleware/types.js';
import type { Response } from 'express';
import type { Alert, MonitoringConfig } from '../types/index.js';

// Monitoring interfaces
export interface MetricData {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration: number; // milliseconds
  enabled: boolean;
  actions: AlertAction[];
}

export interface AlertAction {
  type: 'log' | 'email' | 'webhook' | 'slack';
  config: MonitoringConfig;
}


const defaultConfig: MonitoringConfig = {
  enabled: true,
  metricsRetentionMs: 24 * 60 * 60 * 1000, // 24 hours
  alertCheckIntervalMs: 30 * 1000, // 30 seconds
  maxMetricsInMemory: 10000,
  enableSystemMetrics: true,
  enableRequestMetrics: true,
  enableErrorTracking: true,
  enablePerformanceTracking: true,
};

export class MonitoringService extends EventEmitter {
  private config: MonitoringConfig;
  private metrics: Map<string, MetricData[]> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private systemMetricsInterval?: NodeJS.Timeout;
  private alertCheckInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private requestCounts: Map<string, number> = new Map();
  private responseTimes: Map<string, number[]> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private startTime: number;

  constructor(config: Partial<MonitoringConfig> = {}) {
    super();
    this.config = { ...defaultConfig, ...config };
    this.startTime = Date.now();

    if (this.config.enabled) {
      this.initialize();
    }
  }

  private initialize(): void {
    // Start system metrics collection
    if (this.config.enableSystemMetrics) {
      this.startSystemMetricsCollection();
    }

    // Start alert checking
    this.startAlertChecking();

    // Start cleanup process
    this.startCleanupProcess();

    logger.info('Monitoring service initialized');
  }

  /**
   * Record a metric
   */
  recordMetric(
    name: string,
    value: number,
    type: MetricData['type'] = 'gauge',
    tags?: Record<string, string>,
  ): void {
    if (!this.config.enabled) {return;}

    const metric: MetricData = {
      name,
      value,
      timestamp: Date.now(),
      tags,
      type,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricArray = this.metrics.get(name)!;
    metricArray.push(metric);

    // Limit metrics in memory
    if (metricArray.length > Number(this.config.maxMetricsInMemory)) {
      metricArray.shift();
    }

    this.emit('metric', metric);
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, value = 1, tags?: Record<string, string>): void {
    const current = this.getLatestMetricValue(name) || 0;
    this.recordMetric(name, current + value, 'counter', tags);
  }

  /**
   * Record a timer metric
   */
  recordTimer(name: string, startTime: number, tags?: Record<string, string>): void {
    const duration = performance.now() - startTime;
    this.recordMetric(name, duration, 'timer', tags);
  }

  /**
   * Start a timer and return a function to end it
   */
  startTimer(name: string, tags?: Record<string, string>): () => void {
    const startTime = performance.now();
    return () => this.recordTimer(name, startTime, tags);
  }

  /**
   * Record request metrics
   */
  recordRequest(req: ExtendedRequest, res: Response, responseTime: number): void {
    if (!this.config.enableRequestMetrics) {return;}

    const route = req.route?.path || req.path;
    const { method } = req;
    const status = res.statusCode;
    const key = `${method}:${route}`;

    // Record request count
    const currentCount = this.requestCounts.get(key) || 0;
    this.requestCounts.set(key, currentCount + 1);
    this.recordMetric('http_requests_total', currentCount + 1, 'counter', {
      method,
      route,
      status: status.toString(),
    });

    // Record response time
    if (!this.responseTimes.has(key)) {
      this.responseTimes.set(key, []);
    }
    this.responseTimes.get(key)!.push(responseTime);
    this.recordMetric('http_request_duration_ms', responseTime, 'histogram', {
      method,
      route,
      status: status.toString(),
    });

    // Record error count
    if (status >= 400) {
      const currentErrorCount = this.errorCounts.get(key) || 0;
      this.errorCounts.set(key, currentErrorCount + 1);
      this.recordMetric('http_errors_total', currentErrorCount + 1, 'counter', {
        method,
        route,
        status: status.toString(),
      });
    }
  }

  /**
   * Record error
   */
  recordError(error: Error, context?: Record<string, unknown>): void {
    if (!this.config.enableErrorTracking) {return;}

    this.incrementCounter('errors_total', 1, {
      error_type: error.name,
      error_message: error.message,
    });

    this.emit('error', { error, context, timestamp: Date.now() });
  }

  /**
   * Get metrics by name
   */
  getMetrics(name: string, since?: number): MetricData[] {
    const metrics = this.metrics.get(name) || [];

    if (since) {
      return metrics.filter(m => m.timestamp >= since);
    }

    return [...metrics];
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Get latest metric value
   */
  getLatestMetricValue(name: string): number | null {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) {return null;}

    return metrics[metrics.length - 1].value;
  }

  /**
   * Calculate metric statistics
   */
  getMetricStats(
    name: string,
    since?: number,
  ): {
    count: number;
    min: number;
    max: number;
    avg: number;
    sum: number;
    latest: number;
  } | null {
    const metrics = this.getMetrics(name, since);

    if (metrics.length === 0) {return null;}

    const values = metrics.map(m => m.value);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / values.length,
      sum,
      latest: values[values.length - 1],
    };
  }

  /**
   * Add alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    logger.info(`Alert rule added: ${rule.name}`);
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId);
    logger.info(`Alert rule removed: ${ruleId}`);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !(alert as any).resolved);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert && !(alert as any).resolved) {
      (alert as any).resolved = true;
      (alert as any).resolvedAt = Date.now();
      this.emit('alertResolved', alert);
    }
  }

  /**
   * Get system performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const memoryUsage = process.memoryUsage();
    const uptime = Date.now() - this.startTime;

    // Calculate request metrics
    const totalRequests = Array.from(this.requestCounts.values()).reduce((a, b) => a + b, 0);
    const totalErrors = Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0);

    // Calculate average response time
    const allResponseTimes = Array.from(this.responseTimes.values()).flat();
    const averageResponseTime =
      allResponseTimes.length > 0
        ? allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length
        : 0;

    return {
      requestCount: totalRequests,
      errorCount: totalErrors,
      averageResponseTime,
      memoryUsage: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
      },
      uptime,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get health status
   */
  getHealthStatus(): HealthStatus {
    const metrics = this.getPerformanceMetrics();
    const activeAlerts = this.getActiveAlerts();

    // Determine overall health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (activeAlerts.some(alert => (alert as any).ruleName?.includes('critical'))) {
      status = 'unhealthy';
    } else if (activeAlerts.length > 0) {
      status = 'degraded';
    }

    // Check memory usage
    const memoryUsagePercent = (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100;
    if (memoryUsagePercent > 90) {
      status = 'unhealthy';
    } else if (memoryUsagePercent > 80) {
      status = status === 'healthy' ? 'degraded' : status;
    }

    // Check error rate
    const errorRate =
      metrics.requestCount > 0 ? (metrics.errorCount / metrics.requestCount) * 100 : 0;
    if (errorRate > 10) {
      status = 'unhealthy';
    } else if (errorRate > 5) {
      status = status === 'healthy' ? 'degraded' : status;
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: metrics.uptime / 1000, // Convert to seconds
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: 'healthy', // This would be determined by actual health checks
        rustCore: 'healthy',
        llmService: 'healthy',
        fileSystem: 'healthy',
      },
      metrics,
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    const lines: string[] = [];

    for (const [name, metrics] of this.metrics) {
      if (metrics.length === 0) {continue;}

      const latest = metrics[metrics.length - 1];
      const sanitizedName = name.replace(/[^a-zA-Z0-9_]/g, '_');

      lines.push(`# HELP ${sanitizedName} ${name}`);
      lines.push(`# TYPE ${sanitizedName} ${latest.type}`);

      if (latest.tags) {
        const tags = Object.entries(latest.tags)
          .map(([key, value]) => `${key}="${value}"`)
          .join(',');
        lines.push(`${sanitizedName}{${tags}} ${latest.value}`);
      } else {
        lines.push(`${sanitizedName} ${latest.value}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Start system metrics collection
   */
  private startSystemMetricsCollection(): void {
    this.systemMetricsInterval = setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      // Record memory metrics
      this.recordMetric('system_memory_rss_bytes', memoryUsage.rss);
      this.recordMetric('system_memory_heap_total_bytes', memoryUsage.heapTotal);
      this.recordMetric('system_memory_heap_used_bytes', memoryUsage.heapUsed);
      this.recordMetric('system_memory_external_bytes', memoryUsage.external);

      // Record CPU metrics
      this.recordMetric('system_cpu_user_microseconds', cpuUsage.user);
      this.recordMetric('system_cpu_system_microseconds', cpuUsage.system);

      // Record uptime
      this.recordMetric('system_uptime_seconds', (Date.now() - this.startTime) / 1000);

      // Record event loop lag
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1e6; // Convert to milliseconds
        this.recordMetric('system_event_loop_lag_ms', lag);
      });
    }, 10000); // Every 10 seconds
  }

  /**
   * Start alert checking
   */
  private startAlertChecking(): void {
    this.alertCheckInterval = setInterval(() => {
      this.checkAlerts();
    }, Number(this.config.alertCheckIntervalMs));
  }

  /**
   * Check alerts against rules
   */
  private checkAlerts(): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) {continue;}

      const latestValue = this.getLatestMetricValue(rule.metric);
      if (latestValue === null) {continue;}

      const shouldAlert = this.evaluateCondition(latestValue, rule.condition, rule.threshold);
      const existingAlert = Array.from(this.alerts.values()).find(
        alert => (alert as any).ruleId === rule.id && !(alert as any).resolved,
      );

      if (shouldAlert && !existingAlert) {
        // Create new alert
        const alert: Alert = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ruleId: rule.id,
          ruleName: rule.name,
          metric: rule.metric,
          value: latestValue,
          threshold: rule.threshold,
          condition: rule.condition,
          timestamp: String(Date.now()),
          resolved: false,
        };

        this.alerts.set(alert.id, alert);
        this.emit('alert', alert);
        this.executeAlertActions(rule, alert);
      } else if (!shouldAlert && existingAlert) {
        // Resolve existing alert
        this.resolveAlert(existingAlert.id);
      }
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'gt':
        return value > threshold;
      case 'gte':
        return value >= threshold;
      case 'lt':
        return value < threshold;
      case 'lte':
        return value <= threshold;
      case 'eq':
        return value === threshold;
      default:
        return false;
    }
  }

  /**
   * Execute alert actions
   */
  private executeAlertActions(rule: AlertRule, alert: Alert): void {
    for (const action of rule.actions) {
      try {
        switch (action.type) {
          case 'log':
            logger.error(
              `ALERT: ${(alert as any).ruleName} - ${(alert as any).metric} ${(alert as any).condition} ${(alert as any).threshold} (current: ${(alert as any).value})`,
            );
            break;
          case 'webhook':
            // Implement webhook notification
            this.sendWebhookAlert(action.config, alert);
            break;
          case 'email':
            // Implement email notification
            this.sendEmailAlert(action.config, alert);
            break;
          case 'slack':
            // Implement Slack notification
            this.sendSlackAlert(action.config, alert);
            break;
        }
      } catch (error) {
        logger.error(`Failed to execute alert action ${action.type}:`, error);
      }
    }
  }

  /**
   * Send webhook alert (placeholder)
   */
  private async sendWebhookAlert(config: MonitoringConfig, alert: Alert): Promise<void> {
    // Implement webhook sending logic
    logger.info('Webhook alert would be sent:', { config, alert });
  }

  /**
   * Send email alert (placeholder)
   */
  private async sendEmailAlert(config: MonitoringConfig, alert: Alert): Promise<void> {
    // Implement email sending logic
    logger.info('Email alert would be sent:', { config, alert });
  }

  /**
   * Send Slack alert (placeholder)
   */
  private async sendSlackAlert(config: MonitoringConfig, alert: Alert): Promise<void> {
    // Implement Slack sending logic
    logger.info('Slack alert would be sent:', { config, alert });
  }

  /**
   * Start cleanup process
   */
  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupOldMetrics();
        this.cleanupOldAlerts();
      },
      60 * 60 * 1000,
    ); // Every hour
  }

  /**
   * Clean up old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - this.config.metricsRetentionMs;

    for (const [name, metrics] of this.metrics) {
      const filtered = metrics.filter(m => m.timestamp >= cutoff);
      this.metrics.set(name, filtered);
    }
  }

  /**
   * Clean up old alerts
   */
  private cleanupOldAlerts(): void {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days

    for (const [id, alert] of this.alerts) {
      if (alert.resolved && alert.resolvedAt && alert.resolvedAt < cutoff) {
        this.alerts.delete(id);
      }
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (!this.config.enabled) {
      this.stop();
    } else if (!this.systemMetricsInterval) {
      this.initialize();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  /**
   * Stop monitoring service
   */
  stop(): void {
    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
      this.systemMetricsInterval = undefined;
    }

    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
      this.alertCheckInterval = undefined;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    logger.info('Monitoring service stopped');
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.metrics.clear();
    this.alerts.clear();
    this.requestCounts.clear();
    this.responseTimes.clear();
    this.errorCounts.clear();
  }
}

// Create default instance
const monitoringService = new MonitoringService();

// Export convenience functions
export const recordMetric = monitoringService.recordMetric.bind(monitoringService);
export const incrementCounter = monitoringService.incrementCounter.bind(monitoringService);
export const startTimer = monitoringService.startTimer.bind(monitoringService);
export const recordRequest = monitoringService.recordRequest.bind(monitoringService);
export const recordError = monitoringService.recordError.bind(monitoringService);
export const getMetrics = monitoringService.getMetrics.bind(monitoringService);
export const getPerformanceMetrics =
  monitoringService.getPerformanceMetrics.bind(monitoringService);
export const getHealthStatus = monitoringService.getHealthStatus.bind(monitoringService);

// Export class and default instance
export default monitoringService;
