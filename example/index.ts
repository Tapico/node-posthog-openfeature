import { OpenFeature } from '@openfeature/server-sdk'
import { PostHogProvider, OpenTelemetryHook, LoggingHook } from '../src/index.js'

OpenFeature.addHooks(new LoggingHook(), new OpenTelemetryHook('service-name'))

async function start() {
  const targetingKey = '1d52644f-92e5-4f5a-a8c0-ed591488360b'

  OpenFeature.setProvider(
    new PostHogProvider({
      posthogConfiguration: {
        apiKey: process.env.POSTHOG_API_KEY,
        personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY,
        evaluateLocally: false,
        debugMode: true,
        clientOptions: {
          sendFeatureFlagEvent: true,
        },
      },
    }),
  )
  const client = OpenFeature.getClient('posthog', '1.0.0')

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

  const groupAnalyticsTestCaseDetails = await client.getStringDetails('dummy2', 'variant-1', {
    targetingKey,
    personalProperties: {
      email: 'jose@mailbox.com',
    },
    groups: { 'account-servicer': '4894330b-8941-45fb-9546-0bdab8400ac8' },
    groupProperties: {
      name: 'José',
    },
  })
  console.log(`\nbooleanResultDetails2:`, groupAnalyticsTestCaseDetails)
  if (groupAnalyticsTestCaseDetails.value !== 'variant-2') {
    console.log(`FAILED TO MATCH GROUP-BASED FEATURE FLAGS`)
  }

  //
  const payloadDefaultValue = { payload: 'fallback-value' }
  const multiVariantPayloadDetails = await client.getObjectDetails('dummy5', payloadDefaultValue, {
    targetingKey: 'c3bf042d-2a54-4d44-a899-17ab2e9f66a2',
  })
  console.log(`multiVariantPayloadDetails:`, multiVariantPayloadDetails)
}

await start()

export {}
