import { OpenFeature } from '@openfeature/nodejs-sdk'
import { PostHogProvider, OpenTelemetryHook } from '@tapico/node-openfeature'

OpenFeature.addHooks(
  //new LoggingHook(),
  new OpenTelemetryHook('service-name'),
  //new ContextHook()
)

async function start() {
  console.log(`Running Example`)
  const targetingKey = '1d52644f-92e5-4f5a-a8c0-ed591488360b'

  OpenFeature.setProvider(
    new PostHogProvider({
      apiKey: process.env.POSTHOG_API_KEY,
      personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY,
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
  console.log(`booleanResult:`, booleanResult)

  const booleanResultDetails = await client.getBooleanDetails('dummy', true, {
    targetingKey,
  })
  console.log(`booleanResultDetails:`, booleanResultDetails)

  const stringVariant = await client.getStringDetails('dummy2', 'missing-variant', {
    targetingKey,
  })
  console.log(`stringResultDetails:`, stringVariant)
}

await start()

export {}
