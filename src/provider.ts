import {
  ContextTransformer,
  EvaluationContext,
  FlagEvaluationOptions,
  Provider,
  ResolutionDetails,
  ProviderOptions,
  TypeMismatchError,
  ParseError,
  StandardResolutionReasons,
} from '@openfeature/nodejs-sdk'
import { PostHogGlobal,  type PostHogOptions } from 'posthog-node'
import { FlagError } from './types'
import { VERSION } from './VERSION'

type Groups =  Record<string, string>

type PosthogInfo = {
  /**
   * Targeting key or unique identifier to use for
   * evaluating the feature flag
   */
  distinctId?: string
  /**
   * Define the groups to use when evaulating
   * the feture flags,
   * requires Group Analytics enabled in PostHog
   */
  groups?: Groups
  /**
   * Extranous properties to use when evaluating
   * the feature flag
   */
  context?: Omit<EvaluationContext, 'targetingKey'>
}

export type PartialPosthogOptions = Omit<PostHogOptions, 'enable'>

/**
 * PostHog provider options
 */
export interface PostHogProviderOptions extends ProviderOptions<PosthogInfo> {

   /**
    * The project API key used for events
    */
  apiKey: string

  /**
   *
   */
  config?: PartialPosthogOptions
}

/**
 * Transform the context into an object useful for the v2 Flagsmith API, an identifier string with a "dictionary" of traits.
 */
const DEFAULT_CONTEXT_TRANSFORMER = (context: EvaluationContext): PosthogInfo => {
  const { targetingKey, groups, ...contextInfo } = context

  return {
    distinctId: targetingKey,
    context: contextInfo,
  }
}

/**
 * PostHogProvider
 */
export class PostHogProvider implements Provider {
  readonly metadata = {
    name: `posthog-provider`,
    version: VERSION
  } as const
  private readonly clientOptions: PostHogProviderOptions

  readonly contextTransformer: ContextTransformer<PosthogInfo>
  private client: PostHogGlobal

  constructor(options: PostHogProviderOptions) {
    this.contextTransformer = options.contextTransformer || DEFAULT_CONTEXT_TRANSFORMER

    if (!options.apiKey) {
      throw new Error(`Missing required 'apiKey' in provider configuration`)
    }

    this.clientOptions = options
    const posthogOptions = {
      // preloadFeatureFlags: true,
      // sendFeatureFlagEvent: true,
      // decidePollInterval: 100,
      ...(options?.config ?? {})
    }

    this.client = new PostHogGlobal(this.clientOptions.apiKey, posthogOptions)
  }

  /**
   * Get a boolean flag value.
   */
  async resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    transformedContext: EvaluationContext,
    _options: FlagEvaluationOptions | undefined
  ): Promise<ResolutionDetails<boolean>> {
    const details = await this.evaluate(flagKey, defaultValue, transformedContext)
    if (typeof details.value === 'boolean') {
      const value = details.value
      return {
        ...details,
        value,
      }
    } else {
      throw new TypeMismatchError(this.getFlagTypeErrorMessage(flagKey, details.value, 'boolean'))
    }
  }

  /**
   * Get a string flag with additional details.
   */
  async resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    transformedContext: EvaluationContext,
    _options: FlagEvaluationOptions | undefined
  ): Promise<ResolutionDetails<string>> {
    const details = await this.evaluate(flagKey, defaultValue, transformedContext)
    if (typeof details.value === 'string') {
      const value = details.value
      return {
        ...details,
        value,
      }
    } else {
      throw new TypeMismatchError(this.getFlagTypeErrorMessage(flagKey, details.value, 'string'))
    }
  }

  /**
   * Get a number flag value.
   */
  async resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    transformedContext: EvaluationContext,
    _options: FlagEvaluationOptions | undefined
  ): Promise<ResolutionDetails<number>> {
    const details = await this.evaluate(flagKey, defaultValue, transformedContext)
    if (typeof details.value === 'number') {
      const value = details.value
      return {
        ...details,
        value,
      }
    } else {
      throw new TypeMismatchError(this.getFlagTypeErrorMessage(flagKey, details.value, 'number'))
    }
  }

  /**
   * Get an object (JSON) flag value.
   */
  async resolveObjectEvaluation<U extends object>(
    flagKey: string,
    defaultValue: U,
    transformedContext: EvaluationContext,
    _options: FlagEvaluationOptions | undefined
  ): Promise<ResolutionDetails<U>> {
    const details = await this.evaluate(flagKey, transformedContext, defaultValue as any)
    if (typeof details.value === 'string') {
      try {
        return {
          value: JSON.parse(details.value),
        }
      } catch (err: unknown) {
        throw new ParseError(`Error parsing flag value for ${flagKey}`)
      }
    } else {
      throw new TypeMismatchError(this.getFlagTypeErrorMessage(flagKey, details.value, 'object'))
    }
  }

  /**
   * @internal
   * @param flagKey the unique name of the feature flag
   * @param PosthogInfo the user identifier
   * @returns ResolutionDetails
   */
  private async evaluate(
    flagKey: string,
    defaultValue: any,
    context: EvaluationContext
  ): Promise<ResolutionDetails<boolean | string | number>> {
    if (!context.distinctId) {
      return {
        value: defaultValue,
        errorCode: FlagError.MISSING_DISTINCT_ID,
        reason: StandardResolutionReasons.DEFAULT,
      }
    }

    try {
      const result = await this.getFeatureFlag(flagKey, context.distinctId as string, defaultValue)
      // when we receive undefined then the feature flag doesn't exist
      if (!result) {
        return {
          value: defaultValue,
          reason: StandardResolutionReasons.ERROR,
          errorCode: FlagError.MISSING_FEATURE_FLAG,
        }
      }
      return result
    } catch (err: unknown) {
      return {
        value: defaultValue,
        reason: StandardResolutionReasons.ERROR,
        errorCode: FlagError.SYSTEM_ERROR,
      }
    }
  }

  /**
   * Generates type mismatch error message
   * @returns string
   */
  private getFlagTypeErrorMessage(flagKey: string, value: unknown, expectedType: string) {
    return `Flag value ${flagKey} had unexpected type ${typeof value}, expected ${expectedType}.`
  }

  /**
   * @inheritDoc
   */
  private async getFeatureFlag(
    flagKey: string,
    distinctId: string,
    defaultValue: boolean | string | number,
    context?: PosthogInfo
  ): Promise<ResolutionDetails<boolean | string | number>> {
    console.log(`getFeatureFlag() flagKey: ${flagKey} distinctId: ${distinctId}`)

    let flagValue: boolean | string | number = defaultValue
    try {
      const featureFlagResponse = await this.client.getFeatureFlag(flagKey, distinctId, context?.groups)
      console.log(`Received featureFlagResponse:`, featureFlagResponse)
      if (!featureFlagResponse) {
        return {
          value: defaultValue,
          reason: StandardResolutionReasons.DEFAULT,
          errorCode: FlagError.SYSTEM_ERROR,
        }
      }

      return {
        value: flagValue,
        ...(typeof flagValue === 'string' ? { variant: flagValue } : undefined),
        reason: StandardResolutionReasons.TARGETING_MATCH,
      }
    } catch (err: unknown) {
      console.log(`Error:`, err)
      return {
        value: defaultValue,
        reason: StandardResolutionReasons.ERROR,
        errorCode: FlagError.SYSTEM_ERROR,
      }
    }
  }
}
