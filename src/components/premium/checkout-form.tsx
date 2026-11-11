"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Check, Loader2, Search, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { PLANS, PLAN_KEYS, type PlanKey } from "@/lib/premium-plans";
import { MIN_SEARCH_LENGTH, normalizeQuery, POPULAR_COINS, type CheckoutCoin } from "@/lib/coins";
import { createCheckoutAction } from "@/server/actions/premium";
import { safeAction } from "@/lib/safe-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 250;

function CoinLogo({ coin }: { coin: CheckoutCoin }) {
  const [failed, setFailed] = React.useState(false);
  if (!coin.logoUrl || failed) {
    return (
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[0.65rem] font-bold text-muted-foreground"
      >
        {coin.symbol.slice(0, 4)}
      </span>
    );
  }
  return (
    // Provider-hosted SVG, fixed size so rows never shift while logos load.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={coin.logoUrl}
      alt=""
      width={32}
      height={32}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-8 w-8 shrink-0 rounded-full"
    />
  );
}

function CoinRow({ coin, active, onSelect }: { coin: CheckoutCoin; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-control border bg-card p-3 text-left text-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-gold/60 bg-gold-soft/40" : "border-border hover:border-primary/40"
      )}
    >
      <CoinLogo coin={coin} />
      <span className="min-w-0 flex-1">
        <span className="block truncate">
          <span className="font-semibold">{coin.symbol}</span>
          <span className="text-muted-foreground"> · {coin.name}</span>
        </span>
        <span className="block truncate text-xs text-muted-foreground">{coin.network}</span>
      </span>
      {active && <Check className="h-4 w-4 shrink-0 text-gold-ink" aria-hidden />}
    </button>
  );
}

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; coins: CheckoutCoin[] }
  | { status: "error"; message: string };

/** Search state tagged with the plan+query it answers, so a stale answer is never read as current. */
type KeyedState = { key: string; state: SearchState };

/**
 * Coin search against /api/premium/coins. The server returns only coins that
 * work for the plan, so nothing here decides availability; results are cached
 * per plan+query for the life of the page, and a newer keystroke aborts the
 * request it replaces.
 */
function useCoinSearch(plan: PlanKey, query: string): SearchState {
  const q = normalizeQuery(query);
  const key = `${plan}:${q}`;
  const [current, setCurrent] = React.useState<KeyedState>({ key: "", state: { status: "idle" } });
  const cache = React.useRef(new Map<string, CheckoutCoin[]>());

  React.useEffect(() => {
    if (q.length < MIN_SEARCH_LENGTH) {
      setCurrent({ key, state: { status: "idle" } });
      return;
    }
    const hit = cache.current.get(key);
    if (hit) {
      setCurrent({ key, state: { status: "done", coins: hit } });
      return;
    }
    setCurrent({ key, state: { status: "loading" } });
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/premium/coins?plan=${plan}&q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
          cache: "no-store",
        });
        const body = (await res.json().catch(() => ({}))) as { coins?: CheckoutCoin[]; error?: string };
        if (!res.ok) throw new Error(body.error || "Search failed. Please try again.");
        const coins = body.coins ?? [];
        cache.current.set(key, coins);
        setCurrent({ key, state: { status: "done", coins } });
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setCurrent({ key, state: { status: "error", message: err instanceof Error ? err.message : "Search failed. Please try again." } });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [plan, q, key]);

  // Until the effect has caught up with a new plan or query, the previous
  // answer belongs to something else: report it as loading, never as current.
  if (current.key !== key) return q.length < MIN_SEARCH_LENGTH ? { status: "idle" } : { status: "loading" };
  return current.state;
}

export function CheckoutForm({
  initialPlan,
  coinsByPlan,
  configured,
  returnPath = null,
}: {
  initialPlan: PlanKey;
  coinsByPlan: Record<PlanKey, CheckoutCoin[]>;
  configured: boolean;
  /** Validated on the server again before it is stored. */
  returnPath?: string | null;
}) {
  const [plan, setPlan] = React.useState<PlanKey>(initialPlan);
  const [coin, setCoin] = React.useState<CheckoutCoin | null>(() => coinsByPlan[initialPlan][0] ?? null);
  const [query, setQuery] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const search = useCoinSearch(plan, query);
  const popular = coinsByPlan[plan];

  // Set when a plan switch leaves a searched coin unconfirmed for the new plan.
  const [recheck, setRecheck] = React.useState(false);

  function choosePlan(p: PlanKey) {
    if (p === plan) return;
    setPlan(p);
    setError("");
    // Each plan has its own list. Keep the chosen coin only if the new plan
    // lists it; a coin from search is re-checked against the new plan's results.
    if (!coin || coinsByPlan[p].some((c) => c.ticker === coin.ticker)) return;
    if ((POPULAR_COINS as readonly string[]).includes(coin.ticker)) setCoin(coinsByPlan[p][0] ?? null);
    else setRecheck(true);
  }

  React.useEffect(() => {
    if (!recheck || search.status === "loading") return;
    const stillListed = search.status === "done" && search.coins.some((c) => c.ticker === coin?.ticker);
    if (!stillListed) setCoin(coinsByPlan[plan][0] ?? null);
    setRecheck(false);
  }, [recheck, search, coin, coinsByPlan, plan]);

  async function pay() {
    if (!coin) return;
    setBusy(true);
    setError("");
    const res = await safeAction(() => createCheckoutAction(plan, coin.ticker, returnPath), "checkout");
    if (res.ok && "invoiceUrl" in res) {
      // Hand off to the provider's hosted page; it returns to /premium/success.
      window.location.assign(res.invoiceUrl);
      return;
    }
    setBusy(false);
    const message = "error" in res ? res.error : "Something went wrong.";
    setError(message);
    toast.error(message);
  }

  if (!configured || (coinsByPlan.MONTHLY.length === 0 && coinsByPlan.YEARLY.length === 0)) {
    return (
      <div className="flex items-start gap-3 rounded-card border border-warning/30 bg-warning-soft p-5 text-sm text-warning">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <p>
          Crypto checkout is temporarily unavailable. Please try again in a few minutes, or contact{" "}
          <Link href="/premium/support" className="font-medium underline underline-offset-2">
            Premium Purchase Support
          </Link>{" "}
          to pay another way.
        </p>
      </div>
    );
  }

  const q = normalizeQuery(query);

  return (
    <div className="space-y-8">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold">1. Plan</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {PLAN_KEYS.map((key) => {
            const p = PLANS[key];
            const active = plan === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => choosePlan(key)}
                className={cn(
                  "glass-card relative rounded-card p-4 text-left transition-[border-color,box-shadow] duration-300",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "edge-gold" : "hover:border-primary/40"
                )}
              >
                <span className="flex items-center justify-between">
                  <span className="font-semibold">{p.name}</span>
                  {active && <Check className="h-4 w-4 text-gold-ink" aria-hidden />}
                </span>
                <span className="mt-1 block text-2xl font-extrabold">
                  ${p.priceUsd}
                  <span className="text-sm font-normal text-muted-foreground"> / {p.periodLabel}</span>
                </span>
                {p.badge && <span className="mt-1 block text-xs font-semibold text-gold-ink">{p.badge}</span>}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-semibold">2. Coin</legend>
        <p className="mb-3 text-xs text-muted-foreground">
          Every coin listed works for a ${PLANS[plan].priceUsd} payment right now.
        </p>

        {popular.length > 0 ? (
          <div className="grid gap-2" aria-label="Popular coins">
            {popular.map((c) => (
              <CoinRow key={c.ticker} coin={c} active={coin?.ticker === c.ticker} onSelect={() => setCoin(c)} />
            ))}
          </div>
        ) : (
          <p className="rounded-control border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            None of the popular coins can take a ${PLANS[plan].priceUsd} payment right now. Try searching below.
          </p>
        )}

        <div className="mt-5">
          <label htmlFor="coin-search" className="mb-2 block text-sm font-medium">
            Search coin
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="coin-search"
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={40}
              placeholder="e.g. doge, bnb, polygon"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden"
              aria-describedby="coin-search-status"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-1.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>

          <div id="coin-search-status" aria-live="polite" className="mt-3">
            {q.length > 0 && q.length < MIN_SEARCH_LENGTH && (
              <p className="text-xs text-muted-foreground">Type at least {MIN_SEARCH_LENGTH} characters.</p>
            )}
            {search.status === "loading" && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Checking coins for the {PLANS[plan].name.toLowerCase()} plan…
              </p>
            )}
            {search.status === "error" && <p className="text-sm text-destructive">{search.message}</p>}
            {search.status === "done" && search.coins.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No other coin matching &ldquo;{q}&rdquo; works for a ${PLANS[plan].priceUsd} payment.
              </p>
            )}
          </div>
          {search.status === "done" && search.coins.length > 0 && (
            <div className="mt-1 grid gap-2" aria-label="Search results">
              {search.coins.map((c) => (
                <CoinRow key={c.ticker} coin={c} active={coin?.ticker === c.ticker} onSelect={() => setCoin(c)} />
              ))}
            </div>
          )}
        </div>

        <p className="mt-5 text-sm text-muted-foreground">
          Can&apos;t find your coin?{" "}
          <Link href="/premium/support" className="font-medium text-primary underline underline-offset-2">
            Contact Premium Purchase Support.
          </Link>
        </p>
      </fieldset>

      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <Button
        size="lg"
        variant="accent"
        className="bg-gold w-full shadow-gold"
        disabled={!coin || busy}
        onClick={pay}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowRight className="h-4 w-4" aria-hidden />}
        {coin ? `Pay $${PLANS[plan].priceUsd} with ${coin.symbol}` : "Choose a coin"}
      </Button>
      {coin && (
        <p className="-mt-5 text-center text-xs text-muted-foreground">
          {coin.symbol} on {coin.network}
        </p>
      )}
    </div>
  );
}
