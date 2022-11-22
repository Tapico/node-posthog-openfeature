import {
  EvaluationContext,
  Provider,
  ResolutionDetails,
  TypeMismatchError,
  ParseError,
  StandardResolutionReasons,
  Hook,
  FlagValue,
  ErrorCode,
  JsonValue,
  Logger,
} from '@openfeature/js-sdk'
import { PostHog, type PostHogOptions } from 'posthog-node'
import { FlagError } from './types'

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
  groups?: Record<string, string>

  /**
   * Extranous properties to use when evaluating
   * the feature flag
   */
  context?: Omit<EvaluationContext, 'targetingKey'> & {
    groupProperties?: Record<string, string>
    personalProperties?: Record<string, Record<string, string>>
  }
}

/**
 *
 */
export type PosthogClientOptions = Omit<PostHogOptions, 'enable' | 'personalApiKey'>

/**
 * @public
 * PosthogConfiguration
 */
export type PosthogConfiguration = {
  /**
   * The project API key used for events
   */
  apiKey: string

  /**
   * The personal API key used for evaluating feature flags
   */
  personalApiKey?: string

  /**
   * If true, the provider will evaluate the feature flags locally instead of via the decide-remote call
   */
  evaluateLocally?: boolean

  /**
   * PostHog client options
   */
  clientOptions?: PosthogClientOptions
}

/**
 * PostHog provider options
 */
export interface PostHogProviderOptions {
  /**
   * Instance of the PostHog-class, if not given a instance will be created
   * by the OpenFeature provider
   */
  posthogClient?: PostHog

  /**
   * Configuration to use when the OpenFEature provider creates an instance
   * of the PostHog client
   */
  posthogConfiguration?: PosthogConfiguration
}

/**
 * PostHogProvider
 */
export class PostHogProvider implements Provider {
  readonly metadata = {
    name: `posthog-provider`,
  } as const

  private readonly client: PostHog
  private readonly evaluateLocally: boolean

  constructor(options: PostHogProviderOptions) {
    if (!options.posthogClient && !options.posthogConfiguration) {
      throw new Error(`The 'posthogClient' or 'posthogConfiguration' should be given`)
    }

    if (options.posthogClient) {
      this.client = options.posthogClient
      this.evaluateLocally = options.posthogConfiguration?.evaluateLocally ?? false
    } else if (options.posthogConfiguration) {
      const { apiKey, personalApiKey, evaluateLocally, clientOptions } = options.posthogConfiguration
      if (!apiKey) {
        throw new Error(`Missing the PostHog 'apiKey' is not given`)
      }

      if (!personalApiKey) {
        throw new Error(`Missing the PostHog 'personalApiKey' is not given`)
      }

      this.evaluateLocally = evaluateLocally ?? false

      this.client = new PostHog(apiKey, this.createPosthogClientConfig(personalApiKey, clientOptions))
    } else {
      throw new Error(`Failed to intialise PostHog OpenFeature provider`)
    }
  }

  private createPosthogClientConfig(personalApiKey: string, config?: PosthogClientOptions): PostHogOptions {
    return {
      personalApiKey: personalApiKey,
      ...config,
    }
  }

  /**
   * Determines the boolean variation of a feature flag for a context, along with information about
   * how it was calculated.
   *
   * If the flag does not evaluate to a boolean value, then the defaultValue will be returned.
   *
   * @param flagKey The unique key of the feature flag.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from LaunchDarkly.
   * @param context The context requesting the flag. The client will generate an analytics event to
   *   register this context with LaunchDarkly if the context does not already exist.
   * @returns A promise which will resolve to a ResolutionDetails.
   */
  async resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext,
    _logger: Logger,
  ): Promise<ResolutionDetails<boolean>> {
    const details = await this.evaluate(flagKey, defaultValue, context)
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
   * Determines the string variation of a feature flag for a context, along with information about
   * how it was calculated.
   *
   * If the flag does not evaluate to a string value, then the defaultValue will be returned.
   *
   * @param flagKey The unique key of the feature flag.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from LaunchDarkly.
   * @param context The context requesting the flag. The client will generate an analytics event to
   *   register this context with LaunchDarkly if the context does not already exist.
   * @returns A promise which will resolve to a ResolutionDetails.
   */
  async resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext,
    _logger: Logger,
  ): Promise<ResolutionDetails<string>> {
    const details = await this.evaluate(flagKey, defaultValue, context)
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
   * Determines the numeric variation of a feature flag for a context, along with information about
   * how it was calculated.
   *
   * If the flag does not evaluate to a numeric value, then the defaultValue will be returned.
   *
   * @param flagKey The unique key of the feature flag.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from LaunchDarkly.
   * @param context The context requesting the flag. The client will generate an analytics event to
   *   register this context with LaunchDarkly if the context does not already exist.
   * @returns A promise which will resolve to a ResolutionDetails.
   */
  async resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    context: EvaluationContext,
    _logger: Logger,
  ): Promise<ResolutionDetails<number>> {
    const details = await this.evaluate(flagKey, defaultValue, context)
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
   * Determines the object variation of a feature flag for a context, along with information about
   * how it was calculated.
   *
   * @param flagKey The unique key of the feature flag.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from LaunchDarkly.
   * @param context The context requesting the flag. The client will generate an analytics event to
   *   register this context with LaunchDarkly if the context does not already exist.
   * @returns A promise which will resolve to a ResolutionDetails.
   */
  async resolveObjectEvaluation<U extends JsonValue>(
    flagKey: string,
    defaultValue: U,
    context: EvaluationContext,
    _logger: Logger,
  ): Promise<ResolutionDetails<U>> {
    const details = await this.evaluate(flagKey, context, defaultValue as any)
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
    const translatedContext = this.translateContext(context)

    if (!translatedContext.targetingKey) {
      return {
        value: defaultValue,
        errorCode: ErrorCode.GENERAL,
        reason: FlagError.MISSING_DISTINCT_ID,
      }
    }

    try {
      const flagResult = await this.client.getFeatureFlag(flagKey, translatedContext.distinctId, {
        onlyEvaluateLocally: this.evaluateLocally,
        sendFeatureFlagEvents: true,
        //
        // groups?: Record<string, string>;
        // personProperties?: Record<string, string>;
        // groupProperties?: Record<string, Record<string, string>>;
      })

      // If the flagResult is undefined,meaning the flag doesn't exist or failed
      if (!flagResult) {
        return {
          value: defaultValue,
          reason: StandardResolutionReasons.DEFAULT,
          errorCode: ErrorCode.FLAG_NOT_FOUND,
        }
      }

      return {
        value: flagResult,
        reason: StandardResolutionReasons.DEFAULT,
        errorCode: ErrorCode.FLAG_NOT_FOUND,
      }
    } catch (err: unknown) {
      return {
        value: defaultValue,
        reason: StandardResolutionReasons.ERROR,
        errorCode: ErrorCode.GENERAL,
      }
    }
  }

  /**
   * @protected
   */
  private translateContext(evalContext: EvaluationContext): any {
    const { targetingKey } = evalContext
    return {
      targetingKey,
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
  get hooks(): Hook<FlagValue>[] {
    return []
  }
}
