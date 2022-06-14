import type { FlagValue, Hook, HookContext, HookHints, ResolutionDetails } from '@openfeature/nodejs-sdk'

/**
 * A hook that injects feature flag information in
 * the request context
 */
export class ContextHook implements Hook {
  readonly name = 'request-context'

  constructor() {}

  before(_hookContext: HookContext, _hookHints: HookHints) {}

  after(_hookContext: HookContext, _flagValue: ResolutionDetails<FlagValue>, _hookHints: HookHints) {}

  finally(_hookContext: HookContext, _hookHints: HookHints) {}

  error(_hookContext: HookContext, _error: Error, _hookHints: HookHints) {}
}
