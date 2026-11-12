// Keeps the apex domain's A/AAAA records pointing at the CDN nodes its CNAME target resolves to.
//
// The apex can't hold a CNAME next to its MX and TXT records, so this does the "CNAME
// flattening" a paid DNS plan would: for every DNSPod resolution line it asks public DoH
// resolvers for the target, passing an EDNS Client Subnet of that line's network in Shanghai
// (or abroad, for the default line) so the CDN picks a node for those visitors, then writes
// that node as a plain record on the line. Records of other types (MX, TXT, ...) are never
// touched.
//
//   DNSPOD_SECRET_ID=… DNSPOD_SECRET_KEY=… node scripts/dns/flatten-apex.mjs [--dry-run]
//
// Optional: APEX_DOMAIN (default leekarl.com); APEX_TARGETS, comma-separated names whose
// nodes to use, tried in order (default: the apex's own EdgeOne Makers CNAME target, then
// www's, since the nodes route by Host and serve either name); DNSPOD_SESSION_TOKEN when
// the key pair is temporary.
import { createHash, createHmac } from 'node:crypto';
import { isIP } from 'node:net';

const DOMAIN = process.env.APEX_DOMAIN ?? 'leekarl.com';
const TARGETS = (process.env.APEX_TARGETS ?? `${DOMAIN}.pages.dnsoe4.com,www.${DOMAIN}.pages.dnsoe5.com`).split(',');
const TTL = 600;
// Records of one type a line may hold at once ("负载均衡数量"; 2 on DNSPod's free plan).
// Each line publishes one node, so the spare slot lets a swap add before it removes.
const PLAN_LIMIT = Number(process.env.DNSPOD_MAX_PER_LINE ?? 2);
const DRY_RUN = process.argv.includes('--dry-run');

// DNSPod line → a Shanghai client subnet of that network (abroad for "默认").
// More specific lines win in DNSPod, so "境内" only catches mainland networks not listed
// (it follows China Telecom), and "默认" serves everyone else.
const TELECOM = '202.96.209.0/24';
const LINES = [
  { line: '电信', subnet: TELECOM },
  { line: '联通', subnet: '210.22.70.0/24' },
  { line: '移动', subnet: '211.136.112.0/24' },
  { line: '教育网', subnet: '202.120.2.0/24' },
  { line: '境内', subnet: TELECOM },
  { line: '默认', subnet: '8.8.8.0/24' },
];

const RESOLVERS = [
  (name, type, subnet) => `https://dns.google/resolve?name=${name}&type=${type}&edns_client_subnet=${subnet}`,
  (name, type, subnet) => `https://dns.alidns.com/resolve?name=${name}&type=${type === 'A' ? 1 : 28}&edns_client_subnet=${subnet}`,
];

/**
 * The target's addresses of one type as seen from `subnet`, in the CDN's order (empty when
 * the name has none of that type), or null when no resolver gave a usable answer.
 */
async function resolve(type, subnet) {
  // Lines sharing subnets must agree within a run, and the CDN's answers vary between queries.
  const key = `${type} ${subnet}`;
  if (!resolved.has(key)) {
    resolved.set(key, (async () => {
      for (const target of TARGETS) {
        const ips = await resolveName(target, type, subnet);
        if (ips !== null) return ips;
      }
      return null;
    })());
  }
  return resolved.get(key);
}
const resolved = new Map();

async function resolveName(name, type, subnet) {
  const code = type === 'A' ? 1 : 28;
  for (const url of RESOLVERS) {
    try {
      const res = await fetch(url(name, type, subnet), { headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const body = await res.json();
      if (body.Status !== 0) continue;
      const ips = (body.Answer ?? []).filter((a) => a.type === code).map((a) => a.data);
      if (!ips.every((ip) => isIP(ip) === (type === 'A' ? 4 : 6))) continue;
      // A CNAME chain that ends nowhere means the target is broken, not that it has no addresses.
      if (type === 'A' && ips.length === 0) continue;
      return [...new Set(ips)];
    } catch {
      // Try the next resolver.
    }
  }
  return null;
}

// Tencent Cloud API v3 (TC3-HMAC-SHA256) call to DNSPod.
async function dnspod(action, params) {
  const { DNSPOD_SECRET_ID: id, DNSPOD_SECRET_KEY: key } = process.env;
  const host = 'dnspod.tencentcloudapi.com';
  const body = JSON.stringify(params);
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const sha256 = (s) => createHash('sha256').update(s).digest('hex');
  const hmac = (k, s) => createHmac('sha256', k).update(s).digest();
  const canonical = ['POST', '/', '', `content-type:application/json\nhost:${host}\n`, 'content-type;host', sha256(body)].join('\n');
  const scope = `${date}/dnspod/tc3_request`;
  const toSign = ['TC3-HMAC-SHA256', timestamp, scope, sha256(canonical)].join('\n');
  const signingKey = hmac(hmac(hmac(`TC3${key}`, date), 'dnspod'), 'tc3_request');
  const signature = createHmac('sha256', signingKey).update(toSign).digest('hex');
  const res = await fetch(`https://${host}`, {
    method: 'POST',
    headers: {
      Authorization: `TC3-HMAC-SHA256 Credential=${id}/${scope}, SignedHeaders=content-type;host, Signature=${signature}`,
      'Content-Type': 'application/json',
      Host: host,
      'X-TC-Action': action,
      'X-TC-Version': '2021-03-23',
      'X-TC-Timestamp': String(timestamp),
      ...(process.env.DNSPOD_SESSION_TOKEN ? { 'X-TC-Token': process.env.DNSPOD_SESSION_TOKEN } : {}),
    },
    body,
  });
  const { Response: out } = await res.json();
  if (out.Error) {
    const err = new Error(`${action}: ${out.Error.Code} ${out.Error.Message}`);
    err.code = out.Error.Code;
    throw err;
  }
  return out;
}

async function apexRecords(type) {
  try {
    const { RecordList } = await dnspod('DescribeRecordList', { Domain: DOMAIN, Subdomain: '@', RecordType: type, Limit: 3000 });
    return RecordList;
  } catch (err) {
    if (err.code === 'ResourceNotFound.NoDataOfRecord') return [];
    throw err;
  }
}

async function main() {
  if (!DRY_RUN && (!process.env.DNSPOD_SECRET_ID || !process.env.DNSPOD_SECRET_KEY)) {
    throw new Error('DNSPOD_SECRET_ID and DNSPOD_SECRET_KEY are required (or pass --dry-run).');
  }
  let changes = 0;
  let failures = 0;
  for (const type of ['A', 'AAAA']) {
    const existing = DRY_RUN && !process.env.DNSPOD_SECRET_ID ? [] : await apexRecords(type);
    for (const { line, subnet } of LINES) {
      const ips = await resolve(type, subnet);
      if (ips === null) {
        // Leave the line alone rather than act on a failed lookup.
        console.warn(`${type} ${line}: could not resolve ${TARGETS.join(' or ')}; keeping current records`);
        failures++;
        continue;
      }
      const current = existing.filter((r) => r.Line === line);
      // The CDN rotates the order of its answers, so keep a node that is already published
      // while it's still among them; otherwise take the first.
      const pick = ips.find((ip) => current.some((r) => r.Value === ip)) ?? ips[0];
      const wanted = pick ? [pick] : [];
      const stale = current.filter((r) => !wanted.includes(r.Value));
      const missing = wanted.filter((ip) => !current.some((r) => r.Value === ip));
      console.log(`${type} ${line}: ${wanted.join(' ') || '(none)'}${stale.length || missing.length ? '' : ' (unchanged)'}`);
      if (DRY_RUN) continue;
      // Swap one record at a time, removing first only when the line is full, so it never
      // goes empty.
      let count = current.length;
      for (const ip of missing) {
        if (count >= PLAN_LIMIT) {
          const r = stale.shift();
          await dnspod('DeleteRecord', { Domain: DOMAIN, RecordId: r.RecordId });
          console.log(`  - ${r.Value}`);
          count--;
          changes++;
        }
        await dnspod('CreateRecord', { Domain: DOMAIN, SubDomain: '@', RecordType: type, RecordLine: line, Value: ip, TTL });
        console.log(`  + ${ip}`);
        count++;
        changes++;
      }
      for (const r of stale) {
        await dnspod('DeleteRecord', { Domain: DOMAIN, RecordId: r.RecordId });
        console.log(`  - ${r.Value}`);
        changes++;
      }
    }
  }
  console.log(`${changes} change(s).`);
  // Every line failing points at a broken target or resolvers, worth a red run.
  if (failures === LINES.length * 2) process.exitCode = 1;
}

await main();
