import { OpenFeature } from '@openfeature/nodejs-sdk'
import { PostHogProvider, OpenTelemetryHook, LoggingHook, ContextHook } from '../src'

OpenFeature.addHooks(
  // new LoggingHook(),
  // new OpenTelemetryHook('service-name'),
  // new ContextHook()
)

async function start() {
  const targetingKey = '1d52644f-92e5-4f5a-a8c0-ed591488360b'

  OpenFeature.setProvider(
    new PostHogProvider({
      apiKey: process.env.POSTHOG_API_KEY,
      personalApiKey: process.env.POSTHOG_API_KEY,
      // apiKey: process.env.POSTHOG_API_KEY,
      // personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY,
      config: {
        decidePollInterval: 0,
        preloadFeatureFlags: true,
        sendFeatureFlagEvent: true,
      }
    }),
  )
  const client = OpenFeature.getClient('posthog', '1.0.0', {
    'service-name': 'openfeature-posthog-example',
  })

  const booleanResult = await client.getBooleanValue(
    'dummy',
    false,
    {
      targetingKey,
    },
    {
      hookHints: {
        ignoreData: true,
      },
    },
  )
  console.log(`\nbooleanResult:`, booleanResult)

  const booleanResultDetails = await client.getBooleanDetails('dummy', true, {
    targetingKey,
  })
  console.log(`\n\nbooleanResultDetails:`, booleanResultDetails)

  const stringVariant = await client.getStringDetails('dummy2', 'missing-variant', {
    targetingKey,
  })
  console.log(`\n\nstringResultDetails:`, stringVariant)
}

await start()

export {}
