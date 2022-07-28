import type { FlagValue, Hook, HookContext, HookHints, ResolutionDetails } from '@openfeature/nodejs-sdk'
import { EOL } from 'node:os'

/**
 * A hook that adds standard Logging data.
 */
export class LoggingHook implements Hook {
  readonly name = 'logging'

  constructor() {}

  before(hookContext: HookContext, _hookHints: HookHints) {
    // console.log(`Running 'before' logger hook for flag: ${hookContext.flagKey}`)
    // console.log(JSON.stringify(hookContext.context, undefined, 2))
  }

  after(hookContext: HookContext, details: ResolutionDetails<FlagValue>, _hookHints: HookHints) {
    // console.log(`Running 'after' logger hook for flag: ${hookContext.flagKey}`)
    // console.log(`Evaluation details:${EOL}${JSON.stringify(details, undefined, 2)}`)
  }

  finally(hookContext: HookContext, _hookHints: HookHints) {
    // console.log(`Running 'finally' logger hook for flag: ${hookContext.flagKey}`)
  }

  error(hookContext: HookContext, error: Error, _hookHints: HookHints) {
    // console.log(`Running 'error' logger hook for flag: ${hookContext.flagKey}`)
    // console.error(error)
  }
}
