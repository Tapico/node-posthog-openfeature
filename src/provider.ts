import type {
  ContextTransformer,
  EvaluationContext,
  FlagEvaluationOptions,
  Provider,
  ResolutionDetails,
  ProviderOptions,
} from '@openfeature/nodejs-sdk'
import PostHog from 'posthog-node'
import * as undici from 'undici'
import { ParseError, TypeMismatchError } from './errors'
import { FlagError, FlagResolution } from './types'
import { VERSION } from './VERSION'

type Groups = Record<string, string | number>

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

/**
 *
 */
export interface PostHogProviderOptions extends ProviderOptions<PosthogInfo> {
  /**
   * The personal API key used for evaluating feature flags
   */
  personalApiKey: string
  /**
   * The project API key used for events
   */
  apiKey: string
  /**
   * Sets the host of the PostHog service
   */
  host?: string
  /**
   * Interval for refreshing feature flags in seconds
   */
  featureFlagsPollingInterval?: number
  /**
   * Send feature flag event when flag is getting queries
   */
  sendFeatureFlagEvent?: boolean
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
    name: 'PostHog Provider',
  } as const
  private readonly clientOptions: PostHogProviderOptions

  readonly contextTransformer: ContextTransformer<PosthogInfo>
  private client: PostHog

  constructor(options: PostHogProviderOptions) {
    this.contextTransformer = options.contextTransformer || DEFAULT_CONTEXT_TRANSFORMER
    // TODO
    if (!options.personalApiKey && options.personalApiKey.length > 0) {
      throw new Error(`Missing required 'personalApiKey' in provider configuration`)
    }

    if (!options.apiKey && options.apiKey.length > 0) {
      throw new Error(`Missing required 'apiKey' in provider configuration`)
    }

    this.clientOptions = options
    this.client = new PostHog(this.clientOptions.apiKey, {
      host: this.clientOptions.host,
      personalApiKey: this.clientOptions.personalApiKey,
      featureFlagsPollingInterval: options.featureFlagsPollingInterval,
    })
  }

  /**
   * Get a boolean flag value.
   */
  async resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    transformedContext: EvaluationContext,
    _options: FlagEvaluationOptions | undefined,
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
    _options: FlagEvaluationOptions | undefined,
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
    _options: FlagEvaluationOptions | undefined,
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
    _options: FlagEvaluationOptions | undefined,
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
    context: EvaluationContext,
  ): Promise<ResolutionDetails<boolean | string | number>> {
    if (!context.distinctId) {
      return {
        value: defaultValue,
        errorCode: FlagError.MISSING_DISTINCT_ID,
        reason: FlagResolution.DEFAULT,
      }
    }

    try {
      const result = await this.getFeatureFlag(flagKey, context.distinctId as string, defaultValue)
      return result
    } catch (err: unknown) {
      return {
        value: defaultValue,
        reason: FlagResolution.DEFAULT,
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

  private async getFeatureFlag(
    flagKey: string,
    distinctId: string,
    defaultValue: boolean | string | number,
    context?: PosthogInfo,
  ): Promise<ResolutionDetails<boolean | string | number>> {
    let isSuccessful = false
    let flagValue: boolean | string | number = defaultValue
    const apiHost = this.clientOptions.host ?? 'https://app.posthog.com'
    const apiUrl = `${apiHost}/decide?v=2`
    try {
      const requestBody = {
        token: this.clientOptions.apiKey,
        distinct_id: distinctId,
        groups: context?.groups,
      }

      const response = await undici.fetch(apiUrl, {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'user-agent': `openfeature-posthog/${VERSION}`,
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.clientOptions.personalApiKey}`,
        },
      })

      if (!response.ok) {
        return {
          value: defaultValue,
          reason: FlagResolution.DEFAULT,
          errorCode: FlagError.SYSTEM_ERROR,
        }
      }

      const json: any = await response.json()
      const featureFlags = json.featureFlags
      if (featureFlags) {
        if (featureFlags.hasOwnProperty(flagKey)) {
          flagValue = featureFlags[flagKey]
        } else {
          return {
            value: defaultValue,
            reason: FlagResolution.DEFAULT,
            errorCode: FlagError.MISSING_FEATURE_FLAG,
          }
        }

        isSuccessful = true
      } else {
        return {
          value: defaultValue,
          reason: FlagResolution.DEFAULT,
          errorCode: FlagError.MISSING_FEATURE_FLAG,
        }
      }
    } catch (err: unknown) {
      return {
        value: defaultValue,
        reason: FlagResolution.DEFAULT,
        errorCode: FlagError.SYSTEM_ERROR,
      }
    }

    // Ensure we trigger an event when feature flag is queried
    if (isSuccessful && this.clientOptions.sendFeatureFlagEvent === true) {
      this.client.capture({
        distinctId: distinctId,
        event: '$feature_flag_called',
        properties: {
          $feature_flag: flagKey,
          $feature_flag_response: flagValue,
        },
      })
    }

    //
    return {
      value: flagValue,
      ...(typeof flagValue === 'string' ? { variant: flagValue } : undefined),
      reason: FlagResolution.TARGETING_MATCH,
    }
  }
}
