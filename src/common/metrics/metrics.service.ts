import { Injectable } from '@nestjs/common';

const HISTOGRAM_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];

interface RequestMetrics {
  method: string;
  route: string;
  statusCode: number;
  count: number;
  durationSeconds: number;
  buckets: number[];
}

@Injectable()
export class MetricsService {
  private readonly requests = new Map<string, RequestMetrics>();

  recordRequest(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
  ): void {
    const key = JSON.stringify([method, route, statusCode]);
    let metrics = this.requests.get(key);
    if (!metrics) {
      metrics = {
        method,
        route,
        statusCode,
        count: 0,
        durationSeconds: 0,
        buckets: HISTOGRAM_BUCKETS.map(() => 0),
      };
      this.requests.set(key, metrics);
    }

    metrics.count += 1;
    metrics.durationSeconds += durationSeconds;
    HISTOGRAM_BUCKETS.forEach((bucket, index) => {
      if (durationSeconds <= bucket) metrics.buckets[index] += 1;
    });
  }

  renderPrometheusMetrics(): string {
    const lines = [
      '# HELP http_requests_total Total HTTP requests.',
      '# TYPE http_requests_total counter',
    ];

    for (const metrics of this.requests.values()) {
      lines.push(`http_requests_total${this.labels(metrics)} ${metrics.count}`);
    }

    lines.push(
      '# HELP http_request_duration_seconds HTTP request duration in seconds.',
      '# TYPE http_request_duration_seconds histogram',
    );
    for (const metrics of this.requests.values()) {
      HISTOGRAM_BUCKETS.forEach((bucket, index) => {
        lines.push(
          `http_request_duration_seconds_bucket${this.labels(metrics, String(bucket))} ${metrics.buckets[index]}`,
        );
      });
      lines.push(
        `http_request_duration_seconds_bucket${this.labels(metrics, '+Inf')} ${metrics.count}`,
        `http_request_duration_seconds_sum${this.labels(metrics)} ${metrics.durationSeconds}`,
        `http_request_duration_seconds_count${this.labels(metrics)} ${metrics.count}`,
      );
    }

    return `${lines.join('\n')}\n`;
  }

  private labels(metrics: RequestMetrics, le?: string): string {
    const labels = [
      `method="${this.escapeLabel(metrics.method)}"`,
      `route="${this.escapeLabel(metrics.route)}"`,
      `status_code="${metrics.statusCode}"`,
      ...(le === undefined ? [] : [`le="${le}"`]),
    ];
    return `{${labels.join(',')}}`;
  }

  private escapeLabel(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/"/g, '\\"');
  }
}
