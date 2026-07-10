const MAX_HOSTS = 1024;

export class InvalidCidrError extends Error {}

/**
 * Parses an IPv4 CIDR (e.g. "192.168.1.0/24") into its usable host
 * addresses (network and broadcast excluded for /16-/30; /31 and /32 are
 * returned as-is since they have no network/broadcast concept).
 *
 * Bounded to /16-/32 and MAX_HOSTS addresses so a scan can't be pointed at
 * something absurd like a /8 by mistake.
 */
export function parseCidrHosts(cidr: string): string[] {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.exec(cidr.trim());
  if (!match) {
    throw new InvalidCidrError(`"${cidr}" is not a valid IPv4 CIDR, e.g. 192.168.1.0/24`);
  }

  const octets = match.slice(1, 5).map(Number);
  const prefix = Number(match[5]);

  if (octets.some((o) => o > 255) || prefix < 16 || prefix > 32) {
    throw new InvalidCidrError(
      `"${cidr}" must be a valid IPv4 CIDR with a /16-/32 prefix (max ${MAX_HOSTS} addresses)`,
    );
  }

  const base = ((octets[0]! << 24) | (octets[1]! << 16) | (octets[2]! << 8) | octets[3]!) >>> 0;
  const hostBits = 32 - prefix;
  const size = 2 ** hostBits;

  if (prefix >= 31) {
    return Array.from({ length: size }, (_, i) => intToIp(base + i));
  }

  const usableCount = size - 2;
  if (usableCount > MAX_HOSTS) {
    throw new InvalidCidrError(
      `"${cidr}" contains ${usableCount} addresses; max is ${MAX_HOSTS} — use a smaller subnet`,
    );
  }

  const mask = (0xffffffff << hostBits) >>> 0;
  const network = (base & mask) >>> 0;
  return Array.from({ length: usableCount }, (_, i) => intToIp(network + i + 1));
}

function intToIp(int: number): string {
  return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join(".");
}
