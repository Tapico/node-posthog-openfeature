import { Client, OpenFeature } from '@openfeature/nodejs-sdk'
import { PostHogProvider } from '../provider'

jest.mock('posthog-node')

const provider = new PostHogProvider({
  apiKey: 'api-key',
  personalApiKey: 'personal-api-key',
})

describe('PostHogProvider', () => {
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
    expect(OpenFeature.providerMetadata.name).toBe('PostHog Provider')
  })
})
