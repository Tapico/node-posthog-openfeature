import { ErrorCode, OpenFeature } from '@openfeature/server-sdk'
import { PostHog } from 'posthog-node'
import { PostHogProvider } from '../provider'
import type { Client } from '@openfeature/server-sdk'

jest.mock('posthog-node')

describe('PostHogProvider', () => {
  describe('Provider', () => {
    const provider = new PostHogProvider({
      posthogConfiguration: {
        apiKey: 'api-key',
        personalApiKey: 'personal-api-key',
        evaluateLocally: true,
      },
    })

    beforeAll(() => {
      OpenFeature.setProvider(provider)
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    let client: Client
    test('should be able to get PostHog client', () => {
      client = OpenFeature.getClient('posthog', '1.0.0')
      expect(client).toBeDefined()
      expect(client.metadata.name).toBe('posthog')
      expect(client.metadata.version).toBe('1.0.0')
      expect(OpenFeature.providerMetadata.name).toBe('posthog-provider')
    })
  })

  describe('Provider with provided PostHog instance', () => {
    const posthogClient = new PostHog('api-key', {
      personalApiKey: 'personal-api-key',
      sendFeatureFlagEvent: true,
    })

    const provider = new PostHogProvider({
      posthogClient,
    })

    beforeAll(() => {
      OpenFeature.setProvider(provider)
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    let client: Client
    test('should be able to get PostHog client', () => {
      client = OpenFeature.getClient('posthog', '1.0.0')
      expect(client).toBeDefined()
      expect(client.metadata.name).toBe('posthog')
      expect(client.metadata.version).toBe('1.0.0')
      expect(OpenFeature.providerMetadata.name).toBe('posthog-provider')
    })

    test("should return resolution result with default value when PostHog returns 'undefined'", async () => {
      const mockFeatureFlag = jest.spyOn(posthogClient, 'getFeatureFlag').mockResolvedValueOnce(undefined)

      client = OpenFeature.getClient('posthog', '1.0.0')

      const evaluatedFlagResult = await client.getBooleanDetails('dummy2', false, {
        targetingKey: 'targeting-key',
      })

      expect(mockFeatureFlag).toHaveBeenCalledTimes(1)
      expect(evaluatedFlagResult).toBeDefined()
      expect(evaluatedFlagResult.flagKey).toBe('dummy2')
      expect(evaluatedFlagResult.errorCode).toBe(ErrorCode.FLAG_NOT_FOUND)
      expect(evaluatedFlagResult.value).toBe(false)
    })

    test("should return resolution result with flag value when PostHog returns 'false'", async () => {
      const mockFeatureFlag = jest.spyOn(posthogClient, 'getFeatureFlag').mockResolvedValueOnce(true)

      client = OpenFeature.getClient('posthog', '1.0.0')

      const evaluatedFlagResult = await client.getBooleanDetails('dummy2', true, {
        targetingKey: 'targeting-key',
      })

      expect(mockFeatureFlag).toHaveBeenCalledTimes(1)
      expect(evaluatedFlagResult).toBeDefined()
      expect(evaluatedFlagResult.flagKey).toBe('dummy2')
      expect(evaluatedFlagResult.errorCode).toBeUndefined()
      expect(evaluatedFlagResult.value).toBe(true)
    })

    test("should return resolution result with flag value when PostHog returns 'true'", async () => {
      const mockFeatureFlag = jest.spyOn(posthogClient, 'getFeatureFlag').mockResolvedValueOnce(false)

      client = OpenFeature.getClient('posthog', '1.0.0')

      const evaluatedFlagResult = await client.getBooleanDetails('dummy2', true, {
        targetingKey: 'targeting-key',
      })

      expect(mockFeatureFlag).toHaveBeenCalledTimes(1)
      expect(evaluatedFlagResult).toBeDefined()
      expect(evaluatedFlagResult.flagKey).toBe('dummy2')
      expect(evaluatedFlagResult.errorCode).toBeUndefined()
      expect(evaluatedFlagResult.value).toBe(false)
    })

    test('should pass groups to PostHog when defined in evalation context', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const mockFeatureFlag = jest.spyOn(posthogClient, 'getFeatureFlag').mockImplementationOnce((..._args: any[]) => {
        return Promise.resolve(false)
      })

      client = OpenFeature.getClient('posthog', '1.0.0')

      const evaluatedFlagResult = await client.getBooleanDetails('dummy2', true, {
        targetingKey: 'targeting-key',
        groups: { group1: 'hello' },
      })

      expect(mockFeatureFlag).toHaveBeenCalledTimes(1)
      expect(mockFeatureFlag).toHaveBeenCalledWith(
        'dummy2',
        'targeting-key',
        expect.objectContaining({ groups: { group1: 'hello' } }),
      )
      expect(evaluatedFlagResult).toBeDefined()
      expect(evaluatedFlagResult.flagKey).toBe('dummy2')
      expect(evaluatedFlagResult.errorCode).toBeUndefined()
      expect(evaluatedFlagResult.value).toBe(false)
    })

    test('should pass personalProperties to PostHog when defined in evalation context', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const mockFeatureFlag = jest.spyOn(posthogClient, 'getFeatureFlag').mockImplementationOnce((..._args: any[]) => {
        return Promise.resolve(false)
      })

      client = OpenFeature.getClient('posthog', '1.0.0')

      const evaluatedFlagResult = await client.getBooleanDetails('dummy2', true, {
        targetingKey: 'targeting-key',
        context: {
          personProperties: {
            userId: 'developer',
          },
        },
      })

      expect(mockFeatureFlag).toHaveBeenCalledTimes(1)
      expect(mockFeatureFlag).toHaveBeenCalledWith(
        'dummy2',
        'targeting-key',
        expect.objectContaining({ personProperties: { userId: 'developer' } }),
      )
      expect(evaluatedFlagResult).toBeDefined()
      expect(evaluatedFlagResult.flagKey).toBe('dummy2')
      expect(evaluatedFlagResult.errorCode).toBeUndefined()
      expect(evaluatedFlagResult.value).toBe(false)
    })

    test('should pass groupProperties to PostHog when defined in evalation context', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const mockFeatureFlag = jest.spyOn(posthogClient, 'getFeatureFlag').mockImplementationOnce((..._args: any[]) => {
        return Promise.resolve(false)
      })

      client = OpenFeature.getClient('posthog', '1.0.0')

      const evaluatedFlagResult = await client.getBooleanDetails('dummy2', true, {
        targetingKey: 'targeting-key',
        context: {
          groupProperties: {
            userId: 'developer',
          },
        },
      })

      expect(mockFeatureFlag).toHaveBeenCalledTimes(1)
      expect(mockFeatureFlag).toHaveBeenCalledWith(
        'dummy2',
        'targeting-key',
        expect.objectContaining({ groupProperties: { userId: 'developer' } }),
      )
      expect(evaluatedFlagResult).toBeDefined()
      expect(evaluatedFlagResult.flagKey).toBe('dummy2')
      expect(evaluatedFlagResult.errorCode).toBeUndefined()
      expect(evaluatedFlagResult.value).toBe(false)
    })

    test('should be able to retrieve JSON feature flag value', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const mockFeatureFlag = jest.spyOn(posthogClient, 'getFeatureFlag').mockImplementationOnce((..._args: any[]) => {
        return Promise.resolve(true)
      })
      const mockFeatureFlagPayload = jest
        .spyOn(posthogClient, 'getFeatureFlagPayload')
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .mockImplementationOnce((..._args: any[]) => {
          return Promise.resolve({ mocked: 'feature-flag-value' })
        })

      client = OpenFeature.getClient('posthog', '1.0.0')

      const evaluatedFlagResult = await client.getObjectDetails(
        'dummy5',
        { payload: 'from-unit-test' },
        {
          targetingKey: 'service',
        },
      )

      expect(mockFeatureFlag).toHaveBeenCalledTimes(1)
      expect(mockFeatureFlag).toHaveBeenCalledWith('dummy5', 'service', expect.objectContaining({}))
      expect(mockFeatureFlagPayload).toHaveBeenCalledTimes(1)
      expect(evaluatedFlagResult).toBeDefined()
      expect(evaluatedFlagResult.flagKey).toBe('dummy5')
      expect(evaluatedFlagResult.errorCode).toBeUndefined()
      expect(evaluatedFlagResult.value).toStrictEqual(expect.objectContaining({ mocked: 'feature-flag-value' }))
    })
  })
})
