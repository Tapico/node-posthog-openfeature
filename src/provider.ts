import type { EvaluationContext, Provider, ResolutionDetails, Hook, JsonValue, Logger } from '@openfeature/server-sdk'
import { TypeMismatchError, StandardResolutionReasons, ErrorCode } from '@openfeature/server-sdk'
import { PostHog } from 'posthog-node'
import type { PostHogOptions } from 'posthog-node'
import { FlagError } from './types'

export type PosthogInfo = {
  /**
   * Targeting key or unique identifier to use for
   * evaluating the feature flag
   */
  targetingKey?: string

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
    /**
     * @optional
     */
    groupProperties?: Record<string, Record<string, string>>
    /**
     * @optional
     */
    personProperties?: Record<string, string>
  }
}

/**
 * @public
 * All supported PostHog client options that can be passed to the provider
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
   * If true, the provider will be running in debug mode
   */
  debugMode?: boolean

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
  private readonly debugMode: boolean

  constructor(options: PostHogProviderOptions) {
    if (!options.posthogClient && !options.posthogConfiguration) {
      throw new Error(`The 'posthogClient' or 'posthogConfiguration' should be given`)
    }

    if (options.posthogClient) {
      this.client = options.posthogClient
      this.evaluateLocally = options.posthogConfiguration?.evaluateLocally ?? false
      this.debugMode = options.posthogConfiguration?.debugMode ?? false
    } else if (options.posthogConfiguration) {
      const { apiKey, personalApiKey, evaluateLocally, clientOptions } = options.posthogConfiguration
      if (!apiKey) {
        throw new Error(`Missing the PostHog 'apiKey' is not given`)
      }

      if (!personalApiKey) {
        throw new Error(`Missing the PostHog 'personalApiKey' is not given`)
      }

      this.evaluateLocally = evaluateLocally ?? false
      this.debugMode = options.posthogConfiguration?.debugMode ?? false

      this.client = new PostHog(apiKey, this.createPosthogClientConfig(personalApiKey, clientOptions))
    } else {
      throw new Error(`Failed to intialise PostHog OpenFeature provider`)
    }

    // Enable debug mode in posthog provider to ease debugging when needed :)
    if (this.client && this.debugMode) {
      this.client.debug(true)
    }

    this.setupEventListeners()
  }

  /**
   * @private
   * Register event listerns to the PostHog client to manage the internal state
   * of the provider
   */
  private setupEventListeners() {}

  private createPosthogClientConfig(personalApiKey: string, config?: PosthogClientOptions): PostHogOptions {
    const posthogConfig = {
      personalApiKey,
      ...config,
    }
    return posthogConfig
  }

  /**
   * Determines the boolean variation of a feature flag for a context, along with information about
   * how it was calculated.
   *
   * If the flag does not evaluate to a boolean value, then the defaultValue will be returned.
   *
   * @param flagKey The unique key of the feature flag.
   * @param defaultValue The default value of the flag, to be used if the value is not available
   *   from PostHog.
   * @param context The context requesting the flag. The client will generate an analytics event to
   *   register this context with PostHog if the context does not already exist.
   * @returns A promise which will resolve to a ResolutionDetails.
   */
  async resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext,
    logger: Logger,
  ): Promise<ResolutionDetails<boolean>> {
    const details = await this.evaluate(flagKey, defaultValue, context, logger)
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
   *   from PostHog.
   * @param context The context requesting the flag. The client will generate an analytics event to
   *   register this context with PostHog if the context does not already exist.
   * @returns A promise which will resolve to a ResolutionDetails.
   */
  async resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext,
    logger: Logger,
  ): Promise<ResolutionDetails<string>> {
    const details = await this.evaluate(flagKey, defaultValue, context, logger)
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
   *   from PostHog.
   * @param context The context requesting the flag. The client will generate an analytics event to
   *   register this context with PostHog if the context does not already exist.
   * @returns A promise which will resolve to a ResolutionDetails.
   */
  async resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    context: EvaluationContext,
    logger: Logger,
  ): Promise<ResolutionDetails<number>> {
    const details = await this.evaluate(flagKey, defaultValue, context, logger)
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
   *   from PostHog.
   * @param context The context requesting the flag. The client will generate an analytics event to
   *   register this context with PostHog if the context does not already exist.
   * @returns A promise which will resolve to a ResolutionDetails.
   */
  async resolveObjectEvaluation<U extends JsonValue>(
    flagKey: string,
    defaultValue: U,
    context: EvaluationContext,
    logger: Logger,
  ): Promise<ResolutionDetails<U>> {
    const details = await this.evaluatePayload(flagKey, defaultValue as any, context, logger)

    if (typeof details.value === 'object') {
      return {
        ...details,
        value: details.value as U,
        reason: StandardResolutionReasons.TARGETING_MATCH,
      }
    } else {
      throw new TypeMismatchError(this.getFlagTypeErrorMessage(flagKey, details.value, 'object'))
    }
  }

  /**
   * @internal
   * Retrieves the payload of the feature flag
   */
  private async evaluatePayload(
    flagKey: string,
    defaultValue: any,
    context: EvaluationContext,
    logger: Logger,
  ): Promise<ResolutionDetails<JsonValue>> {
    const translatedContext = this.translateContext(context)

    if (!translatedContext.targetingKey) {
      if (typeof (translatedContext as any).distinctId !== 'undefined') {
        logger.warn(
          `You are mixing 'targetingKey' and 'distinctId' fields in the evaluation context. Please avoid using 'distinctId'.`,
        )
      }

      return {
        value: defaultValue,
        errorCode: ErrorCode.GENERAL,
        reason: FlagError.MISSING_DISTINCT_ID,
      }
    }

    try {
      const flagContext: {
        groups?: Record<string, string>
        groupProperties?: Record<string, Record<string, string>>
        personProperties?: Record<string, string>
      } = {}
      if (translatedContext.groups) {
        flagContext.groups = translatedContext.groups
      }
      if (translatedContext.context?.personProperties) {
        flagContext.personProperties = translatedContext.context.personProperties
      }
      if (translatedContext.context?.groupProperties) {
        flagContext.groupProperties = translatedContext.context.groupProperties
      }

      const flagConfig = {
        onlyEvaluateLocally: this.evaluateLocally,
        sendFeatureFlagEvents: true,
        ...flagContext,
      }
      const flagResult = await this.client.getFeatureFlag(flagKey, translatedContext.targetingKey, flagConfig)

      const flagPayloadResult = await this.client.getFeatureFlagPayload(
        flagKey,
        translatedContext.targetingKey,
        undefined,
        flagConfig,
      )

      // If the flagResult is undefined,meaning the flag doesn't exist or failed
      if (typeof flagResult === 'undefined') {
        return {
          value: defaultValue,
          reason: StandardResolutionReasons.DEFAULT,
          errorCode: ErrorCode.FLAG_NOT_FOUND,
        }
      }

      return {
        value: flagPayloadResult as JsonValue,
        reason: StandardResolutionReasons.TARGETING_MATCH,
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
   * @internal
   * Returns the value of the given feature flag
   * @param flagKey the unique name of the feature flag
   * @param PosthogInfo the user identifier
   * @returns ResolutionDetails
   */
  private async evaluate(
    flagKey: string,
    defaultValue: any,
    context: EvaluationContext,
    logger: Logger,
  ): Promise<ResolutionDetails<boolean | string | number>> {
    const translatedContext = this.translateContext(context)

    if (!translatedContext.targetingKey) {
      if (typeof (translatedContext as any).distinctId !== 'undefined') {
        logger.warn(
          `You are mixing 'targetingKey' and 'distinctId' fields in the evaluation context. Please avoid using 'distinctId'.`,
        )
      }

      return {
        value: defaultValue,
        errorCode: ErrorCode.GENERAL,
        reason: FlagError.MISSING_DISTINCT_ID,
      }
    }

    try {
      const flagContext: {
        groups?: Record<string, string>
        groupProperties?: Record<string, Record<string, string>>
        personProperties?: Record<string, string>
      } = {}
      if (translatedContext.groups) {
        flagContext.groups = translatedContext.groups
      }
      if (translatedContext.context?.personProperties) {
        flagContext.personProperties = translatedContext.context.personProperties
      }
      if (translatedContext.context?.groupProperties) {
        flagContext.groupProperties = translatedContext.context.groupProperties
      }

      const flagConfig = {
        onlyEvaluateLocally: this.evaluateLocally,
        sendFeatureFlagEvents: true,
        ...flagContext,
      }
      const flagResult = await this.client.getFeatureFlag(flagKey, translatedContext.targetingKey, flagConfig)

      // If the flagResult is undefined,meaning the flag doesn't exist or failed
      if (typeof flagResult === 'undefined') {
        return {
          value: defaultValue,
          reason: StandardResolutionReasons.DEFAULT,
          errorCode: ErrorCode.FLAG_NOT_FOUND,
        }
      }

      return {
        value: flagResult,
        reason: StandardResolutionReasons.TARGETING_MATCH,
      }
    } catch (err: unknown) {
      return {
        value: defaultValue,
        reason: StandardResolutionReasons.ERROR,
        errorCode: ErrorCode.GENERAL,
      }
    }
  }

  private validateSchema(object: any): boolean {
    if (Array.isArray(object)) {
      return false
    }

    return Object.values(object as object).every(x => {
      if (typeof x === 'object') {
        return this.validateSchema(x)
      } else {
        return typeof x === 'string'
      }
    })
  }

  /**
   * @protected
   */
  private translateContext(evalContext: PosthogInfo): PosthogInfo {
    const { targetingKey, groups, context } = evalContext

    if (groups) {
      const isGroupsValid = this.validateSchema(groups)
      if (!isGroupsValid) {
        throw new Error(`An invalid evaluation context value was given for 'groups'`)
      }
    }

    if (context && context.personProperties) {
      const isValid = this.validateSchema(context.personProperties)
      if (!isValid) {
        throw new Error(`An invalid evaluation context value was given for 'context.personProperties'`)
      }
    }

    if (context && context.groupProperties) {
      const isValid = this.validateSchema(context.groupProperties)
      if (!isValid) {
        throw new Error(`An invalid evaluation context value was given for 'context.groupProperties'`)
      }
    }

    return {
      targetingKey,
      ...(groups ? { groups: groups as any } : {}),
      context: {
        ...(context?.groupProperties ? { groupProperties: context.groupProperties } : {}),
        ...(context?.personProperties ? { personProperties: context.personProperties } : {}),
      },
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
   * @inheritdoc
   */
  async onClose?(): Promise<void> {
    if (this.client) {
      await this.client.shutdown()
    }
  }

  /**
   * @inheritDoc
   */
  get hooks(): Hook[] {
    return []
  }
}
