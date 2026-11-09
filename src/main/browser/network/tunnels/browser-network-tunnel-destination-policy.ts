import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from 'node:dns'
import { BlockList, isIP } from 'node:net'
import { networkInterfaces } from 'node:os'

/** Host-side escape hatch: `1` restores the unrestricted pre-policy behavior. */
export const BROWSER_TUNNEL_ALLOW_ALL_DESTINATIONS_ENV =
  'ORCA_BROWSER_TUNNEL_ALLOW_ALL_DESTINATIONS'
export const BROWSER_TUNNEL_DESTINATION_BLOCKED = 'destination_blocked'

export type BrowserTunnelDestinationBlockReason = 'link_local' | 'orca_listener'

export class BrowserTunnelDestinationBlockedError extends Error {
  constructor(readonly reason: BrowserTunnelDestinationBlockReason) {
    super(BROWSER_TUNNEL_DESTINATION_BLOCKED)
  }
}

export function browserTunnelDestinationFailureCode(error: unknown, fallback: string): string {
  return error instanceof BrowserTunnelDestinationBlockedError
    ? BROWSER_TUNNEL_DESTINATION_BLOCKED
    : fallback
}

// Link-local and cloud metadata never back a browsable page; mapped/NAT64/6to4 forms embed the same IPv4.
const LINK_LOCAL_RULES: readonly BlockRule[] = [
  ['169.254.0.0', 16, 'ipv4'],
  ['::ffff:169.254.0.0', 112, 'ipv6'],
  ['64:ff9b::a9fe:0', 112, 'ipv6'],
  ['2002:a9fe::', 32, 'ipv6'],
  ['fe80::', 10, 'ipv6'],
  ['fd00:ec2::254', 128, 'ipv6'],
  ['100.100.100.200', 32, 'ipv4'],
  ['::ffff:100.100.100.200', 128, 'ipv6']
]

const METADATA_HOSTNAMES = new Set(['metadata', 'metadata.google.internal', 'metadata.goog'])

// Unspecified addresses dial the host itself, so they count as self for Orca's own listeners.
const SELF_RULES: readonly BlockRule[] = [
  ['127.0.0.0', 8, 'ipv4'],
  ['::ffff:127.0.0.0', 104, 'ipv6'],
  ['::1', 128, 'ipv6'],
  ['0.0.0.0', 32, 'ipv4'],
  ['::', 128, 'ipv6'],
  ['::ffff:0.0.0.0', 128, 'ipv6']
]

type BlockRule = [address: string, prefix: number, type: 'ipv4' | 'ipv6']

function buildBlockList(rules: readonly BlockRule[]): BlockList {
  const list = new BlockList()
  for (const [address, prefix, type] of rules) {
    list.addSubnet(address, prefix, type)
  }
  return list
}

// Built on first use so modules that only import a port reservation never construct BlockLists.
let linkLocalAddresses: BlockList | null = null
let selfAddresses: BlockList | null = null

const orcaListenerPorts = new Map<number, number>()

/** Marks a host port as an Orca control/proxy listener that paired browser tunnels must not reach. */
export function reserveBrowserTunnelOrcaListenerPort(port: number): () => void {
  orcaListenerPorts.set(port, (orcaListenerPorts.get(port) ?? 0) + 1)
  let released = false
  return () => {
    if (released) {
      return
    }
    released = true
    const count = (orcaListenerPorts.get(port) ?? 1) - 1
    if (count <= 0) {
      orcaListenerPorts.delete(port)
    } else {
      orcaListenerPorts.set(port, count)
    }
  }
}

export function isBrowserTunnelPolicyDisabled(env: Record<string, string | undefined>): boolean {
  return env[BROWSER_TUNNEL_ALLOW_ALL_DESTINATIONS_ENV] === '1'
}

export function browserTunnelAddressBlockReason(
  address: string,
  port: number
): BrowserTunnelDestinationBlockReason | null {
  const family = isIP(address)
  if (family === 0) {
    return null
  }
  const type = family === 4 ? 'ipv4' : 'ipv6'
  if ((linkLocalAddresses ??= buildBlockList(LINK_LOCAL_RULES)).check(address, type)) {
    return 'link_local'
  }
  if (orcaListenerPorts.has(port) && isHostOwnAddress(address, type)) {
    return 'orca_listener'
  }
  return null
}

/** Checks what the client asked for; hostnames are re-checked after resolution on direct dials. */
export function browserTunnelTargetBlockReason(
  host: string,
  port: number
): BrowserTunnelDestinationBlockReason | null {
  const normalized = host.toLowerCase().replace(/\.$/, '')
  if (METADATA_HOSTNAMES.has(normalized)) {
    return 'link_local'
  }
  if (
    orcaListenerPorts.has(port) &&
    (normalized === 'localhost' || normalized.endsWith('.localhost'))
  ) {
    return 'orca_listener'
  }
  return browserTunnelAddressBlockReason(host, port)
}

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number
) => void

type BrowserTunnelResolver = (
  hostname: string,
  options: LookupOptions,
  callback: (error: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void
) => void

/** net.connect lookup that drops blocked answers, so DNS rebinding cannot bypass the check. */
export function createBrowserTunnelGuardedLookup(
  port: number,
  onBlocked: (reason: BrowserTunnelDestinationBlockReason) => void,
  resolve: BrowserTunnelResolver = (hostname, options, callback) =>
    dnsLookup(hostname, { ...options, all: true }, callback)
) {
  return (hostname: string, options: LookupOptions, callback: LookupCallback): void => {
    resolve(hostname, options, (error, addresses) => {
      if (error) {
        callback(error, options.all ? [] : '')
        return
      }
      let blockedReason: BrowserTunnelDestinationBlockReason | null = null
      const allowed = addresses.filter((entry) => {
        const reason = browserTunnelAddressBlockReason(entry.address, port)
        blockedReason ??= reason
        return reason === null
      })
      if (allowed.length === 0) {
        const reason = blockedReason ?? 'link_local'
        onBlocked(reason)
        callback(new BrowserTunnelDestinationBlockedError(reason), options.all ? [] : '')
        return
      }
      if (options.all) {
        callback(null, allowed)
        return
      }
      callback(null, allowed[0]!.address, allowed[0]!.family)
    })
  }
}

function isHostOwnAddress(address: string, type: 'ipv4' | 'ipv6'): boolean {
  if ((selfAddresses ??= buildBlockList(SELF_RULES)).check(address, type)) {
    return true
  }
  // Only reached for reserved ports, so enumerating interfaces stays off the common dial path.
  const own = new BlockList()
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      own.addAddress(entry.address.replace(/%.*$/, ''), entry.family === 'IPv4' ? 'ipv4' : 'ipv6')
    }
  }
  return own.check(address, type)
}

const AUDIT_WINDOW_MS = 60_000
const AUDIT_MAX_PER_WINDOW = 20
let auditWindowStart = 0
let auditCount = 0

export function auditBrowserTunnelDestinationBlocked(
  host: string,
  port: number,
  reason: BrowserTunnelDestinationBlockReason,
  now: number = Date.now()
): void {
  if (now - auditWindowStart >= AUDIT_WINDOW_MS) {
    auditWindowStart = now
    auditCount = 0
  }
  auditCount += 1
  if (auditCount > AUDIT_MAX_PER_WINDOW) {
    return
  }
  console.warn(
    `[browser-tunnel] Blocked paired browser connection to ${host}:${port} (${reason}); set ${BROWSER_TUNNEL_ALLOW_ALL_DESTINATIONS_ENV}=1 on this host to allow.`
  )
}
