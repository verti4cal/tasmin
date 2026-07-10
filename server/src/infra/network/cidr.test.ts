import { describe, expect, it } from "vitest";
import { InvalidCidrError, parseCidrHosts } from "./cidr.js";

describe("parseCidrHosts", () => {
  it("excludes the network and broadcast addresses for a /30", () => {
    expect(parseCidrHosts("192.168.1.0/30")).toEqual(["192.168.1.1", "192.168.1.2"]);
  });

  it("returns 254 usable hosts for a /24", () => {
    const hosts = parseCidrHosts("192.168.1.0/24");
    expect(hosts).toHaveLength(254);
    expect(hosts[0]).toBe("192.168.1.1");
    expect(hosts[hosts.length - 1]).toBe("192.168.1.254");
  });

  it("normalizes a non-network-aligned address down to its subnet", () => {
    expect(parseCidrHosts("192.168.1.130/24")).toEqual(parseCidrHosts("192.168.1.0/24"));
  });

  it("treats /31 and /32 as having no network/broadcast to exclude", () => {
    expect(parseCidrHosts("192.168.1.0/31")).toEqual(["192.168.1.0", "192.168.1.1"]);
    expect(parseCidrHosts("192.168.1.5/32")).toEqual(["192.168.1.5"]);
  });

  it("rejects malformed input", () => {
    expect(() => parseCidrHosts("not-a-cidr")).toThrow(InvalidCidrError);
    expect(() => parseCidrHosts("192.168.1.0")).toThrow(InvalidCidrError);
    expect(() => parseCidrHosts("999.168.1.0/24")).toThrow(InvalidCidrError);
  });

  it("rejects prefixes broader than /16", () => {
    expect(() => parseCidrHosts("10.0.0.0/8")).toThrow(InvalidCidrError);
  });

  it("rejects subnets larger than the max host cap", () => {
    expect(() => parseCidrHosts("10.0.0.0/20")).toThrow(InvalidCidrError); // 4094 usable hosts
  });
});
