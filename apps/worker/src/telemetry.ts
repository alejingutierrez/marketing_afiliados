import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
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

  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: options.serviceName,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: options.environment ?? process.env.NODE_ENV ?? 'development',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version ?? '0.0.0'
  });

  const instrumentations = getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-http': {
      ignoreOutgoingUrls: [/\/metrics$/]
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
