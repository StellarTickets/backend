import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('exports request counts and cumulative duration histogram buckets', () => {
    const metrics = new MetricsService();
    metrics.recordRequest('GET', '/events/:param', 200, 0.008);
    metrics.recordRequest('GET', '/events/:param', 200, 0.02);

    const output = metrics.renderPrometheusMetrics();

    expect(output).toContain(
      'http_requests_total{method="GET",route="/events/:param",status_code="200"} 2',
    );
    expect(output).toContain(
      'http_request_duration_seconds_bucket{method="GET",route="/events/:param",status_code="200",le="0.01"} 1',
    );
    expect(output).toContain(
      'http_request_duration_seconds_bucket{method="GET",route="/events/:param",status_code="200",le="+Inf"} 2',
    );
    expect(output).toContain(
      'http_request_duration_seconds_count{method="GET",route="/events/:param",status_code="200"} 2',
    );
  });

  it('escapes Prometheus label values', () => {
    const metrics = new MetricsService();
    metrics.recordRequest('GE"T', '/line\nbreak', 200, 0.001);

    expect(metrics.renderPrometheusMetrics()).toContain(
      'method="GE\\"T",route="/line\\nbreak"',
    );
  });
});
