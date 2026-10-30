import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Premium redesign (2026-10-30): the conversion work must keep the compliance
 * copy Razorpay approved, stay honest, and keep heavy widgets out of the
 * first-load bundle.
 */

const SRC = join(import.meta.dirname, "..", "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

const PREMIUM = read("app/(site)/premium/page.tsx");
const CHECKOUT = read("app/(site)/premium/checkout/page.tsx");

test("the no-refund notice and legal links stay on the Premium page and at checkout", () => {
  for (const page of [PREMIUM, CHECKOUT]) {
    assert.match(page, /Digital product\. All sales are final\. No refunds\./);
    for (const href of ["/terms", "/refund-policy", "/privacy"]) assert.ok(page.includes(`href="${href}"`), href);
  }
  assert.ok(PREMIUM.includes('href="/contact"'));
});

test("both pages show the payment methods and trust points", () => {
  for (const page of [PREMIUM, CHECKOUT]) {
    assert.match(page, /<PaymentBadges /);
    assert.match(page, /<TrustPoints /);
  }
  const trust = read("components/premium/trust.tsx");
  for (const m of ["UPI", "Cards", "Netbanking", "Crypto"]) assert.ok(trust.includes(`label: "${m}"`), m);
});

test("conversion copy is honest: no ratings, member counts or countdowns", () => {
  const files = [
    "app/(site)/premium/page.tsx",
    "components/premium/trust.tsx",
    "components/premium/cta-band.tsx",
    "components/premium/unlock-preview.tsx",
    "components/premium/welcome-screen.tsx",
    "components/premium/plan-cards.tsx",
  ].map(read);
  for (const f of files) {
    assert.doesNotMatch(f, /\b\d[\d,.]*\+?\s*(happy\s+)?(members|users|customers|buyers)\b/i);
    assert.doesNotMatch(f, /★|\b\d(\.\d)?\s*\/\s*5\b|stars?\b/i);
    assert.doesNotMatch(f, /offer ends|limited time|hurry|countdown\(/i);
  }
});

test("new Premium surfaces never link the community group or add messaging", () => {
  for (const p of ["components/premium/cta-band.tsx", "components/premium/welcome-screen.tsx", "components/premium/unlock-preview.tsx"]) {
    const f = read(p);
    assert.doesNotMatch(f, /Unique_One_Chat|\/chat\b|comments?/i, p);
  }
});

test("search, mobile menu and toaster load after hydration, not in the first bundle", () => {
  const header = read("components/site/header.tsx");
  const layout = read("app/layout.tsx");
  assert.doesNotMatch(header, /from "@\/components\/site\/(search-dialog|mobile-nav)"/);
  assert.match(header, /LazySearchDialog/);
  assert.match(header, /LazyMobileNav/);
  assert.doesNotMatch(layout, /from "sonner"/);
  assert.match(layout, /LazyToaster/);
});
