/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  FlagValue,
  Hook,
  HookContext,
  HookHints,
  ResolutionDetails,
  StandardResolutionReasons,
} from '@openfeature/js-sdk'
import { Span, trace, Tracer, Counter, Meter, metrics, ValueType } from '@opentelemetry/api'
import { VERSION } from '../VERSION.js'

export const FeatureFlagAttributes = {
  FLAG_KEY: 'feature_flag.flag_key',
  TARGETING_KEY: 'feature_flag.targeting_key',
  CLIENT_NAME: 'feature_flag.client.name',
  CLIENT_VERSION: 'feature_flag.client.version',
  PROVIDER_NAME: 'feature_flag.provider.name',
  PROVIDER_MANAGEMENT_URL: 'feature_flag.provider.management_url',
  VARIANT: 'feature_flag.evaluated.variant',
  VALUE: 'feature_flag.evaluated.value',
  REASON: 'feature_flag.evaluated.reason',
}

export const FeatureFlagMetricAttributes = {
  FLAG_KEY: 'flag_key',
  REASON: 'reason',
  ERROR_CODE: 'error_code',
  PROVIDER_NAME: 'provider_name',
}

/**
 * A hook that adds standard OpenTelemetry data.
 */
export class OpenTelemetryHook implements Hook {
  readonly name = 'open-telemetry'
  private tracer: Tracer
  private meter: Meter
  private spanMap = new WeakMap<HookContext, Span>()
  private metricFlags: Counter
  private metricFailedFlags: Counter

  constructor(name: string) {
    this.tracer = trace.getTracer(`@tapico/node-feature:${name}`, VERSION)
    this.meter = metrics.getMeter(`@tapico/node-feature:${name}`, VERSION, {
      schemaUrl: 'https://openfeature.org/schemas/v1/schema.json',
    })

    this.metricFlags = this.meter.createCounter(`feature_flag`, {
      description: 'Number of times a feature flag is being used',
      valueType: ValueType.INT,
    })

    this.metricFailedFlags = this.meter.createCounter(`feature_flag_failed`, {
      description: 'Number of times a feature flag evaluation failed',
      valueType: ValueType.INT,
    })
  }

  before(hookContext: HookContext, _hookHints: HookHints) {
    const span = this.tracer.startSpan(`feature flag - ${hookContext.flagValueType}`)
    span.setAttributes({
      [FeatureFlagAttributes.FLAG_KEY]: hookContext.flagKey,
      [FeatureFlagAttributes.TARGETING_KEY]: hookContext.context.targetingKey,
      [FeatureFlagAttributes.CLIENT_NAME]: hookContext.clientMetadata.name,
      [FeatureFlagAttributes.CLIENT_VERSION]: hookContext.clientMetadata.version,
      [FeatureFlagAttributes.PROVIDER_NAME]: hookContext.providerMetadata.name,
    })
    this.spanMap.set(hookContext, span)
    return hookContext.context
  }

  after(hookContext: HookContext, flagValue: ResolutionDetails<FlagValue>, _hookHints: HookHints) {
    if (flagValue.variant) {
      this.spanMap.get(hookContext)?.setAttribute(FeatureFlagAttributes.VARIANT, flagValue.variant)
    } else {
      this.spanMap.get(hookContext)?.setAttribute(FeatureFlagAttributes.VALUE, JSON.stringify(flagValue.value))
    }

    if (flagValue.errorCode) {
      this.metricFailedFlags.add(1, {
        [FeatureFlagMetricAttributes.FLAG_KEY]: hookContext.flagKey,
        [FeatureFlagMetricAttributes.ERROR_CODE]: flagValue.errorCode ?? 'unknown',
        [FeatureFlagMetricAttributes.PROVIDER_NAME]: hookContext.providerMetadata.name,
      })
    }

    this.metricFlags.add(1, {
      [FeatureFlagMetricAttributes.FLAG_KEY]: hookContext.flagKey,
      [FeatureFlagMetricAttributes.REASON]: flagValue.reason ?? StandardResolutionReasons.UNKNOWN,
      [FeatureFlagMetricAttributes.PROVIDER_NAME]: hookContext.providerMetadata.name,
    })
  }

  finally(hookContext: HookContext, _hookHints: HookHints) {
    this.spanMap.get(hookContext)?.end()
  }

  error(hookContext: HookContext, error: Error, _hookHints: HookHints) {
    this.spanMap.get(hookContext)?.recordException(error)
  }
}
