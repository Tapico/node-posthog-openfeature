import { OpenFeature } from '@openfeature/js-sdk'
import { PostHogProvider, OpenTelemetryHook, LoggingHook, ContextHook } from '../src/index.js'

OpenFeature.addHooks(new LoggingHook(), new OpenTelemetryHook('service-name'), new ContextHook())

async function start() {
  const targetingKey = '1d52644f-92e5-4f5a-a8c0-ed591488360b'

  OpenFeature.setProvider(
    new PostHogProvider({
      posthogConfiguration: {
        apiKey: process.env.POSTHOG_API_KEY,
        personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY,
        evaluateLocally: true,
        clientOptions: {
          sendFeatureFlagEvent: true,
        },
      },
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

  const booleanResultDetails2 = await client.getBooleanDetails('dummy2', true, {
    targetingKey,
    groups: { 'account-servicer': '123456789' },
    personalProperties: {
      email: 'jose@mailbox.com',
    },
    groupProperties: {
      name: 'José',
    },
  })
  console.log(`\nbooleanResultDetails2:`, booleanResultDetails2)
}

await start()

export {}
