/* Deep Lake — hackathon prototype. All participants, quotes and balances are simulated. */
(() => {
'use strict';

// ---------- helpers ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const usd = n => '$' + Math.round(n).toLocaleString('en-US');
const usd2 = n => '$' + n.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const short = n => n >= 1e6 ? '$' + (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + 'M' : n >= 1e3 ? '$' + Math.round(n / 1e3) + 'K' : '$' + Math.round(n);
const bpsOf = (cost, amt) => amt ? (cost / amt * 1e4) : 0;
const clock = d => d.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false});
const speed = s => s < 60 ? `${s} sec` : s < 3600 ? `${Math.round(s / 60)} min` : s < 86400 ? `${Math.round(s / 3600)} hr` : 'Next business day';
const ago = m => new Date(Date.now() - m * 60000);

// ---------- network data (simulated) ----------
const ME = {id: 'lksh', name: 'Lakeshore Community Bank'};
const BANKS = [
  {id: 'lksh', name: 'Lakeshore Community Bank', type: 'Bank', token: 'tdLKSH'},
  {id: 'grnt', name: 'Granite Federal Credit Union', type: 'Credit union', token: 'tdGRNT'},
  {id: 'hrbr', name: 'Harborline Bank', type: 'Bank', token: 'tdHRBR'},
  {id: 'prsb', name: 'Prairie State Bank', type: 'Bank', token: 'tdPRSB'},
];
const ASSETS = {
  td_own:  {label: 'Tokenized deposit · Lakeshore', sym: 'tdLKSH', kind: 'td', bank: 'lksh', insured: true},
  usdc:    {label: 'Stablecoin · USDC', sym: 'USDC', kind: 'stable', insured: false},
  usdb:    {label: 'Stablecoin · USDB (bank-issued)', sym: 'USDB', kind: 'stable', insured: false},
  fiat:    {label: 'Fiat · US dollars', sym: 'USD', kind: 'fiat', insured: true},
  td_grnt: {label: 'Tokenized deposit · Granite FCU', sym: 'tdGRNT', kind: 'td', bank: 'grnt', insured: true},
  td_hrbr: {label: 'Tokenized deposit · Harborline', sym: 'tdHRBR', kind: 'td', bank: 'hrbr', insured: true},
  td_prsb: {label: 'Tokenized deposit · Prairie State', sym: 'tdPRSB', kind: 'td', bank: 'prsb', insured: true},
};
const HOLD = ['td_own', 'usdc', 'usdb', 'fiat'];
const RAILS = {
  rtp:    {name: 'RTP', cost: 0.25, secs: 5, instant: true, rule: 'Token leg releases on RTP confirmation'},
  fednow: {name: 'FedNow', cost: 0.25, secs: 5, instant: true, rule: 'Token leg releases on FedNow confirmation'},
  ach:    {name: 'ACH', cost: 0.10, secs: 86400, instant: false, rule: 'Sender pre-funds; releases when ACH settles'},
  wire:   {name: 'Fedwire', cost: 18, secs: 900, instant: false, rule: 'Sender pre-funds; releases on wire advice'},
};
const PAIRS = {
  'td-usdc': 'Tokenized deposit ↔ USDC', 'td-usdb': 'Tokenized deposit ↔ USDB',
  'usdc-fiat': 'USDC ↔ fiat', 'usdb-fiat': 'USDB ↔ fiat', 'usdc-usdb': 'USDC ↔ USDB',
};
const BOND_RATIO = 0.10, EXPOSURE_MULT = 10, SLASH_RATE = 0.0025, SLASH_MIN = 2500;
const MMS = [
  {id: 'nsm', name: 'Northshore Markets', bond: 800000, earned: 3140},
  {id: 'hly', name: 'Halyard Trading', bond: 700000, earned: 2260},
  {id: 'mrd', name: 'Meridian OTC', bond: 1400000, earned: 4875},
  {id: 'kst', name: 'Kestrel Liquidity', bond: 300000, earned: 610},
];
let chSeq = 10;
const CHANNELS = [
  {id: 'c1', mm: 'nsm', pair: 'td-usdc', bps: 1.0, cap: 4e6, avail: 4e6, hours: '24/7', open: true, secs: 8},
  {id: 'c2', mm: 'hly', pair: 'td-usdc', bps: 0.8, cap: 3e6, avail: 1.2e6, hours: '24/7', open: true, secs: 12},
  {id: 'c3', mm: 'mrd', pair: 'td-usdc', bps: 1.5, cap: 6e6, avail: 6e6, hours: '24/7', open: true, secs: 6},
  {id: 'c4', mm: 'kst', pair: 'td-usdc', bps: 0.6, cap: 2e6, avail: 2e6, hours: 'Weekdays 07:00–19:00 ET', open: false, secs: 10},
  {id: 'c5', mm: 'nsm', pair: 'td-usdb', bps: 1.2, cap: 2e6, avail: 2e6, hours: '24/7', open: true, secs: 8},
  {id: 'c6', mm: 'mrd', pair: 'td-usdb', bps: 1.0, cap: 3e6, avail: 2.4e6, hours: '24/7', open: true, secs: 6},
  {id: 'c7', mm: 'hly', pair: 'usdc-fiat', bps: 2.0, cap: 4e6, avail: 4e6, hours: '24/7', open: true, secs: 12},
  {id: 'c8', mm: 'mrd', pair: 'usdc-fiat', bps: 2.5, cap: 5e6, avail: 5e6, hours: '24/7', open: true, secs: 6},
  {id: 'c9', mm: 'nsm', pair: 'usdc-usdb', bps: 0.5, cap: 2e6, avail: 2e6, hours: '24/7', open: true, secs: 8},
  {id: 'c10', mm: 'kst', pair: 'usdb-fiat', bps: 2.2, cap: 1e6, avail: 1e6, hours: 'Weekdays 07:00–19:00 ET', open: false, secs: 10},
];
const mmOf = id => MMS.find(m => m.id === id);
const committed = m => CHANNELS.filter(c => c.mm === m.id).reduce((s, c) => s + c.cap, 0);
const bondNeed = m => committed(m) * BOND_RATIO;
const live = c => c.open && !c.paused;

// ---------- state ----------
const S = {
  view: 'overview',
  bal: {td_own: 48200000, usdc: 2500000, usdb: 400000, fiat: 12000000},
  req: {amountText: '1000000', from: 'td_own', to: 'usdc', rail: 'rtp', mode: 'optimize', pref: 'cost', pick: null, network: 'deeplake', simDecline: false, simFiat: false},
  run: null, open: null, mmView: 'nsm', seq: 10431,
  slashes: [],
  settlements: [
    seed(10431, 6, 'td_own', 'usdc', 750000, 'optimize', 'Halyard Trading', 60, 0, 60, null),
    seed(10430, 21, 'usdc', 'fiat', 400000, 'pick', 'Meridian OTC', 100, 0.25, 80.25, 'rtp'),
    seed(10429, 48, 'td_own', 'td_grnt', 2200000, 'optimize', 'Interbank over IBC', 0, 0, 0, null),
    seed(10428, 95, 'fiat', 'td_own', 5000000, 'optimize', 'Mint at Lakeshore', 0, 0.25, 0.25, 'fednow'),
    seed(10427, 140, 'td_own', 'usdb', 300000, 'optimize', 'Meridian OTC', 30, 0, 30, null),
    seed(10426, 212, 'td_own', 'usdc', 1500000, 'pick', 'Northshore Markets', 150, 0, 120, null),
    seed(10425, 300, 'usdb', 'usdc', 250000, 'optimize', 'Northshore Markets', 12.5, 0, 12.5, null),
  ],
};
function seed(n, mins, from, to, amount, mode, via, fee, rail, best, railId) {
  return {id: 'DL-' + n, at: ago(mins), from, to, amount, mode, network: 'deeplake', via, fee, railCost: rail, best, rail: railId, status: 'settled', events: [
    {label: 'Swap request received', detail: `${usd(amount)} ${ASSETS[from].sym} → ${ASSETS[to].sym}`, at: ago(mins)},
    {label: `Route locked: ${via}`, detail: mode === 'pick' ? 'Chosen by the bank' : 'Chosen by Deep Lake', at: ago(mins)},
    {label: 'Both legs locked in escrow', detail: 'Held by the escrow contract on the Cosmos ledger', tone: 'warn', at: ago(mins)},
    {label: 'Both legs released together', detail: `You received ${usd2(amount - fee - rail)} ${ASSETS[to].sym}`, tone: 'good', at: ago(mins)},
  ]};
}

// ---------- routing engine ----------
const ORDER = ['td', 'usdc', 'usdb', 'fiat'];
const kindKey = id => ASSETS[id].kind === 'stable' ? id : ASSETS[id].kind;
const pairKey = (f, t) => [kindKey(f), kindKey(t)].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).join('-');
const amountOf = r => { const n = Number(String(r.amountText).replace(/[^0-9.]/g, '')); return isFinite(n) ? n : 0; };

function quote(r) {
  const A = ASSETS[r.from], B = ASSETS[r.to], amt = amountOf(r);
  if (!amt) return {error: 'Enter an amount to see routes.'};
  if (r.from === r.to) return {error: 'Choose two different forms of dollar.'};
  if (amt > S.bal[r.from]) return {error: `You hold ${usd(S.bal[r.from])} in ${A.sym}. Lower the amount or swap from another balance.`};
  const hasFiat = A.kind === 'fiat' || B.kind === 'fiat';
  const rail = hasFiat ? RAILS[r.rail] : null, railCost = rail ? rail.cost : 0, railSecs = rail ? rail.secs : 0;
  const key = pairKey(r.from, r.to), routes = [];
  if (key === 'td-td') {
    routes.push({id: 'ibc', type: 'interbank', name: 'Interbank transfer over IBC', sub: 'No market maker. The two banks settle net.', bps: 0, secs: 6, avail: Infinity, open: true});
  } else if (key === 'td-fiat') {
    const td = A.kind === 'td' ? A : B, bank = BANKS.find(b => b.id === td.bank).name;
    routes.push({id: 'bank', type: 'bank', name: `${A.kind === 'td' ? 'Redeem' : 'Mint'} at ${bank.split(' ')[0]}`, sub: 'The issuing bank converts on its own balance sheet.', bps: 0, secs: 4, avail: Infinity, open: true});
  } else {
    CHANNELS.filter(c => c.pair === key).forEach(c => routes.push({id: c.id, type: 'channel', ch: c, name: mmOf(c.mm).name, sub: live(c) ? c.hours : (c.paused ? 'Paused by the market maker' : `Closed now · ${c.hours}`), bps: c.bps, secs: c.secs, avail: c.avail, open: live(c)}));
    routes.push({id: 'issuer', type: 'issuer', backstop: true, name: 'Issuer mint and redeem', sub: 'Backstop. Direct with the issuer at par when channels run thin.', bps: 0, secs: 1500, avail: Infinity, open: true});
  }
  const rank = (a, b) => r.pref === 'speed' ? (a.secs - b.secs || a.bps - b.bps) : (a.bps - b.bps || a.secs - b.secs);
  const ranked = routes.filter(x => x.open && !x.backstop).sort(rank);
  const rest = routes.filter(x => !x.open || x.backstop).sort((a, b) => (a.backstop ? 1 : 0) - (b.backstop ? 1 : 0));
  const backstop = routes.find(x => x.backstop);
  const fill = list => {
    const legs = []; let left = amt;
    for (const x of list) { if (left <= 0) break; const a = Math.min(left, x.avail); if (a > 0) { legs.push({route: x, amt: a, fee: a * x.bps / 1e4}); left -= a; } }
    if (left > 0 && backstop) { legs.push({route: backstop, amt: left, fee: 0}); left = 0; }
    return left > 0 ? null : legs;
  };
  const mk = legs => { const fee = legs.reduce((s, l) => s + l.fee, 0); return {legs, fee, railCost, total: fee + railCost, secs: Math.max(...legs.map(l => l.route.secs)) + railSecs}; };
  const bestLegs = fill(routes.filter(x => x.open && !x.backstop).sort((a, b) => a.bps - b.bps || a.secs - b.secs));
  const best = bestLegs ? mk(bestLegs) : null;
  let plan;
  if (r.mode === 'optimize') {
    const legs = fill(ranked); plan = legs ? mk(legs) : {error: 'No open route can fill this swap right now.'};
  } else {
    const pick = ranked.find(x => x.id === r.pick) || ranked[0];
    if (!pick) plan = {error: 'No open channel on this pair right now. Let Deep Lake route it to use the issuer backstop.'};
    else if (pick.avail < amt) plan = {pick, error: `${pick.name} has ${usd(pick.avail)} available on this pair. Lower the amount, or let Deep Lake split the fill across channels.`};
    else { plan = mk([{route: pick, amt, fee: amt * pick.bps / 1e4}]); plan.pick = pick; }
  }
  return {amt, A, B, key, hasFiat, rail, ranked, rest, plan, best, backstop};
}

// other routes a CTS bank can choose instead of Deep Lake
function networks(r) {
  const key = pairKey(r.from, r.to);
  return [
    {id: 'deeplake', name: 'Deep Lake', ok: true, note: 'Any dollar form. Market-maker liquidity.'},
    {id: 'consortium', name: 'Bank consortium network', ok: key === 'td-td', note: key === 'td-td' ? 'Member banks. Tokenized deposits only.' : 'Tokenized deposits only. Not available for this pair.'},
    {id: 'bilateral', name: 'Bilateral IBC channel', ok: r.to === 'td_grnt', note: r.to === 'td_grnt' ? 'Your direct channel with Granite FCU.' : 'You have a direct channel with Granite FCU only.'},
  ];
}

// ---------- settlement simulation ----------
function execute() {
  const r = {...S.req}, q = quote(r);
  if (q.error || q.plan.error) return;
  const {amt, A, B, hasFiat, rail} = q;
  const offLake = r.network !== 'deeplake';
  const st = {id: 'DL-' + (++S.seq), at: new Date(), from: r.from, to: r.to, amount: amt, mode: r.mode, network: r.network, rail: hasFiat ? r.rail : null,
    fee: 0, railCost: q.plan.railCost, best: q.best ? q.best.total : q.plan.total, status: 'running', events: [], legA: 'idle', legB: 'idle', via: ''};
  let legs = offLake ? [{route: {id: r.network, type: 'interbank', name: networks(r).find(n => n.id === r.network).name, bps: 0, secs: 6}, amt, fee: 0}] : q.plan.legs.map(l => ({...l}));
  const steps = [];
  const ev = (label, detail, tone, fn) => steps.push({label, detail, tone, fn});
  ev('Swap request received', `${usd(amt)} ${A.sym} → ${B.sym}${hasFiat ? ' · fiat leg on ' + rail.name : ''}`);
  const names = () => legs.map(l => l.route.name).join(' + ');
  ev(`Route locked: ${names()}`, offLake ? 'Sent outside Deep Lake, on a route you chose' : r.mode === 'pick' ? 'Chosen by the bank' : legs.length > 1 ? `Deep Lake split the fill across ${legs.length} routes` : 'Chosen by Deep Lake as the best route');
  ev(`Your leg locked in escrow`, `${usd(amt)} ${A.sym} held by the escrow contract`, 'warn', () => { st.legA = 'locked'; });

  let dead = false;
  const declineIdx = (!offLake && r.simDecline) ? legs.findIndex(l => l.route.type === 'channel') : -1;
  legs.forEach((l, i) => {
    if (dead) return;
    if (i === declineIdx) {
      const m = mmOf(l.route.ch.mm), cut = Math.max(SLASH_MIN, l.amt * SLASH_RATE);
      ev(`${m.name} declined the fill`, `${usd(l.amt)} was inside its posted capacity and hours`, 'bad');
      ev(`Bond slashed ${usd(cut)}`, `Rulebook §4 · ${m.name}'s bond is now ${usd(m.bond - cut)}`, 'bad', () => {
        m.bond -= cut; S.slashes.unshift({at: new Date(), mm: m.id, amount: cut, swap: st.id, reason: `Declined ${usd(l.amt)} inside posted capacity`});
      });
      const used = legs.map(x => x.route.id);
      const alt = r.mode === 'optimize' ? (q.ranked.find(x => !used.includes(x.id) && x.avail >= l.amt) || q.backstop) : null;
      if (alt) {
        l.route = alt; l.fee = l.amt * alt.bps / 1e4;
        ev(`Re-routed to ${alt.name}`, alt.backstop ? 'No other channel had room, so the issuer backstop fills at par' : `Next-best channel at ${alt.bps} bps`);
      } else {
        dead = true;
        ev('Your leg returned from escrow', 'Nothing moved. Pick another partner or let Deep Lake route it.', 'bad', () => { st.legA = 'returned'; st.legB = 'returned'; st.status = 'returned'; });
        return;
      }
    }
    const who = l.route.type === 'bank' ? 'Issuing bank' : l.route.type === 'interbank' ? 'Receiving bank' : l.route.name;
    ev(`${who} leg locked in escrow`, `${usd(l.amt)} ${B.sym}`, 'warn', () => { if (i === legs.length - 1) st.legB = 'locked'; });
  });
  if (!dead && hasFiat) {
    if (r.simFiat) {
      dead = true;
      ev(`${rail.name} confirmation did not arrive before the deadline`, 'The fiat leg never reached finality', 'bad');
      ev('Both legs returned from escrow', 'Nothing moved. No bond is slashed for a rail failure.', 'bad', () => { st.legA = 'returned'; st.legB = 'returned'; st.status = 'returned'; });
    } else ev(`${rail.name} confirmed the fiat leg`, rail.instant ? 'Finality in seconds' : 'Pre-funded by the sender, so release does not wait');
  }
  if (!dead) ev('Both legs released together', '', 'good', () => {
    st.fee = legs.reduce((s, l) => s + l.fee, 0);
    const got = amt - st.fee - st.railCost;
    S.bal[st.from] -= amt; if (st.to in S.bal) S.bal[st.to] += got;
    legs.forEach(l => { if (l.route.type === 'channel') { l.route.ch.avail = Math.max(0, l.route.ch.avail - l.amt); mmOf(l.route.ch.mm).earned += l.fee; } });
    st.legA = 'released'; st.legB = 'released'; st.status = 'settled'; st.got = got;
    steps[steps.length - 1].detail = `You received ${usd2(got)} ${B.sym}. Fees paid: ${usd2(st.fee + st.railCost)}.`;
  });

  st.viaFn = names; st.via = names();
  S.settlements.unshift(st); S.run = st; render();
  let i = 0;
  const tick = () => {
    const s = steps[i++]; if (s.fn) s.fn();
    st.events.push({label: s.label, detail: s.detail, tone: s.tone, at: new Date()}); st.via = names();
    render();
    if (i < steps.length) setTimeout(tick, 720);
    else toast(st.status === 'settled' ? `${st.id} settled` : `${st.id} returned. Nothing moved.`);
  };
  setTimeout(tick, 350);
}

// ---------- shared fragments ----------
const statusChip = s => s === 'settled' ? '<span class="chip good">Settled</span>' : s === 'returned' ? '<span class="chip bad">Returned</span>' : '<span class="chip warn">Settling</span>';
const insured = a => a.insured ? '<span class="chip plain">Insured deposit</span>' : '<span class="chip plain warn">Not insured</span>';
const poolSvg = '<svg viewBox="0 0 64 40" fill="none" stroke="currentColor" aria-hidden="true"><ellipse cx="32" cy="22" rx="30" ry="14" stroke-width="1"/><ellipse cx="32" cy="22" rx="19" ry="9" stroke-width="1.2"/><ellipse cx="32" cy="22" rx="8" ry="4" stroke-width="1.5"/></svg>';

function timeline(st) {
  return `<ol class="tl">${st.events.map(e => `<li class="${e.tone || ''}"><time>${clock(e.at)}</time><b>${esc(e.label)}</b>${e.detail ? `<small>${esc(e.detail)}</small>` : ''}</li>`).join('')}</ol>`;
}
function dvp(st) {
  const A = ASSETS[st.from], B = ASSETS[st.to];
  const word = s => ({idle: 'Waiting', locked: 'Locked in escrow', released: 'Released', returned: 'Returned'}[s]);
  const mid = st.legA === 'released' ? 'released' : st.legA === 'returned' ? 'returned' : st.legA === 'locked' ? 'locked' : '';
  return `<div class="dvp">
    <div class="leg ${st.legA || 'released'}"><span class="k">Your leg</span><b>${usd(st.amount)} ${A.sym}</b><small>${word(st.legA || 'released')}</small></div>
    <div class="pool ${mid || (st.status === 'settled' ? 'released' : '')}">${poolSvg}<span>Escrow</span></div>
    <div class="leg ${st.legB || 'released'}"><span class="k">Their leg</span><b>${usd(st.amount)} ${B.sym}</b><small>${word(st.legB || 'released')} · ${esc(st.via)}</small></div>
  </div>`;
}

// ---------- views ----------
const VIEWS = {};
const META = {
  overview: ['Overview', 'Your dollars, the liquidity behind them and what settled today.'],
  swap: ['Swap', 'Send one form of dollar, receive another. You choose the route.'],
  settlements: ['Settlements', 'Every swap, with both legs and the escrow record.'],
  reports: ['Reports', 'What each swap cost against the best route available, plus an export for your core.'],
  channels: ['Liquidity channels', 'The quote board: every standing offer, its fee, its capacity and the bond behind it.'],
  rails: ['Rails', 'How each form of dollar reaches Deep Lake and when escrow lets go.'],
  compliance: ['Compliance', 'Who is on the network, which stablecoins are allowed and what gets screened.'],
  rulebook: ['Rulebook', 'The terms every participant accepts.'],
  desk: ['Market maker desk', 'Post channels, set fees and watch your bond. Shown here so the other side of the network is visible.'],
};
const NAV = [
  ['Bank', ['overview', 'swap', 'settlements', 'reports']],
  ['Network', ['channels', 'rails', 'compliance', 'rulebook']],
  ['Market maker', ['desk']],
];

VIEWS.overview = () => {
  const cap = CHANNELS.reduce((s, c) => s + c.cap, 0), av = CHANNELS.filter(live).reduce((s, c) => s + c.avail, 0);
  const bond = MMS.reduce((s, m) => s + m.bond, 0);
  const done = S.settlements.filter(s => s.status === 'settled'), vol = done.reduce((s, x) => s + x.amount, 0);
  const pairs = Object.keys(PAIRS).map(k => { const cs = CHANNELS.filter(c => c.pair === k); return {k, cap: cs.reduce((s, c) => s + c.cap, 0), av: cs.filter(live).reduce((s, c) => s + c.avail, 0), n: cs.filter(live).length}; });
  return `
  <div class="tiles">
    <div class="tile"><span>Committed liquidity</span><b data-n="${cap}">${short(cap)}</b><em>${CHANNELS.length} channels · ${MMS.length} market makers</em></div>
    <div class="tile"><span>Available now</span><b data-n="${av}">${short(av)}</b><em>${CHANNELS.filter(live).length} channels open</em></div>
    <div class="tile brass"><span>Bonds in escrow</span><b data-n="${bond}">${short(bond)}</b><em>${Math.round(bond / cap * 100)}% of committed</em></div>
    <div class="tile"><span>You settled today</span><b data-n="${vol}">${short(vol)}</b><em>${done.length} swaps · 0 breaks</em></div>
    <div class="tile"><span>Deep Lake fee</span><b>$0</b><em>Market makers set their own</em></div>
  </div>
  <div class="cols-2">
    <section class="panel">
      <div class="panel-head"><div><h2>Your dollars</h2><p class="sub">Four forms, one balance sheet.</p></div><a class="btn primary" href="#swap">Swap</a></div>
      <table class="t"><thead><tr><th>Form</th><th>Protection</th><th class="r">Balance</th></tr></thead><tbody>
      ${HOLD.map(k => `<tr><td>${ASSETS[k].label}<small class="num">${ASSETS[k].sym}</small></td><td>${insured(ASSETS[k])}</td><td class="r num">${usd(S.bal[k])}</td></tr>`).join('')}
      </tbody></table>
    </section>
    <section class="panel">
      <div class="panel-head"><div><h2>Liquidity by pair</h2><p class="sub">Available now against total committed.</p></div><a class="btn" href="#channels">Quote board</a></div>
      ${pairs.map(p => `<div class="pairrow"><span>${PAIRS[p.k]}</span><div class="bar"><i style="width:${p.cap ? p.av / p.cap * 100 : 0}%"></i></div><span class="num muted">${short(p.av)} / ${short(p.cap)}</span></div>`).join('')}
      <p class="note">Tokenized deposit to tokenized deposit, and deposit to fiat, need no market maker. Banks settle those directly.</p>
    </section>
  </div>
  <section class="panel">
    <div class="panel-head"><div><h2>Latest settlements</h2></div><a class="btn" href="#settlements">All settlements</a></div>
    ${settleTable(S.settlements.slice(0, 5))}
  </section>`;
};

function settleTable(list) {
  if (!list.length) return '<p class="empty">No swaps yet. Request one from Swap.</p>';
  return `<div class="scroll-x"><table class="t"><thead><tr><th>Swap</th><th>Time</th><th>From → to</th><th>Route</th><th class="r">Amount</th><th class="r">Cost</th><th class="r">Status</th></tr></thead><tbody>
  ${list.map(s => `<tr class="rowlink" data-act="open" data-id="${s.id}" tabindex="0"><td class="num">${s.id}</td><td class="num muted">${clock(s.at)}</td><td>${ASSETS[s.from].sym} → ${ASSETS[s.to].sym}</td><td>${esc(s.via)}<small>${s.network !== 'deeplake' ? 'Outside Deep Lake' : s.mode === 'pick' ? 'Bank-picked' : 'Deep Lake routed'}</small></td><td class="r num">${usd(s.amount)}</td><td class="r num">${s.status === 'settled' ? usd2(s.fee + s.railCost) : '—'}</td><td class="r">${statusChip(s.status)}</td></tr>`).join('')}
  </tbody></table></div>`;
}

VIEWS.swap = () => {
  const r = S.req, q = quote(r), busy = S.run && S.run.status === 'running';
  const opt = (ids, sel) => ids.map(k => `<option value="${k}" ${k === sel ? 'selected' : ''}>${ASSETS[k].label}</option>`).join('');
  const hasFiat = ASSETS[r.from].kind === 'fiat' || ASSETS[r.to].kind === 'fiat';
  const form = `
  <section class="panel">
    <h2>Request</h2><p class="sub">Acting as ${ME.name}.</p>
    <label class="f"><span>Amount (USD)</span><input class="in amount" id="amt" inputmode="decimal" autocomplete="off" value="${esc(r.amountText)}" data-in="amountText" ${busy ? 'disabled' : ''}></label>
    <div class="quick">${[250000, 1000000, 5000000, 15000000].map(v => `<button class="btn sm" data-act="amt" data-v="${v}" ${busy ? 'disabled' : ''}>${short(v)}</button>`).join('')}</div>
    <label class="f"><span>You send</span><select class="in" id="from" data-ch="from" ${busy ? 'disabled' : ''}>${opt(HOLD, r.from)}</select></label>
    <p class="hintline">Balance ${usd(S.bal[r.from])} ${ASSETS[r.from].sym}</p>
    <div class="swapdir"><button class="btn sm" data-act="flip" ${busy || !(r.to in S.bal) ? 'disabled' : ''} aria-label="Swap direction">⇅ Reverse</button></div>
    <label class="f"><span>You receive</span><select class="in" id="to" data-ch="to" ${busy ? 'disabled' : ''}>${opt(Object.keys(ASSETS), r.to)}</select></label>
    ${hasFiat ? `<label class="f"><span>Fiat rail</span><select class="in" id="rail" data-ch="rail" ${busy ? 'disabled' : ''}>${Object.entries(RAILS).map(([k, v]) => `<option value="${k}" ${k === r.rail ? 'selected' : ''}>${v.name} · ${speed(v.secs)} · ${usd2(v.cost)}</option>`).join('')}</select></label>` : ''}
    <span class="flabel">Who picks the route</span>
    <div class="seg" role="group" aria-label="Routing mode">
      <button data-act="mode" data-v="optimize" aria-pressed="${r.mode === 'optimize'}" ${busy ? 'disabled' : ''}>Deep Lake picks</button>
      <button data-act="mode" data-v="pick" aria-pressed="${r.mode === 'pick'}" ${busy ? 'disabled' : ''}>I pick</button>
    </div>
    ${r.mode === 'optimize' ? `<span class="flabel">Rank routes by</span>
    <div class="seg" role="group" aria-label="Preference">
      <button data-act="pref" data-v="cost" aria-pressed="${r.pref === 'cost'}" ${busy ? 'disabled' : ''}>Lowest cost</button>
      <button data-act="pref" data-v="speed" aria-pressed="${r.pref === 'speed'}" ${busy ? 'disabled' : ''}>Fastest</button>
    </div>` : ''}
    <details class="demo" ${S.demoOpen || r.simDecline || r.simFiat ? 'open' : ''}><summary>Demo controls</summary>
      <label class="check"><input type="checkbox" data-tg="simDecline" ${r.simDecline ? 'checked' : ''} ${busy ? 'disabled' : ''}><span>Market maker declines the fill. Its bond is slashed, and Deep Lake re-routes if it is picking.</span></label>
      <label class="check"><input type="checkbox" data-tg="simFiat" ${r.simFiat ? 'checked' : ''} ${busy ? 'disabled' : ''}><span>Fiat confirmation never arrives. Both legs return. Applies when one side is fiat.</span></label>
    </details>
  </section>`;

  let right;
  if (S.run) {
    const st = S.run;
    right = `<section class="panel">
      <div class="panel-head"><div><h2>${st.id}</h2><p class="sub">${usd(st.amount)} ${ASSETS[st.from].sym} → ${ASSETS[st.to].sym}</p></div>${statusChip(st.status)}</div>
      ${dvp(st)}${timeline(st)}
      ${st.status !== 'running' ? `<div style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap"><button class="btn primary" data-act="new">New swap</button><a class="btn" href="#settlements">See all settlements</a></div>` : ''}
    </section>`;
  } else if (q.error) {
    right = `<section class="panel"><h2>Routes</h2><p class="empty">${esc(q.error)}</p></section>`;
  } else {
    const nets = networks(r), off = r.network !== 'deeplake';
    const p = q.plan;
    const rows = [...q.ranked, ...q.rest].map((x, i) => {
      const leg = !p.error && p.legs.find(l => l.route.id === x.id);
      const on = !!leg, pickable = r.mode === 'pick' && x.open && !x.backstop;
      const rk = x.open && !x.backstop ? i + 1 : '·';
      return `<div class="route ${on ? 'on' : ''} ${x.open ? '' : 'off'} ${pickable ? 'pickable' : ''}" ${pickable ? `data-act="pick" data-id="${x.id}"` : ''}>
        ${pickable ? `<input type="radio" name="pick" ${(p.pick && p.pick.id === x.id) ? 'checked' : ''} aria-label="Route with ${esc(x.name)}">` : `<span class="rank">${rk}</span>`}
        <div><b>${esc(x.name)}</b>${x.backstop ? ' <span class="chip plain">Backstop</span>' : ''}${on && p.legs.length > 1 ? ` <span class="chip plain good">Fills ${short(leg.amt)}</span>` : ''}<small>${esc(x.sub)}</small></div>
        <div class="hide-s"><span class="k">Available</span><span class="v">${x.avail === Infinity ? 'At par' : short(x.avail)}</span></div>
        <div class="hide-s"><span class="k">Settles in</span><span class="v">${speed(x.secs)}</span></div>
        <div style="text-align:right"><span class="k">Fee</span><span class="v">${x.bps ? x.bps.toFixed(1) + ' bps · ' + usd2(q.amt * x.bps / 1e4) : 'None'}</span></div>
      </div>`;
    }).join('');
    const lake = `
      ${off ? '' : rows}
      ${off ? `<p class="note">This swap goes out on ${esc(nets.find(n => n.id === r.network).name)}, outside Deep Lake. CTS carries it the same way; no market maker is involved.</p>` : ''}
      ${!off && p.error ? `<p class="note bad">${esc(p.error)}</p>` : ''}
      ${off || !p.error ? (() => {
        const fee = off ? 0 : p.fee, rc = q.plan.railCost || (q.rail ? q.rail.cost : 0), total = fee + rc;
        const extra = !off && r.mode === 'pick' && q.best && total - q.best.total > 0.005 ? total - q.best.total : 0;
        return `<div class="sum">
          <div><span>Market maker fee</span><span class="num">${usd2(fee)}</span></div>
          <div><span>Rail cost${q.rail ? ' · ' + q.rail.name : ''}</span><span class="num">${usd2(rc)}</span></div>
          <div><span>Deep Lake fee</span><span class="num">$0.00</span></div>
          <div><span>All-in cost</span><span class="num">${usd2(total)} · ${bpsOf(total, q.amt).toFixed(2)} bps</span></div>
          <div class="total"><span>You receive ${insured(q.B)}</span><span>${usd2(q.amt - total)} ${q.B.sym}</span></div>
        </div>
        ${extra ? `<p class="note">The cheapest route right now costs ${usd2(q.best.total)}. Your pick costs ${usd2(extra)} more.</p>` : ''}
        ${!off && p.legs.some(l => l.route.backstop) && p.legs.length > 1 ? `<p class="note">Open channels cover ${usd(q.amt - p.legs.find(l => l.route.backstop).amt)}. The issuer backstop fills the rest at par.</p>` : ''}
        ${q.A.insured !== q.B.insured ? `<p class="note">${q.B.insured ? 'You are moving into an insured deposit.' : 'You are moving out of an insured deposit into a stablecoin, which is not insured.'}</p>` : ''}
        <button class="btn primary big" data-act="exec">Swap ${usd(q.amt)} ${q.A.sym} for ${q.B.sym}</button>`;
      })() : ''}`;
    right = `<section class="panel">
      <h2>Send through</h2><p class="sub">CTS can carry this swap on more than one network. The choice is yours.</p>
      <div class="netcards">${nets.map(n => `<button class="netcard" data-act="net" data-v="${n.id}" aria-pressed="${r.network === n.id}" ${n.ok ? '' : 'disabled'}><b>${n.name}</b><small>${n.note}</small></button>`).join('')}</div>
      ${off ? '' : `<h2>${r.mode === 'pick' ? 'Pick your partner' : 'Routes, ranked'}</h2><p class="sub">${r.mode === 'pick' ? 'Every open channel on this pair, cheapest first.' : `Deep Lake takes the ${r.pref === 'speed' ? 'fastest' : 'cheapest'} route and splits the fill when one channel is too small.`}</p>`}
      ${lake}
    </section>`;
  }
  return `<div class="cols-swap">${form}${right}</div>`;
};

VIEWS.settlements = () => {
  const st = S.settlements.find(s => s.id === S.open);
  return `
  ${st ? `<section class="panel">
    <div class="panel-head"><div><h2>${st.id}</h2><p class="sub">${usd(st.amount)} ${ASSETS[st.from].sym} → ${ASSETS[st.to].sym} · ${esc(st.via)}${st.rail ? ' · ' + RAILS[st.rail].name : ''}</p></div><div style="display:flex;gap:10px;align-items:center">${statusChip(st.status)}<button class="btn sm" data-act="close">Close</button></div></div>
    ${dvp(st)}${timeline(st)}
  </section>` : ''}
  <section class="panel"><h2>All swaps</h2><p class="sub">Select a row to see both legs and the escrow record.</p>${settleTable(S.settlements)}</section>`;
};

VIEWS.reports = () => {
  const done = S.settlements.filter(s => s.status === 'settled');
  const paid = done.reduce((s, x) => s + x.fee + x.railCost, 0), best = done.reduce((s, x) => s + x.best, 0), vol = done.reduce((s, x) => s + x.amount, 0);
  const atBest = done.filter(x => x.fee + x.railCost - x.best < 0.005).length;
  return `
  <div class="tiles">
    <div class="tile"><span>Swaps settled</span><b>${done.length}</b><em>${short(vol)} total</em></div>
    <div class="tile"><span>You paid</span><b>${usd2(paid)}</b><em>${bpsOf(paid, vol).toFixed(2)} bps all-in</em></div>
    <div class="tile"><span>Best available</span><b>${usd2(best)}</b><em>${bpsOf(best, vol).toFixed(2)} bps</em></div>
    <div class="tile brass"><span>Left on the table</span><b>${usd2(Math.max(0, paid - best))}</b><em>${atBest} of ${done.length} swaps took the best route</em></div>
  </div>
  <section class="panel">
    <div class="panel-head"><div><h2>Best execution</h2><p class="sub">What you paid on each swap against the cheapest route open at that moment.</p></div><button class="btn" data-act="csv">Download reconciliation (CSV)</button></div>
    <div class="scroll-x"><table class="t"><thead><tr><th>Swap</th><th>Route</th><th>Picked by</th><th class="r">Amount</th><th class="r">Paid</th><th class="r">Best available</th><th class="r">Difference</th></tr></thead><tbody>
    ${done.map(s => { const d = s.fee + s.railCost - s.best; return `<tr><td class="num">${s.id}</td><td>${esc(s.via)}</td><td>${s.mode === 'pick' ? 'Bank' : 'Deep Lake'}</td><td class="r num">${usd(s.amount)}</td><td class="r num">${usd2(s.fee + s.railCost)}</td><td class="r num">${usd2(s.best)}</td><td class="r num ${d > 0.005 ? 'brass' : 'good'}">${d > 0.005 ? '+' + usd2(d) : 'Best route'}</td></tr>`; }).join('')}
    </tbody></table></div>
    <p class="note">Deep Lake charges nothing, so it has no fee of its own to favor. Routes are ranked on the market maker's fee, speed and capacity alone.</p>
  </section>`;
};

VIEWS.channels = () => `
  <section class="panel">
    <h2>Quote board</h2><p class="sub">Each row is one market maker's standing offer on one pair. Fees are theirs; Deep Lake adds none.</p>
    <div class="scroll-x"><table class="t"><thead><tr><th>Market maker</th><th>Pair</th><th class="r">Fee</th><th class="r">Committed</th><th>Available</th><th>Hours</th><th class="r">Settles in</th><th class="r">Status</th></tr></thead><tbody>
    ${[...CHANNELS].sort((a, b) => a.pair.localeCompare(b.pair) || a.bps - b.bps).map(c => `<tr><td>${mmOf(c.mm).name}</td><td>${PAIRS[c.pair]}</td><td class="r num">${c.bps.toFixed(1)} bps</td><td class="r num">${short(c.cap)}</td><td style="min-width:150px"><div class="bar"><i style="width:${c.avail / c.cap * 100}%"></i></div><small class="num">${short(c.avail)}</small></td><td class="muted">${c.hours}</td><td class="r num">${speed(c.secs)}</td><td class="r">${c.paused ? '<span class="chip warn">Paused</span>' : c.open ? '<span class="chip good">Open</span>' : '<span class="chip">Closed</span>'}</td></tr>`).join('')}
    </tbody></table></div>
  </section>
  <section class="panel">
    <h2>Bonds</h2><p class="sub">A market maker posts ${BOND_RATIO * 100}% of what it commits. The bond backs the promise to fill, never a trade: settlement is atomic, so a fill only happens once both legs are in escrow.</p>
    <div class="scroll-x"><table class="t"><thead><tr><th>Market maker</th><th class="r">Committed</th><th class="r">Bond posted</th><th>Coverage</th><th class="r">Router cap on unfilled requests</th><th class="r">Slashed</th></tr></thead><tbody>
    ${MMS.map(m => { const need = bondNeed(m), cov = need ? m.bond / need : 1, sl = S.slashes.filter(s => s.mm === m.id).reduce((s, x) => s + x.amount, 0); return `<tr><td>${m.name}</td><td class="r num">${short(committed(m))}</td><td class="r num brass">${usd(m.bond)}</td><td style="min-width:160px"><div class="bar brass"><i style="width:${Math.min(100, cov * 100)}%"></i></div><small>${cov >= 1 ? 'Fully bonded' : 'Top-up of ' + usd(need - m.bond) + ' required'}</small></td><td class="r num">${short(m.bond * EXPOSURE_MULT)}</td><td class="r num ${sl ? 'bad' : 'muted'}">${sl ? usd(sl) : '$0'}</td></tr>`; }).join('')}
    </tbody></table></div>
  </section>`;

VIEWS.rails = () => `
  <section class="panel">
    <h2>On-chain rails</h2><p class="sub">Both legs sit in the same escrow contract, so they release together.</p>
    <table class="t"><thead><tr><th>Rail</th><th>Carries</th><th>Finality</th><th>Escrow release</th><th class="r">Status</th></tr></thead><tbody>
      <tr><td>CTS permissioned ledger + IBC</td><td>Tokenized deposits, bank to bank</td><td class="num">~6 sec</td><td>Atomic, same block</td><td class="r"><span class="chip good">Live</span></td></tr>
      <tr><td>Stablecoin chain adapters</td><td>USDC, USDB</td><td class="num">Seconds to ~2 min</td><td>Atomic once the stablecoin leg is final</td><td class="r"><span class="chip good">Live</span></td></tr>
      <tr><td>Issuer mint and redeem</td><td>Backstop at par</td><td class="num">~25 min</td><td>On issuer confirmation</td><td class="r"><span class="chip good">Live</span></td></tr>
    </tbody></table>
  </section>
  <section class="panel">
    <h2>Fiat rails</h2><p class="sub">Banks and market makers send fiat to each other directly. Deep Lake never holds it; a confirmation tells escrow when to release the token leg.</p>
    <table class="t"><thead><tr><th>Rail</th><th>Finality</th><th>Escrow release</th><th class="r">Cost per payment</th><th class="r">Status</th></tr></thead><tbody>
    ${Object.values(RAILS).map(v => `<tr><td>${v.name}</td><td class="num">${speed(v.secs)}</td><td>${v.rule}</td><td class="r num">${usd2(v.cost)}</td><td class="r"><span class="chip good">Live</span></td></tr>`).join('')}
    </tbody></table>
    <p class="note">Rail costs are illustrative. Deep Lake extends no credit: when a rail is not instant, the sender pre-funds.</p>
  </section>
  <section class="panel">
    <h2>Core banking</h2><p class="sub">CTS posts each settled swap to the bank's core, so the ledger and the token supply stay in step.</p>
    <table class="t"><thead><tr><th>Connection</th><th>Does</th><th class="r">Status</th></tr></thead><tbody>
      <tr><td>Core adapter · Lakeshore</td><td>Debits and credits the deposit account when tokens mint or burn</td><td class="r"><span class="chip good">Connected</span></td></tr>
      <tr><td>Reconciliation export</td><td>Daily file of swaps, fees and rail references</td><td class="r"><span class="chip good">Ready</span></td></tr>
    </tbody></table>
  </section>`;

VIEWS.compliance = () => `
  <div class="cols-2">
    <section class="panel">
      <h2>Stablecoin allow-list</h2><p class="sub">Only stablecoins from issuers permitted under the GENIUS Act can be routed. The list below is a demo.</p>
      <table class="t"><thead><tr><th>Stablecoin</th><th>Issuer type</th><th class="r">Price</th><th class="r">Router</th></tr></thead><tbody>
        <tr><td>USDC</td><td>Permitted nonbank issuer</td><td class="r num">$1.0000</td><td class="r"><span class="chip good">Allowed</span></td></tr>
        <tr><td>USDB</td><td>Bank-issued (simulated)</td><td class="r num">$0.9998</td><td class="r"><span class="chip good">Allowed</span></td></tr>
        <tr><td>Any unlisted issuer</td><td>Not permitted</td><td class="r num">—</td><td class="r"><span class="chip bad">Blocked</span></td></tr>
      </tbody></table>
      <p class="note">If a stablecoin trades below $0.9950, the router pauses that issuer's channels and falls back to redemption at par with the issuer.</p>
    </section>
    <section class="panel">
      <h2>What each dollar is</h2><p class="sub">Every quote says which side of the swap is an insured deposit.</p>
      <table class="t"><thead><tr><th>Form</th><th>Claim on</th><th class="r">Protection</th></tr></thead><tbody>
        <tr><td>Tokenized deposit</td><td>The issuing bank</td><td class="r">${insured({insured: true})}</td></tr>
        <tr><td>Fiat in a bank account</td><td>The bank</td><td class="r">${insured({insured: true})}</td></tr>
        <tr><td>Stablecoin</td><td>The issuer's reserves</td><td class="r">${insured({insured: false})}</td></tr>
      </tbody></table>
    </section>
  </div>
  <section class="panel">
    <h2>Participants</h2><p class="sub">Everyone on the network is a known, verified business. Banks stay the KYC owner of their own customers.</p>
    <div class="scroll-x"><table class="t"><thead><tr><th>Participant</th><th>Role</th><th>Connects with</th><th class="r">Business verification</th></tr></thead><tbody>
    ${BANKS.map(b => `<tr><td>${b.name}${b.id === ME.id ? ' <span class="chip plain">You</span>' : ''}</td><td>${b.type}</td><td>CTS license · <span class="num">${b.token}</span></td><td class="r"><span class="chip good">Verified</span></td></tr>`).join('')}
    ${MMS.map(m => `<tr><td>${m.name}</td><td>Market maker</td><td>Liquidity API · bond in escrow</td><td class="r"><span class="chip good">Verified</span></td></tr>`).join('')}
    </tbody></table></div>
  </section>
  <div class="cols-2">
    <section class="panel">
      <h2>Screening</h2><p class="sub">Checked on every swap before escrow accepts a leg.</p>
      <table class="t"><tbody>
        <tr><td>Sanctions screening on both counterparties</td><td class="r"><span class="chip good">On</span></td></tr>
        <tr><td>Wallet risk score on every stablecoin address</td><td class="r"><span class="chip good">On</span></td></tr>
        <tr><td>Travel Rule data passed bank to bank</td><td class="r"><span class="chip good">On</span></td></tr>
        <tr><td>Full audit trail per swap</td><td class="r"><span class="chip good">On</span></td></tr>
      </tbody></table>
    </section>
    <section class="panel">
      <h2>Your limits</h2><p class="sub">Set by Lakeshore, enforced by the router.</p>
      <table class="t"><tbody>
        <tr><td>Largest single swap</td><td class="r num">$15,000,000</td></tr>
        <tr><td>Daily total</td><td class="r num">$60,000,000</td></tr>
        <tr><td>Most sent to one market maker per day</td><td class="r num">$20,000,000</td></tr>
        <tr><td>Stablecoins you accept</td><td class="r">USDC, USDB</td></tr>
      </tbody></table>
    </section>
  </div>`;

VIEWS.rulebook = () => {
  const R = [
    ['§1 · Role', 'Routes and escrows only', 'Deep Lake matches a swap to a route and runs the escrow contract. It never takes title to funds and never holds fiat. Participants trade with each other.'],
    ['§2 · Fees', 'Deep Lake charges nothing', 'Market makers set and keep their own fees. Every quote shows the market maker fee and the rail cost, and nothing else.'],
    ['§3 · Access', 'A CTS license connects you', 'Banks and credit unions connect through Cosmos Tokenization Suite. CTS also reaches other networks, and the bank picks the route on every swap.'],
    ['§4 · Bonds', `${BOND_RATIO * 100}% of committed, slashed for declined fills`, `A market maker that declines a fill inside its posted capacity and hours loses ${SLASH_RATE * 100}% of the declined amount, with a ${usd(SLASH_MIN)} minimum. The bond backs the promise, not the trade.`],
    ['§5 · Exposure', `Unfilled requests capped at ${EXPOSURE_MULT}× bond`, 'The router stops sending new requests to a market maker once its pending, unfilled volume reaches the cap. One thin channel cannot stall many banks.'],
    ['§6 · Settlement', 'Both legs, or neither', 'Legs lock in escrow and release in the same block. If either side fails or a deadline passes, both return. No one at Deep Lake can move escrowed assets.'],
    ['§7 · Fiat legs', 'Release on confirmation', 'On RTP and FedNow the token leg releases when the payment confirms. On ACH and wire the sender pre-funds, because Deep Lake extends no credit.'],
    ['§8 · Stablecoins', 'GENIUS-permitted issuers only', 'The router carries an issuer allow-list. A stablecoin trading below $0.9950 is paused and swaps fall back to the issuer at par.'],
    ['§9 · Operator', 'A new entity, to be formed', 'Deep Lake will be run by its own entity, separate from the banks and market makers that use it. Cosmos Labs funds it from CTS license revenue.'],
  ];
  return `<div class="rules">${R.map(r => `<div class="rule"><span class="k">${r[0]}</span><h3>${r[1]}</h3><p>${r[2]}</p></div>`).join('')}</div>`;
};

VIEWS.desk = () => {
  const m = mmOf(S.mmView), cs = CHANNELS.filter(c => c.mm === m.id), need = bondNeed(m), short_ = Math.max(0, need - m.bond);
  const sl = S.slashes.filter(s => s.mm === m.id);
  return `
  <section class="panel">
    <div class="inline-form"><label class="f" style="max-width:320px"><span>Viewing as</span><select class="in" id="mmsel" data-mm>${MMS.map(x => `<option value="${x.id}" ${x.id === m.id ? 'selected' : ''}>${x.name}</option>`).join('')}</select></label></div>
  </section>
  <div class="tiles">
    <div class="tile"><span>Committed</span><b>${short(committed(m))}</b><em>${cs.length} channels</em></div>
    <div class="tile brass"><span>Bond posted</span><b>${usd(m.bond)}</b><em>${short_ ? 'Top-up of ' + usd(short_) + ' required' : 'Fully bonded at ' + BOND_RATIO * 100 + '%'}</em></div>
    <div class="tile"><span>Router cap</span><b>${short(m.bond * EXPOSURE_MULT)}</b><em>Unfilled requests at one time</em></div>
    <div class="tile"><span>Fees earned today</span><b>${usd2(m.earned)}</b><em>You keep all of it</em></div>
  </div>
  ${short_ ? `<p class="note bad" style="margin:0">Your bond is ${usd(short_)} under the ${BOND_RATIO * 100}% requirement. Until you top up, the router sends you less. <button class="btn sm" data-act="topup" style="margin-left:8px">Post ${usd(short_)}</button></p>` : ''}
  <section class="panel">
    <h2>Your channels</h2><p class="sub">Change a fee or capacity and banks see it on their next quote.</p>
    <div class="scroll-x"><table class="t"><thead><tr><th>Pair</th><th>Fee (bps)</th><th>Committed (USD)</th><th class="r">Available</th><th>Hours</th><th class="r">Status</th><th class="r"></th></tr></thead><tbody>
    ${cs.map(c => `<tr><td>${PAIRS[c.pair]}</td><td><input class="in sm" id="bps-${c.id}" inputmode="decimal" value="${c.bps}" data-edit="bps" data-id="${c.id}" aria-label="Fee in basis points"></td><td><input class="in sm" id="cap-${c.id}" style="width:120px" inputmode="numeric" value="${c.cap}" data-edit="cap" data-id="${c.id}" aria-label="Committed capacity"></td><td class="r num">${short(c.avail)}</td><td class="muted">${c.hours}</td><td class="r">${c.paused ? '<span class="chip warn">Paused</span>' : c.open ? '<span class="chip good">Open</span>' : '<span class="chip">Closed</span>'}</td><td class="r"><button class="btn sm" data-act="pause" data-id="${c.id}">${c.paused ? 'Resume' : 'Pause'}</button></td></tr>`).join('')}
    </tbody></table></div>
  </section>
  <section class="panel">
    <h2>Post a channel</h2><p class="sub">A standing offer on one pair. Posting ${short(1e6)} of capacity needs ${short(1e6 * BOND_RATIO)} of bond.</p>
    <div class="inline-form">
      <label class="f"><span>Pair</span><select class="in" id="np-pair">${Object.entries(PAIRS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <label class="f"><span>Capacity (USD)</span><input class="in" id="np-cap" inputmode="numeric" value="2000000"></label>
      <label class="f"><span>Fee (bps)</span><input class="in" id="np-bps" inputmode="decimal" value="1.0"></label>
      <label class="f"><span>Hours</span><select class="in" id="np-hours"><option>24/7</option><option>Weekdays 07:00–19:00 ET</option></select></label>
      <button class="btn primary" data-act="post">Post channel</button>
    </div>
  </section>
  <section class="panel">
    <h2>Slash log</h2><p class="sub">Bond taken under rulebook §4.</p>
    ${sl.length ? `<table class="t"><thead><tr><th>Time</th><th>Swap</th><th>Reason</th><th class="r">Slashed</th></tr></thead><tbody>${sl.map(s => `<tr><td class="num muted">${clock(s.at)}</td><td class="num">${s.swap}</td><td>${esc(s.reason)}</td><td class="r num bad">${usd(s.amount)}</td></tr>`).join('')}</tbody></table>` : `<p class="empty">No slashes. To see one, open Swap, turn on "Market maker declines the fill" under Demo controls, and run a swap.</p>`}
  </section>`;
};


// ---------- route a payment: tokenized deposit in, paid out however the recipient can receive ----------
META.route = ['Route a payment', 'Send tokenized deposits to any institution. Deep Lake converts along the way when the recipient needs cash or a stablecoin.'];
NAV[0][1].splice(2, 0, 'route');
const NETS = {
  cosmos: {name: 'Cosmos chain (CTS) · tokenized deposits', short: 'Cosmos', td: true, secs: 6, re: /^[a-z]{2,12}1[0-9a-z]{38,58}$/, hint: 'Starts with a short prefix and 1, for example cosmos1…'},
  ethereum: {name: 'Ethereum · USDC', short: 'Ethereum', secs: 24, re: /^0x[0-9a-fA-F]{40}$/, hint: '0x followed by 40 hex characters'},
  base: {name: 'Base · USDC', short: 'Base', secs: 6, re: /^0x[0-9a-fA-F]{40}$/, hint: '0x followed by 40 hex characters'},
  solana: {name: 'Solana · USDC', short: 'Solana', secs: 4, re: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/, hint: '32 to 44 letters and digits'},
  noble: {name: 'Noble · USDC', short: 'Noble', secs: 6, re: /^noble1[0-9a-z]{38,58}$/, hint: 'Starts with noble1'},
};
const FIAT_RAILS = [['rtp', 'RTP', 0.25, 5], ['fednow', 'FedNow', 0.25, 5], ['wire', 'Fedwire', 18, 120], ['ach', 'ACH', 0.10, 86400]];
const RP_MMS = [{id: 'gsr', name: 'GSR', bps: 1.2, secs: 12}, {id: 'hly', name: 'Halyard Trading', bps: 2.0, secs: 6}, {id: 'mrd', name: 'Meridian OTC', bps: 3.0, secs: 3}];
const RP = {
  amount: 75000, conv: 'gsr', rail: 'rtp', to: 'ricu', playing: false, step: -1, done: false, cur: null, form: null, convs: [], rails: [], seq: 0,
  recipients: [{id: 'ricu', name: 'Rhode Island Credit Union', type: 'Credit union', fiat: true, rails: {rtp: true, fednow: false, wire: true, ach: true}, wallets: [], note: 'Not blockchain-enabled. Receives US dollars in an ordinary account.'}],
};
const RP_LOCK = 6, RP_TARGET = 60, RP_MID = 220;
const rpT = s => s < 60 ? `${s} sec` : s < 3600 ? `${Math.round(s / 60)} min` : 'next day';
const rpTo = () => RP.recipients.find(r => r.id === RP.to);
const rpC = id => RP.convs.find(c => c.id === id), rpR = id => RP.rails.find(r => r.id === id);
const last4 = v => '••' + String(v).slice(-4), shortAddr = a => a.length > 14 ? a.slice(0, 8) + '…' + a.slice(-4) : a;
const spread = (list, tall) => { const n = list.length, h = n <= (tall ? 3 : 4) ? (tall ? 56 : 48) : n <= 5 ? 44 : 38; list.forEach((x, i) => { x.y = n === 1 ? RP_MID : 76 + i * (364 - 76) / (n - 1); x.h = h; }); return list; };
function rpBuild() {
  const R = rpTo();
  const fiat = R.fiat ? FIAT_RAILS.map(([id, name, cost, secs]) => ({id, name, cost, secs, ok: !!R.rails[id], kind: 'fiat'})) : [];
  const chain = R.wallets.map((w, i) => NETS[w.net].td ? {id: 'ibc' + i, name: 'IBC transfer', cost: 0, secs: 6, ok: true, kind: 'ibc', w} : {id: 'usdc' + i, name: `USDC · ${NETS[w.net].short}`, cost: 0.02, secs: NETS[w.net].secs, ok: true, kind: 'usdc', w});
  RP.rails = spread([...chain, ...fiat], false);
  const convs = RP_MMS.map(m => ({...m}));
  if (chain.some(r => r.kind === 'ibc')) convs.unshift({id: 'direct', name: 'No conversion', bps: 0, secs: 0, direct: true});
  RP.convs = spread(convs, true);
  RP.convs.forEach(c => { c.ok = RP.rails.some(r => rpValid(c, r)); });
  if (!rpC(RP.conv) || !rpR(RP.rail) || !rpValid(rpC(RP.conv), rpR(RP.rail))) { const b = rpBest(); RP.conv = b.c.id; RP.rail = b.r.id; }
}
const rpValid = (c, r) => r.ok && (c.direct ? r.kind === 'ibc' : r.kind !== 'ibc');
const rpCalc = (c, r) => { const fee = RP.amount * c.bps / 1e4; return {c, r, fee, total: fee + r.cost, secs: RP_LOCK + c.secs + r.secs}; };
function rpPickBest(pairs) {
  let b = null, any = null;
  const better = (q, x) => !x || q.total < x.total - 1e-9 || (Math.abs(q.total - x.total) < 1e-9 && q.secs < x.secs);
  pairs.forEach(([c, r]) => { if (!rpValid(c, r)) return; const q = rpCalc(c, r); if (better(q, any)) any = q; if (q.secs <= RP_TARGET && better(q, b)) b = q; });
  return b || any;
}
const rpBest = () => rpPickBest(RP.convs.flatMap(c => RP.rails.map(r => [c, r])));
// keep the two choices compatible: a direct transfer has no market maker, every other payout needs one
function rpFix(changed) {
  const c = rpC(RP.conv), r = rpR(RP.rail); if (rpValid(c, r)) return;
  if (changed === 'conv') RP.rail = rpPickBest(RP.rails.map(x => [c, x])).r.id;
  else RP.conv = rpPickBest(RP.convs.map(x => [x, r])).c.id;
}
const rpCurve = (x1, y1, x2, y2) => { const m = (x2 - x1) / 2; return `C${x1 + m},${y1} ${x2 - m},${y2} ${x2},${y2}`; };
const rpPath = (cy, ry) => `M170,${RP_MID}L315,${RP_MID}${rpCurve(315, RP_MID, 485, cy)}L635,${cy}${rpCurve(635, cy, 745, ry)}L875,${ry}${rpCurve(875, ry, 930, RP_MID)}`;
function rpAbout(R) {
  if (R.note) return R.note;
  const bits = [];
  if (R.fiat) bits.push(`Bank account ${last4(R.acct)}, routing ${last4(R.aba)}`);
  R.wallets.forEach(w => bits.push(`${NETS[w.net].short} wallet ${shortAddr(w.addr)}`));
  return bits.join(' · ');
}

function rpFormHtml() {
  const f = RP.form, e = f.err, er = k => e[k] ? `<small class="err">${esc(e[k])}</small>` : '';
  return `<section class="panel" id="rp-form">
    <div class="panel-head"><div><h2>Add a recipient</h2><p class="sub">Say where this institution can be paid: a bank account, a wallet, or both. Each one becomes a route option.</p></div><button class="btn sm" id="rpf-cancel">Cancel</button></div>
    <div class="form-grid">
      <label class="f"><span>Institution name</span><input class="in" id="rpf-name" data-f="name" autocomplete="off" value="${esc(f.name)}">${er('name')}</label>
      <label class="f"><span>Type</span><select class="in" id="rpf-type" data-f="type">${['Bank', 'Credit union', 'Corporate', 'Other'].map(t => `<option ${t === f.type ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    </div>
    <h3 class="fsec">Bank account, for US dollars</h3>
    <div class="form-grid">
      <label class="f"><span>Routing number (ABA)</span><input class="in mono" id="rpf-aba" data-f="aba" inputmode="numeric" maxlength="9" autocomplete="off" placeholder="9 digits" value="${esc(f.aba)}">${er('aba')}</label>
      <label class="f"><span>Account number</span><input class="in mono" id="rpf-acct" data-f="acct" inputmode="numeric" maxlength="17" autocomplete="off" placeholder="4 to 17 digits" value="${esc(f.acct)}">${er('acct')}</label>
    </div>
    <span class="flabel">Rails this account can receive on</span>
    <div class="checks-row">${FIAT_RAILS.map(([id, name]) => `<label class="check"><input type="checkbox" data-fr="${id}" ${f.rails[id] ? 'checked' : ''}><span>${name}</span></label>`).join('')}</div>${er('rails')}
    <h3 class="fsec">Blockchain wallets</h3>
    ${f.wallets.map((w, i) => `<div class="wrow">
      <label class="f"><span>Network and asset</span><select class="in" id="rpf-net${i}" data-wn="${i}">${Object.entries(NETS).map(([k, n]) => `<option value="${k}" ${k === w.net ? 'selected' : ''}>${n.name}</option>`).join('')}</select></label>
      <label class="f"><span>Wallet address</span><input class="in mono" id="rpf-addr${i}" data-wa="${i}" autocomplete="off" spellcheck="false" placeholder="${esc(NETS[w.net].hint)}" value="${esc(w.addr)}">${er('w' + i)}</label>
      <button class="btn sm" data-wx="${i}" aria-label="Remove this wallet">Remove</button>
    </div>`).join('')}
    <button class="btn sm" id="rpf-addw">Add a wallet</button>
    ${er('any')}
    <p class="note">Prototype: these details stay in this browser tab and are gone on reload. Use made-up numbers, not real ones.</p>
    <button class="btn primary" id="rpf-save">Add recipient</button>
  </section>`;
}
function rpValidate() {
  const f = RP.form, e = f.err = {};
  if (!f.name.trim()) e.name = "Enter the institution's name.";
  else if (RP.recipients.some(r => r.name.toLowerCase() === f.name.trim().toLowerCase())) e.name = 'That recipient is already on your list.';
  const fiat = !!(f.aba || f.acct);
  if (fiat) {
    const d = f.aba.split('').map(Number);
    if (!/^\d{9}$/.test(f.aba)) e.aba = 'A routing number has exactly 9 digits.';
    else if ((3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + d[2] + d[5] + d[8]) % 10) e.aba = 'That number fails the routing check digit. Look for a typo.';
    if (!/^\d{4,17}$/.test(f.acct)) e.acct = 'An account number has 4 to 17 digits.';
    if (!Object.values(f.rails).some(Boolean)) e.rails = 'Tick at least one rail this account can receive on.';
  }
  const ws = [];
  f.wallets.forEach((w, i) => { const a = w.addr.trim(); if (!a) return; if (!NETS[w.net].re.test(a)) e['w' + i] = `That is not a ${NETS[w.net].short} address. ${NETS[w.net].hint}.`; else ws.push({net: w.net, addr: a}); });
  if (!fiat && !ws.length && !Object.keys(e).some(k => k[0] === 'w')) e.any = 'Add a bank account or at least one wallet, so there is somewhere to pay.';
  return Object.keys(e).length ? null : {id: 'r' + (++RP.seq), name: f.name.trim(), type: f.type, fiat, aba: f.aba, acct: f.acct, rails: fiat ? {...f.rails} : {}, wallets: ws};
}

VIEWS.route = () => { const R = rpTo(); return `
  <section class="panel">
    <div class="rp-head">
      <div class="rp-party"><span class="flabel">From</span><b>Acme Bank</b><small>Holds tokenized deposits on its own Cosmos chain</small></div>
      <label class="f"><span>Amount (USD)</span><input class="in amount" id="rp-amt" inputmode="decimal" autocomplete="off" value="${RP.amount}"></label>
      <div class="rp-party"><span class="flabel">To</span>
        <div class="rp-to"><select class="in" id="rp-to" aria-label="Recipient">${RP.recipients.map(r => `<option value="${r.id}" ${r.id === RP.to ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select><button class="btn" id="rp-add" ${RP.form ? 'disabled' : ''}>Add recipient</button></div>
        <small>${esc(rpAbout(R))}</small></div>
    </div>
  </section>
  ${RP.form ? rpFormHtml() : ''}
  <section class="panel">
    <div class="panel-head"><div><h2>Route</h2><p class="sub">Deep Lake picks the lowest-cost route that lands within a minute. Drag either handle, or select any box, to take a different path.</p></div><div id="rp-badge" class="rp-badge"></div></div>
    <div class="scroll-x"><svg id="rp-svg" class="rp-svg" viewBox="0 0 1100 420" role="group" aria-label="Payment route from Acme Bank to ${esc(R.name)}"></svg></div>
    <div class="tiles" id="rp-totals"></div>
  </section>
  <section class="panel">
    <div class="panel-head"><div><h2>Steps</h2><p class="sub">What happens, in order, on the route you have chosen.</p></div><button class="btn primary" id="rp-send"></button></div>
    <ol class="rp-steps" id="rp-steps"></ol>
  </section>`; };

function rpBindForm() {
  const f = RP.form, box = $('#rp-form'); if (!f || !box) return;
  box.addEventListener('input', e => { const t = e.target; f.err = {}; const old = t.closest('label')?.querySelector('.err'); if (old) old.remove(); if (t.dataset.f) f[t.dataset.f] = (t.dataset.f === 'aba' || t.dataset.f === 'acct') ? (t.value = t.value.replace(/\D/g, '')) : t.value; else if (t.dataset.wa) f.wallets[t.dataset.wa].addr = t.value; });
  box.addEventListener('change', e => { const t = e.target; if (t.dataset.fr) f.rails[t.dataset.fr] = t.checked; else if (t.dataset.wn) { f.wallets[t.dataset.wn].net = t.value; render(); } });
  box.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.id === 'rpf-cancel') RP.form = null;
    else if (t.id === 'rpf-addw') f.wallets.push({net: 'ethereum', addr: ''});
    else if (t.dataset.wx) f.wallets.splice(Number(t.dataset.wx), 1);
    else if (t.id === 'rpf-save') {
      const rec = rpValidate();
      if (rec) { RP.recipients.push(rec); RP.to = rec.id; RP.form = null; RP.step = -1; RP.done = false; RP.conv = RP.rail = null; toast(`${rec.name} added. Route updated.`); }
      else { render(); const bad = box.ownerDocument.querySelector('#rp-form .err'); if (bad) bad.closest('label, .wrow, section').querySelector('input')?.focus(); return; }
    } else return;
    render();
  });
}

function rpMount() {
  const svg = $('#rp-svg'); if (!svg) return;
  rpBuild(); rpBindForm();
  const R = rpTo();
  RP.cur = {cy: rpC(RP.conv).y, ry: rpR(RP.rail).y};
  const head = (x, t) => `<text class="rp-col" x="${x}" y="22" text-anchor="middle">${t}</text>`;
  const words = R.name.split(' '), l1 = []; while (words.length && (l1.join(' ') + ' ' + words[0]).trim().length <= 18) l1.push(words.shift());
  let line1 = l1.join(' ') || words.shift(), line2 = words.join(' '); if (line2.length > 18) line2 = line2.slice(0, 17) + '…';
  const ny = line2 ? 198 : 206, kind = R.wallets.length ? (R.fiat ? 'Account + wallet' : 'On-chain wallet') : 'No blockchain needed';
  svg.innerHTML = `
    <defs><filter id="rp-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    ${head(95, 'Sender')}${head(315, 'Deep Lake')}${head(560, 'Converts')}${head(810, 'Pays out over')}${head(1010, 'Recipient')}
    <path id="rp-ghost" class="rp-ghost"/><path id="rp-line" class="rp-line" filter="url(#rp-glow)"/><path id="rp-flow" class="rp-flow"/>
    <g class="rp-node fixed"><rect x="20" y="180" width="150" height="80" rx="10"/><text class="n" x="34" y="207">Acme Bank</text><text class="s" x="34" y="226">Cosmos chain · CTS</text><text class="s hi" x="34" y="244" id="rp-out"></text></g>
    <g class="rp-lake"><ellipse cx="315" cy="220" rx="50" ry="34" class="bg"/><ellipse cx="315" cy="220" rx="50" ry="34"/><ellipse cx="315" cy="220" rx="33" ry="22"/><ellipse cx="315" cy="220" rx="15" ry="10"/><text class="s" x="315" y="278" text-anchor="middle">Routes and escrows</text><text class="s hi" x="315" y="295" text-anchor="middle">$0 fee</text></g>
    ${RP.convs.map(c => `<g class="rp-node pick ${c.ok ? '' : 'off'}" ${c.ok ? `data-conv="${c.id}" tabindex="0" role="button" aria-label="${c.direct ? 'Send directly with no conversion' : 'Convert with ' + c.name}"` : ''}><rect x="485" y="${c.y - c.h / 2}" width="150" height="${c.h}" rx="10"/><text class="n" x="499" y="${c.y - 3}">${c.name}</text><text class="s" x="499" y="${c.y + 13}">${c.direct ? 'Bank to bank · $0.00' : usd2(RP.amount * c.bps / 1e4) + ' · ' + rpT(c.secs)}</text></g>`).join('')}
    ${RP.rails.map(r => `<g class="rp-node pick ${r.ok ? '' : 'off'}" ${r.ok ? `data-rail="${r.id}" tabindex="0" role="button" aria-label="Pay out over ${r.name}"` : ''}><rect x="745" y="${r.y - r.h / 2}" width="130" height="${r.h}" rx="10"/><text class="n" x="757" y="${r.y - 3}">${r.name}</text><text class="s" x="757" y="${r.y + 13}">${r.ok ? usd2(r.cost) + ' · ' + rpT(r.secs) : 'Not available'}</text></g>`).join('')}
    <g class="rp-node fixed" id="rp-rcv"><rect x="930" y="172" width="156" height="96" rx="10"/><text class="n" x="944" y="${ny}">${esc(line1)}</text>${line2 ? `<text class="n" x="944" y="215">${esc(line2)}</text>` : ''}<text class="s" x="944" y="234">${kind}</text><text class="s hi" x="944" y="252" id="rp-in"></text></g>
    <g id="rp-lab" class="rp-lab"><rect height="22" rx="11"/><text y="15" text-anchor="middle"></text></g>
    <g id="rp-glab" class="rp-lab ghost"><rect height="22" rx="11"/><text y="15" text-anchor="middle">Optimized</text></g>
    <circle id="rp-dot" class="rp-dot" r="7" style="display:none"/>
    <g class="rp-grip" id="rp-g1" tabindex="0" role="slider" aria-label="Who converts" aria-orientation="vertical"><circle class="halo" r="15"/><circle class="knob" r="8"/>${RP.hinted ? '' : '<text class="rp-hint" y="-20" text-anchor="middle">DRAG</text>'}</g>
    <g class="rp-grip" id="rp-g2" tabindex="0" role="slider" aria-label="How it is paid out" aria-orientation="vertical"><circle class="halo" r="15"/><circle class="knob" r="8"/></g>`;

  const pt = ev => { const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
  const touched = () => { RP.step = -1; RP.done = false; RP.hinted = true; svg.querySelector('.rp-hint')?.remove(); $('#rp-rcv').classList.remove('got'); };
  const glide = () => {
    const from = {...RP.cur}, to = {cy: rpC(RP.conv).y, ry: rpR(RP.rail).y}, t0 = performance.now(), D = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 300;
    const f = now => { const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3); RP.cur.cy = from.cy + (to.cy - from.cy) * e; RP.cur.ry = from.ry + (to.ry - from.ry) * e; rpDraw(); if (k < 1 && $('#rp-svg') === svg) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  };
  const bind = (grip, key, list, prop) => {
    const other = key === 'cy' ? 'ry' : 'cy';
    grip.addEventListener('pointerdown', e => {
      if (RP.playing) return; e.preventDefault(); grip.setPointerCapture(e.pointerId); grip.classList.add('drag'); svg.classList.add('dragging');
      const move = ev => { const y = Math.max(56, Math.min(384, pt(ev).y)); RP.cur[key] = y; const near = list().reduce((a, b) => Math.abs(b.y - y) < Math.abs(a.y - y) ? b : a); if (RP[prop] !== near.id) { RP[prop] = near.id; rpFix(prop); RP.cur[other] = other === 'cy' ? rpC(RP.conv).y : rpR(RP.rail).y; touched(); rpInfo(); } rpDraw(); };
      const up = () => { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up); grip.classList.remove('drag'); svg.classList.remove('dragging'); glide(); };
      grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
    });
    grip.addEventListener('keydown', e => {
      if (RP.playing || !['ArrowUp', 'ArrowDown'].includes(e.key)) return; e.preventDefault();
      const l = list(), i = l.findIndex(x => x.id === RP[prop]), n = l[Math.max(0, Math.min(l.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
      RP[prop] = n.id; rpFix(prop); touched(); rpInfo(); glide();
    });
  };
  bind($('#rp-g1'), 'cy', () => RP.convs.filter(c => c.ok), 'conv');
  bind($('#rp-g2'), 'ry', () => RP.rails.filter(r => r.ok), 'rail');
  const choose = el => { if (RP.playing) return; if (el.dataset.conv) { RP.conv = el.dataset.conv; rpFix('conv'); } else { RP.rail = el.dataset.rail; rpFix('rail'); } touched(); rpInfo(); glide(); };
  svg.querySelectorAll('[data-conv],[data-rail]').forEach(el => {
    el.addEventListener('click', () => choose(el));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(el); } });
  });
  $('#rp-amt').addEventListener('change', e => { const n = Number(e.target.value.replace(/[^0-9.]/g, '')); if (!(n > 0)) { toast('Enter an amount above zero.'); e.target.value = RP.amount; return; } RP.amount = n; touched(); render(); });
  $('#rp-to').addEventListener('change', e => { if (RP.playing) { e.target.value = RP.to; return; } RP.to = e.target.value; RP.conv = RP.rail = null; touched(); render(); });
  $('#rp-add').addEventListener('click', () => { RP.form = {name: '', type: 'Bank', aba: '', acct: '', rails: {rtp: true, fednow: true, wire: true, ach: true}, wallets: [{net: 'cosmos', addr: ''}], err: {}}; render(); const n = $('#rpf-name'); if (n) { n.focus(); n.scrollIntoView({block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}); } });
  $('#rp-send').addEventListener('click', rpPlay);
  $('#rp-badge').addEventListener('click', e => { if (e.target.closest('button') && !RP.playing) { const b = rpBest(); RP.conv = b.c.id; RP.rail = b.r.id; touched(); rpInfo(); glide(); } });
  rpDraw(); rpInfo();
}

function rpDraw() {
  const {cy, ry} = RP.cur, b = rpBest(), isBest = b && b.c.id === RP.conv && b.r.id === RP.rail;
  const d = rpPath(cy, ry); $('#rp-line').setAttribute('d', d); $('#rp-flow').setAttribute('d', d);
  const ghost = $('#rp-ghost'), glab = $('#rp-glab'), showGhost = b && (!isBest || Math.abs(cy - b.c.y) > 1 || Math.abs(ry - b.r.y) > 1);
  ghost.style.display = glab.style.display = showGhost ? '' : 'none';
  if (b) ghost.setAttribute('d', rpPath(b.c.y, b.r.y));
  $('#rp-g1').setAttribute('transform', `translate(468,${cy})`); $('#rp-g2').setAttribute('transform', `translate(728,${ry})`);
  const place = (g, x, y, txt) => { const t = g.querySelector('text'), r = g.querySelector('rect'); if (txt) t.textContent = txt; const w = t.textContent.length * 6.6 + 22; r.setAttribute('width', w); r.setAttribute('x', -w / 2); g.setAttribute('transform', `translate(${x},${y})`); };
  const spot = y => y > RP_MID + 60 ? [452, (RP_MID + y) / 2 - 34] : [400, (RP_MID + y) / 2 - 32];
  place($('#rp-lab'), ...spot(cy), isBest ? 'OPTIMIZED ROUTE' : 'YOUR ROUTE');
  if (b) { if (b.c.id === RP.conv) place(glab, 690, (b.c.y + b.r.y) / 2 - 18); else place(glab, ...spot(b.c.y)); }
  $('#rp-lab').classList.toggle('mine', !isBest);
  document.querySelectorAll('#rp-svg [data-conv]').forEach(el => el.classList.toggle('on', el.dataset.conv === RP.conv));
  document.querySelectorAll('#rp-svg [data-rail]').forEach(el => el.classList.toggle('on', el.dataset.rail === RP.rail));
}

const rpUnit = r => r.kind === 'usdc' ? ' USDC' : r.kind === 'ibc' ? ' in tokenized deposits' : '';
function rpInfo() {
  const q = rpCalc(rpC(RP.conv), rpR(RP.rail)), b = rpBest(), isBest = b.c.id === RP.conv && b.r.id === RP.rail, R = rpTo();
  const dc = q.total - b.total, dt = q.secs - b.secs, late = q.secs > RP_TARGET;
  const gap = s => { s = Math.abs(s); return s < 60 ? `${s} sec` : s < 3600 ? `${Math.round(s / 60)} min` : 'about a day'; };
  const costTxt = Math.abs(dc) < 0.005 ? 'Same cost' : dc > 0 ? `${usd2(dc)} more` : `${usd2(-dc)} less`;
  const timeTxt = late ? `misses the one-minute target (${rpT(q.secs)})` : dt === 0 ? 'same speed' : dt < 0 ? `${gap(dt)} faster` : `${gap(dt)} slower`;
  $('#rp-badge').innerHTML = isBest ? '<span class="chip good">Optimized route</span>' : `<span class="chip warn">Your route · ${costTxt}, ${timeTxt}</span><button class="btn sm">Back to optimized</button>`;
  $('#rp-g1').setAttribute('aria-valuetext', q.c.name); $('#rp-g2').setAttribute('aria-valuetext', q.r.name);
  $('#rp-out').textContent = `${Math.round(RP.amount).toLocaleString('en-US')} tdACME`;
  $('#rp-in').textContent = `Gets ${usd2(RP.amount - q.total)}`;
  const where = q.r.kind === 'usdc' ? `USDC in its ${NETS[q.r.w.net].short} wallet · not insured` : q.r.kind === 'ibc' ? `A tokenized deposit at ${R.name}` : `US dollars at ${R.name}`;
  $('#rp-totals').innerHTML = `
    <div class="tile"><span>All-in cost</span><b>${usd2(q.total)}</b><em>${bpsOf(q.total, RP.amount).toFixed(2)} bps · ${isBest ? (b.secs <= RP_TARGET ? 'lowest that lands in a minute' : 'lowest available') : costTxt.toLowerCase() + ' than optimized'}</em></div>
    <div class="tile ${late ? 'brass' : ''}"><span>Arrives in</span><b>${q.secs < 3600 ? rpT(q.secs) : 'Next business day'}</b><em>${isBest ? (q.c.direct ? 'Chain to chain' : 'Chain, conversion and payout') : late ? 'Misses the one-minute target' : dt === 0 ? 'Same as optimized' : gap(dt) + (dt < 0 ? ' faster' : ' slower') + ' than optimized'}</em></div>
    <div class="tile"><span>Recipient gets</span><b>${usd2(RP.amount - q.total)}</b><em>${esc(where)}</em></div>
    <div class="tile"><span>Deep Lake fee</span><b>$0</b><em>${q.c.direct ? 'No market maker on this route' : esc(q.c.name) + ' sets its own fee'}</em></div>`;
  rpSteps();
}

function rpSteps() {
  const q = rpCalc(rpC(RP.conv), rpR(RP.rail)), b = rpBest(), isBest = b.c.id === RP.conv && b.r.id === RP.rail, R = rpTo(), amt = Math.round(RP.amount).toLocaleString('en-US');
  const c = q.c, r = q.r, got = usd2(RP.amount - q.total), total = q.secs < 3600 ? `${rpT(q.secs)} total` : 'Next business day';
  const why = isBest ? (b.secs <= RP_TARGET ? 'The lowest-cost route that lands within a minute.' : 'The lowest-cost route this recipient can take.') : 'The path Acme chose. Deep Lake carries it the same way.';
  const lock = ['Acme Bank locks its tokenized deposit', `${amt} tdACME leaves Acme's Cosmos chain over IBC and locks in Deep Lake escrow.`, `${RP_LOCK} sec`];
  let rows;
  if (r.kind === 'ibc') rows = [lock,
    [`Deep Lake routes straight to ${R.name}`, `${R.name} is on a Cosmos chain, so no market maker is needed. ${why}`, '$0.00'],
    ['No conversion', 'The money stays a bank deposit the whole way. Nothing is swapped.', '$0.00 · 0 sec'],
    ['IBC carries the transfer', `${R.name} issues ${amt} of its own tokenized deposit to ${shortAddr(r.w.addr)}. The two banks settle net.`, `${usd2(r.cost)} · ${rpT(r.secs)}`],
    ['Escrow releases', `Both chains confirm, and escrow retires the ${amt} tdACME. If either side fails, the tokens return to Acme.`, 'Atomic'],
    [`${R.name} has the money`, `${got} sits as an insured tokenized deposit on its own chain.`, total]];
  else if (r.kind === 'usdc') rows = [lock,
    [`Deep Lake routes to ${c.name}`, why, '$0.00'],
    [`${c.name} converts to USDC`, `${c.name} takes the tokenized deposit and puts USDC into escrow at ${c.bps.toFixed(1)} bps.`, `${usd2(q.fee)} · ${rpT(c.secs)}`],
    [`USDC lands on ${NETS[r.w.net].short}`, `${got} USDC goes to wallet ${shortAddr(r.w.addr)}.`, `${usd2(r.cost)} · ${rpT(r.secs)}`],
    ['Escrow releases', `Both legs are on-chain, so they release in the same instant: USDC to ${R.name}, ${amt} tdACME to ${c.name}.`, 'Atomic'],
    [`${R.name} has the money`, `${got} USDC sits in its wallet. A stablecoin is not an insured deposit.`, total]];
  else rows = [lock,
    [`Deep Lake routes to ${c.name}`, why, '$0.00'],
    [`${c.name} converts to cash`, `${c.name} takes the tokenized deposit and funds the dollar payout at ${c.bps.toFixed(1)} bps.`, `${usd2(q.fee)} · ${rpT(c.secs)}`],
    [`${r.name} delivers the dollars`, `${c.name}'s bank sends ${got} to ${R.name}${R.acct ? ', account ' + last4(R.acct) : ''} over ${r.name}.`, `${usd2(r.cost)} · ${rpT(r.secs)}`],
    ['Escrow releases', r.secs > 60 ? `${c.name} pre-funds the payout, so escrow releases ${amt} tdACME without waiting on ${r.name}.` : `${r.name} confirms, and escrow releases ${amt} tdACME to ${c.name}. If the payout fails, the tokens return to Acme.`, 'Atomic'],
    [`${R.name} has the money`, `${got} sits in an ordinary account. ${R.name} never touches a blockchain.`, total]];
  $('#rp-steps').innerHTML = rows.map((x, i) => `<li class="${RP.done || i < RP.step ? 'done' : i === RP.step ? 'now' : ''}"><div><b>${esc(x[0])}</b><small>${esc(x[1])}</small></div><span class="num">${x[2]}</span></li>`).join('');
  const btn = $('#rp-send'); btn.disabled = RP.playing;
  btn.textContent = RP.playing ? 'Sending…' : `${RP.done ? 'Send again' : 'Send'} ${usd(RP.amount)}`;
}

function rpPlay() {
  if (RP.playing) return;
  const line = $('#rp-line'), dot = $('#rp-dot'), svg = $('#rp-svg'), q = rpCalc(rpC(RP.conv), rpR(RP.rail)), R = rpTo();
  const finish = () => { RP.playing = false; RP.done = true; RP.step = 6; dot.style.display = 'none'; svg.classList.remove('playing'); if ($('#rp-steps')) rpSteps(); if (svg.isConnected) { $('#rp-rcv').classList.add('got'); if (!matchMedia('(prefers-reduced-motion: reduce)').matches) [0, 220, 440].forEach(d => setTimeout(() => { const c = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse'); c.setAttribute('class', 'rp-ring'); c.setAttribute('cx', 1008); c.setAttribute('cy', 220); c.setAttribute('rx', 96); c.setAttribute('ry', 62); svg.appendChild(c); setTimeout(() => c.remove(), 1600); }, d)); } toast(`${R.name} received ${usd2(RP.amount - q.total)}${rpUnit(q.r)}`); };
  RP.playing = true; RP.done = false; RP.step = 0; svg.classList.add('playing'); rpSteps();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return finish();
  const L = line.getTotalLength(), T = 5200, t0 = performance.now();
  const f = now => {
    if (!document.body.contains(line)) { RP.playing = false; RP.step = -1; return; }
    const k = Math.min(1, (now - t0) / T), p = line.getPointAtLength(L * k);
    dot.style.display = ''; dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y);
    const st = p.x < 300 ? 0 : p.x < 480 ? 1 : p.x < 640 ? 2 : p.x < 925 ? 3 : 4;
    if (st !== RP.step) { RP.step = st; rpSteps(); }
    if (k < 1) requestAnimationFrame(f);
    else { RP.step = 4; rpSteps(); setTimeout(() => { RP.step = 5; if ($('#rp-steps')) rpSteps(); setTimeout(finish, 650); }, 650); }
  };
  requestAnimationFrame(f);
}

// ---------- render ----------
function render() {
  const [title, sub] = META[S.view];
  $('#nav').innerHTML = NAV.map(([g, ids]) => `<div class="nav-group">${g}</div>${ids.map(id => `<a href="#${id}" ${id === S.view ? 'aria-current="page"' : ''}>${META[id][0]}${id === 'settlements' ? `<small>${S.settlements.length}</small>` : id === 'channels' ? `<small>${CHANNELS.length}</small>` : ''}</a>`).join('')}`).join('');
  $('#top').innerHTML = `<div><h1>${title}</h1><p>${sub}</p></div><div class="who"><span class="chip good">${S.view === 'desk' ? mmOf(S.mmView).name + ' · bond in escrow' : (S.view === 'route' ? 'Acme Bank' : ME.name) + ' · CTS license active'}</span><span class="chip warn plain">Simulated data</span></div>`;
  const act = document.activeElement, fid = act && act.id, pos = act && act.selectionStart;
  const v = $('#view'); const same = v.dataset.view === S.view;
  v.innerHTML = VIEWS[S.view](); v.dataset.view = S.view;
  if (same) v.style.animation = 'none'; else { v.style.animation = ''; countUp(v); }
  if (S.view === 'route') rpMount();
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus(); if (pos != null && el.setSelectionRange && el.type === 'text') try { el.setSelectionRange(pos, pos); } catch (e) {} } }
  document.title = `${title} · Deep Lake`;
}
function countUp(root) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  root.querySelectorAll('b[data-n]').forEach(el => {
    const to = Number(el.dataset.n), end = el.textContent, t0 = performance.now();
    const f = now => { if (!el.isConnected) return; const k = Math.min(1, (now - t0) / 750), e = 1 - Math.pow(1 - k, 3); el.textContent = k < 1 ? short(Math.round(to * e / 1e5) * 1e5) : end; if (k < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
}
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3600);
}
function go() {
  const h = location.hash.slice(1); S.view = VIEWS[h] ? h : 'overview';
  render(); if (matchMedia('(max-width:820px)').matches) scrollTo(0, 0);
}

// ---------- events ----------
function fixReq() {
  const r = S.req;
  if (!networks(r).find(n => n.id === r.network).ok) r.network = 'deeplake';
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const a = el.dataset.act, r = S.req;
  if (a === 'amt') r.amountText = el.dataset.v;
  else if (a === 'flip') { [r.from, r.to] = [r.to, r.from]; r.pick = null; }
  else if (a === 'mode') { r.mode = el.dataset.v; r.pick = null; }
  else if (a === 'pref') r.pref = el.dataset.v;
  else if (a === 'pick') r.pick = el.dataset.id;
  else if (a === 'net') r.network = el.dataset.v;
  else if (a === 'exec') return execute();
  else if (a === 'new') S.run = null;
  else if (a === 'open') { S.open = el.dataset.id; if (S.view !== 'settlements') { location.hash = 'settlements'; return; } render(); scrollTo({top: 0, behavior: 'smooth'}); return; }
  else if (a === 'close') S.open = null;
  else if (a === 'csv') return csv();
  else if (a === 'pause') { const c = CHANNELS.find(c => c.id === el.dataset.id); c.paused = !c.paused; toast(c.paused ? 'Channel paused. Banks no longer see it as open.' : 'Channel resumed.'); }
  else if (a === 'topup') { const m = mmOf(S.mmView), add = Math.max(0, bondNeed(m) - m.bond); m.bond += add; toast(`Posted ${usd(add)} of bond`); }
  else if (a === 'post') {
    const cap = Number($('#np-cap').value.replace(/[^0-9.]/g, '')), bps = Number($('#np-bps').value);
    if (!(cap > 0) || !(bps >= 0)) return toast('Enter a capacity above zero and a fee of zero or more.');
    const hours = $('#np-hours').value;
    CHANNELS.push({id: 'c' + (++chSeq), mm: S.mmView, pair: $('#np-pair').value, bps, cap, avail: cap, hours, open: true, secs: 8});
    toast('Channel posted');
  }
  fixReq(); render();
});
document.addEventListener('toggle', e => { if (e.target.matches && e.target.matches('details.demo')) S.demoOpen = e.target.open; }, true);
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('tr.rowlink')) e.target.click(); });
document.addEventListener('input', e => {
  const k = e.target.dataset.in; if (!k) return;
  S.req[k] = e.target.value; render();
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.ch) { S.req[t.dataset.ch] = t.value; S.req.pick = null; if (S.req.from === S.req.to) S.req.to = S.req.from === 'usdc' ? 'td_own' : 'usdc'; fixReq(); render(); }
  else if (t.dataset.tg) { S.req[t.dataset.tg] = t.checked; render(); }
  else if ('mm' in t.dataset) { S.mmView = t.value; render(); }
  else if (t.dataset.edit) {
    const c = CHANNELS.find(c => c.id === t.dataset.id), n = Number(t.value.replace(/[^0-9.]/g, ''));
    if (!isFinite(n) || n < 0 || (t.dataset.edit === 'cap' && n <= 0)) { toast('Enter a number above zero.'); return render(); }
    if (t.dataset.edit === 'bps') c.bps = n; else { const used = c.cap - c.avail; c.cap = n; c.avail = Math.max(0, n - used); }
    toast(t.dataset.edit === 'bps' ? `Fee set to ${n} bps` : `Capacity set to ${usd(n)}`); render();
  }
});
function csv() {
  const rows = [['swap_id', 'time', 'from', 'to', 'amount_usd', 'route', 'picked_by', 'network', 'fiat_rail', 'mm_fee_usd', 'rail_cost_usd', 'deep_lake_fee_usd', 'status']];
  S.settlements.forEach(s => rows.push([s.id, s.at.toISOString(), ASSETS[s.from].sym, ASSETS[s.to].sym, s.amount, s.via, s.mode === 'pick' ? 'bank' : 'deep_lake', s.network, s.rail || '', s.fee.toFixed(2), s.railCost.toFixed(2), '0.00', s.status]));
  const blob = new Blob([rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')], {type: 'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'deep-lake-reconciliation.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast('Reconciliation file downloaded');
}

// market makers recycle inventory: drained channels refill toward their committed capacity
setInterval(() => {
  let moved = false;
  CHANNELS.forEach(c => { if (c.avail < c.cap) { c.avail = Math.min(c.cap, c.avail + c.cap * 0.25); moved = true; } });
  if (moved && (S.view === 'overview' || S.view === 'channels')) render();
}, 4000);

addEventListener('hashchange', go);
go();
})();
