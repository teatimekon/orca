// Why: this fork is built and deployed locally; the official feed would replace it with upstream, so updater/nudge/changelog network paths stay off. Build-time, not env: Finder launches have no shell env.
export const SELF_BUILT_BUILD = true
