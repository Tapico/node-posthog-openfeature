import { Client, OpenFeature, StandardResolutionReasons } from '@openfeature/js-sdk'
import { PostHog } from 'posthog-node'
import { PostHogProvider } from '../provider'

jest.mock('posthog-node')

describe('PostHogProvider', () => {
  describe('Provider', () => {
    const provider = new PostHogProvider({
      posthogConfiguration: {
        apiKey: 'api-key',
        personalApiKey: 'personal-api-key',
        evaluateLocally: true,
      }
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
      posthogClient: posthogClient,
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

    test('should return resolution result indicating flag does not exist', async () => {
      if (!client) {
        client = OpenFeature.getClient('posthog', '1.0.0')
      }

      const evaluatedFlagResult = await client.getBooleanDetails('feature-flag', true, { targetingKey: 'distinct-id' }, {
        hookHints: {
          'hintInfo': 'information'
        }
      })
      expect(evaluatedFlagResult.flagKey).toBe('feature-flag')
      expect(evaluatedFlagResult.reason).toBe(StandardResolutionReasons.DEFAULT)
      expect(evaluatedFlagResult.value).toBe(true)
    })
  })
})
