import { trace } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | null = null;

interface TelemetryOptions {
  serviceName: string;
  environment?: string;
  otlpEndpoint?: string;
}

export async function startTelemetry(options: TelemetryOptions) {
  if (sdk) {
    return;
  }

  const baseEnvironment = options.environment ?? process.env.NODE_ENV ?? 'development';
  const resource = defaultResource().merge(
    resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: options.serviceName,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: baseEnvironment,
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version ?? '0.0.0'
    })
  );

  const instrumentations = getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-http': {
      ignoreIncomingPaths: [/^\/metrics/]
    }
  });

  const exporter = options.otlpEndpoint
    ? new OTLPTraceExporter({ url: options.otlpEndpoint })
    : undefined;

  sdk = new NodeSDK({
    resource,
    traceExporter: exporter,
    instrumentations
  });

  await sdk.start();
}

export async function shutdownTelemetry() {
  if (!sdk) {
    return;
  }

  await sdk.shutdown();
  sdk = null;
}

export function getActiveTraceId(): string | undefined {
  const activeSpan = trace.getActiveSpan();
  if (!activeSpan) {
    return undefined;
  }

  const context = activeSpan.spanContext();
  return context.traceId;
}
