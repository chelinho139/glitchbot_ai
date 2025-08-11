#!/usr/bin/env node
// ATH (All-Time High) price in USD for a Virtuals agent token, computed by
// joining per-trade GLITCH price (denominated in VIRTUAL) with CryptoCompare
// daily close price for VIRTUAL/USD.

const fs = require("node:fs/promises");
const path = require("node:path");

const FSYM = "VIRTUAL"; // Virtuals Protocol on CryptoCompare
const TSYM = "USD";
const BASE = "https://min-api.cryptocompare.com/data/v2/histoday";
const API_KEY = process.env.CRYPTOCOMPARE_API_KEY || "";
const MAX_RETRIES = 5;
const LIMIT_PER_CALL = 2000; // CryptoCompare histoday max

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJSON(url) {
  let attempt = 0,
    lastErr;
  while (attempt <= MAX_RETRIES) {
    try {
      const res = await fetch(url, {
        headers: API_KEY ? { authorization: `Apikey ${API_KEY}` } : {},
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText} — ${txt}`);
      }
      const json = await res.json();
      if (json?.Response === "Error")
        throw new Error(json?.Message || "CryptoCompare error");
      return json;
    } catch (e) {
      lastErr = e;
      if (attempt === MAX_RETRIES) break;
      await sleep(1000 * Math.pow(2, attempt)); // backoff: 1s,2s,4s,8s,16s
      attempt++;
    }
  }
  throw lastErr;
}

function dayUTC(tsSec) {
  const d = new Date(tsSec * 1000);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function asCsvRow(values) {
  return values
    .map((v) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(",");
}

async function fetchDailySeriesPaginated(minTs, maxTs) {
  // Walk backward in 2000-day pages until we reach minTs.
  let toTs = Math.floor(maxTs);
  const all = [];
  console.log(
    `Fetching daily ${FSYM}/${TSYM} prices in pages (toTs starting ${toTs})…`
  );
  while (true) {
    const url = `${BASE}?fsym=${FSYM}&tsym=${TSYM}&toTs=${toTs}&limit=${LIMIT_PER_CALL}`;
    console.log(url);
    const data = await fetchJSON(url);
    const rows = data?.Data?.Data || [];
    if (!rows.length) break;
    all.push(...rows);
    const earliest = rows[0]?.time ?? toTs;
    if (earliest <= minTs + 86400) break; // covered our range
    toTs = earliest - 1; // move backward
    await sleep(150); // gentle rate limiting
  }
  // Dedup & sort by time asc
  const byTime = new Map();
  for (const r of all) {
    const t = Number(r.time);
    const close = Number(r.close);
    if (Number.isFinite(t) && Number.isFinite(close)) byTime.set(t, close);
  }
  const times = [...byTime.keys()].sort((a, b) => a - b);
  return { byTime, times };
}

function buildDayCloseMap(byTime, times) {
  const map = new Map();
  for (const t of times) {
    map.set(dayUTC(t), byTime.get(t)); // close price for that UTC day
  }
  return map;
}

function findUSDForDayOrPrev(dayStr, times, dayCloseMap) {
  if (dayCloseMap.has(dayStr)) return dayCloseMap.get(dayStr);
  // pick most recent day <= trade day
  const target = Date.parse(`${dayStr}T00:00:00Z`) / 1000;
  let lo = 0,
    hi = times.length - 1,
    ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= target) {
      ans = times[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans >= 0 ? dayCloseMap.get(dayUTC(ans)) : undefined;
}

async function main() {
  const tokenAddress =
    process.argv[2] || "0xD8e4427454d8ac0adFD641FF1392694930407eA4";

  console.log(`Fetching trades for token: ${tokenAddress}`);

  // 1) Fetch trades from API
  const apiUrl = `https://vp-api.virtuals.io/vp-api/trades?tokenAddress=${tokenAddress}&limit=-1&chainID=&txSender=&cursor=&tradeSideOption=0`;
  console.log(`API URL: ${apiUrl}`);

  const parsed = await fetchJSON(apiUrl);
  const trades = parsed?.data?.Trades ?? [];
  if (!Array.isArray(trades) || trades.length === 0) {
    console.error("No trades found at data.Trades");
    process.exit(1);
  }

  // 2) Range of timestamps across trades (for price coverage)
  const tsList = trades.map((t) => Number(t.timestamp)).filter(Number.isFinite);
  const minTs = Math.min(...tsList);
  const maxTs = Math.max(...tsList);

  // 3) Fetch VIRTUAL/USD daily prices covering the trades span
  const { byTime, times } = await fetchDailySeriesPaginated(minTs, maxTs);
  if (!times.length) {
    console.error("No daily price data returned for the requested span.");
    process.exit(1);
  }
  const dayCloseMap = buildDayCloseMap(byTime, times);

  // 4) Compute per-trade USD price for the agent token and track ATH
  const header = [
    "txHash",
    "timestamp",
    "dayUTC",
    "isBuy",
    "priceVTperAgent",
    "dailyUSD(VIRTUAL)",
    "priceUSDperAgent_daily",
    "isATH",
  ];
  const outLines = [asCsvRow(header)];

  let athRecord = null; // { usdPrice, vtPrice, dayUSD, ts, day, txHash }
  let matched = 0,
    unmatched = 0;

  for (const t of trades) {
    const ts = Number(t.timestamp);
    const vtPrice = Number(t.price); // price of GLITCH in VIRTUAL per agent token
    const d = dayUTC(ts);

    const dayUSD = findUSDForDayOrPrev(d, times, dayCloseMap);
    let usdPrice = NaN;
    let isATH = false;

    if (Number.isFinite(vtPrice) && Number.isFinite(dayUSD)) {
      usdPrice = vtPrice * dayUSD; // USD per agent token on that day
      matched++;
      if (!athRecord || usdPrice > athRecord.usdPrice) {
        athRecord = {
          usdPrice,
          vtPrice,
          dayUSD,
          ts,
          day: d,
          txHash: t.txHash ?? "",
        };
        isATH = true;
      }
    } else {
      unmatched++;
    }

    outLines.push(
      asCsvRow([
        t.txHash ?? "",
        ts,
        d,
        Boolean(t.isBuy),
        Number.isFinite(vtPrice) ? vtPrice : "",
        Number.isFinite(dayUSD) ? dayUSD : "",
        Number.isFinite(usdPrice) ? usdPrice : "",
        isATH,
      ])
    );
  }

  // 5) Write CSV & summary
  const outPath = path.resolve("enriched_trades_ath_cc.csv");
  await fs.writeFile(outPath, outLines.join("\n"), "utf8");

  console.log("Done.");
  console.log(`Token Address: ${tokenAddress}`);
  console.log(`Trades: ${trades.length}`);
  console.log(`Matched with DAILY price: ${matched}`);
  if (unmatched)
    console.log(`Unmatched (no price for or before day): ${unmatched}`);
  console.log(`Wrote: ${outPath}`);

  if (athRecord) {
    const when = new Date(athRecord.ts * 1000).toISOString();
    console.log(
      `\nATH USD PRICE (daily-price estimate): ${athRecord.usdPrice.toFixed(
        6
      )} USD\n` +
        `- Day: ${athRecord.day} (approx ${when})\n` +
        `- GLITCH price in VIRTUAL: ${athRecord.vtPrice}\n` +
        `- VIRTUAL/USD daily close used: ${athRecord.dayUSD}\n` +
        `- txHash: ${athRecord.txHash}\n`
    );
  } else {
    console.log("\nNo ATH computed (insufficient price data).\n");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
