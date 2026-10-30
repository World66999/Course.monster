import { NO_REFUND_NOTICE } from "@/lib/premium-plans";

/**
 * Legal page copy (Markdown). Rendered by the dedicated routes under
 * src/app/(site)/{terms,privacy,refund-policy,copyright}. The only contact
 * these pages ever give is the support Telegram handle passed in.
 */

export const LEGAL_UPDATED = new Date(Date.UTC(2026, 9, 29));

export interface Contact {
  handle: string;
  url: string;
}

function contactLine(c: Contact | null, capital = false): string {
  const verb = capital ? "Message" : "message";
  return c ? `${verb} us on Telegram at **[${c.handle}](${c.url})**` : `${verb} us on Telegram`;
}

export function termsContent(c: Contact | null): string {
  return `By accessing or using Courses Monster — the website and its Telegram bot (together, "the service") — you agree to these Terms & Conditions. If you do not agree, please do not use the service.

## 1. What we provide

Courses Monster is an educational discovery platform. It lists learning resources and provides links that lead to content hosted on third-party platforms. The site does not host course video files itself; downloads take place on external services that have their own terms and policies.

## 2. Your account

- You are responsible for keeping your sign-in details safe and for everything done with your account.
- One account per person. Accounts may not be shared, sold or transferred.
- We may suspend or close accounts that break these terms.

## 3. Premium membership

- Premium is a **digital membership** that unlocks extra features (such as instant downloads, Premium courses and resources, private members' Telegram groups and priority support) for the period you buy: one month or one year.
- Prices are set in US dollars. When you pay with UPI, card or netbanking, the amount is charged in Indian rupees (INR) at the price shown before you pay.
- Payments are one-off. Nothing renews automatically. Renewing adds the new period on top of any time you have left.
- Premium is activated automatically once the payment provider confirms your payment. It is personal to your account and may not be shared or resold.
- Features may change over time as the service evolves.

## 4. Payments

- UPI, card and netbanking payments are processed by **Razorpay**. Crypto payments are processed by **NOWPayments**.
- We never receive or store your card number, UPI ID or bank details; these are handled by the payment provider under its own terms and privacy policy.
- Any fees charged by your bank or wallet are your responsibility.

## 5. No refunds

**${NO_REFUND_NOTICE}** Once a payment is completed, it cannot be refunded, cancelled or exchanged. Please read the [Refund Policy](/refund-policy) before you buy.

## 6. Acceptable use

You agree not to:

- use bots, scrapers or other automation to access the service or its download flow;
- attempt to bypass human verification, rate limits or other protections;
- share, resell or publish Premium-only content or access;
- attempt to access the administration area or other users' data;
- open fraudulent payment disputes or chargebacks;
- use the service for any unlawful purpose.

We may suspend or end access, including Premium access, for any breach of these terms, without refund.

## 7. Intellectual property

Credit for all course materials belongs to their original creators, instructors, publishers and providers. Rights holders can request removal of content at any time — see our [Copyright & DMCA policy](/copyright).

## 8. No warranty and limitation of liability

The service is provided "as is" without warranties of any kind. We do not guarantee that any listed resource remains available, accurate or complete, and we are not responsible for the content, availability or policies of external websites. To the fullest extent permitted by law, our total liability for any claim relating to the service is limited to the amount you paid us in the three months before the claim.

## 9. Changes

We may update these terms from time to time. The date at the top of this page shows the latest revision. Continued use of the service after a change means you accept the updated terms.

## 10. Contact

Questions about these terms? ${contactLine(c, true)}.`;
}

export function privacyContent(c: Contact | null): string {
  return `This policy explains what data Courses Monster collects, why, and how it is protected. The short version: we collect as little as we can, we never sell it, and we never see your card or UPI details.

## What we collect

- **Account details.** If you create an account, we store your display name and the email address you sign in with (or your Google sign-in identity), and your password only as a one-way bcrypt hash. Your email is used to sign you in and to send sign-in codes — it is never shown publicly.
- **Telegram link (optional).** If you connect Telegram, we store your Telegram user ID and public username so the bot can send you payment confirmations, reminders and support replies.
- **Premium payments.** For each payment we keep only: your internal user ID, your Telegram ID (for bot purchases), the plan, the payment provider's order and payment IDs, the amount, the currency, the status and the time. **We do not store card numbers, UPI IDs, bank details or phone numbers.**
- **Download statistics.** When a download starts we record the course, the time, a shortened browser user-agent string and a salted one-way hash of your IP address. The raw IP address is not stored.
- **Human verification.** The download flow uses Cloudflare Turnstile to block bots, under [Cloudflare's privacy policy](https://www.cloudflare.com/privacypolicy/).

## Payment providers

Payments are handled entirely by the provider you choose: **Razorpay** for UPI, cards and netbanking, and **NOWPayments** for crypto. They may ask for details required by your payment method or by law (for example a phone number for UPI); those details stay with them and are governed by their own privacy policies. We receive only the order and payment IDs, amount, currency and status needed to activate Premium.

## Cookies and local storage

- A **session cookie** keeps you signed in. It is HttpOnly and sent only over HTTPS.
- Your **theme preference** is stored in your own browser.
- We do not use advertising cookies.

## How we protect it

- All traffic is encrypted in transit with HTTPS/TLS.
- Passwords are stored only as bcrypt hashes; payment records hold no card or bank data.
- Access to the administration area is restricted to authorised staff.
- The site sits behind Cloudflare, which provides network protection and may process technical connection data under its own policy.

## Sharing

We do not sell or rent personal data, and we do not share it for marketing. Data is shared only with the services needed to run the site (hosting, Cloudflare, the payment providers) or where the law requires it.

## Retention and your choices

We keep account data while your account exists and payment records for as long as needed for accounting and fraud prevention. You can ask us to delete your account or unlink Telegram at any time.

## Contact

For any privacy question or request, ${contactLine(c)}.`;
}

export function refundContent(c: Contact | null): string {
  return `**${NO_REFUND_NOTICE}**

## Digital products only

Everything sold on Courses Monster — including every Premium plan — is a **digital product**. Access is delivered to your account automatically and immediately once your payment is confirmed, so it cannot be returned.

## All sales are final

- We do **not** offer refunds, cancellations or exchanges once a payment is completed.
- There are **no partial refunds** for unused time on a plan.
- This applies to every payment method: UPI, cards, netbanking and crypto.

You confirm that you have read and agree to this policy before every purchase.

## Before you buy

Please check the plan, the price and what Premium includes on the [Premium page](/premium) before paying. Much of the site is free to use, so you can see how it works first.

## If something goes wrong

- **Payment taken but Premium not active?** Activation is usually instant. If it hasn't happened after a few minutes, ${contactLine(c)} with your payment ID and we will make sure your Premium is activated.
- **Payment failed?** A failed payment does not activate anything and is not charged. If your bank shows a debit for a failed attempt, it is reversed automatically by your bank or the payment provider.
- **Paid more than once?** Each completed payment adds its full period to your membership, so no paid time is lost.

## Chargebacks

Opening a chargeback or payment dispute for a digital product that was delivered may lead to your account and Premium access being suspended.

## Contact

Questions about this policy? ${contactLine(c, true)}.`;
}

export function copyrightContent(c: Contact | null): string {
  return `Courses Monster is an educational platform whose goal is education and skill development — helping learners discover learning resources. The platform does not intend to harm creators or misrepresent ownership. Credit belongs to the original creators, instructors, publishers and course providers whenever applicable.

## Our commitment to rights holders

If any copyright owner, instructor, publisher or authorised representative believes that content on this platform infringes their rights, they may contact us with sufficient proof of ownership. We will promptly review the request and, where appropriate, remove or disable access to the reported content.

## Where to send your notice

To send a copyright, DMCA or ownership claim, ${contactLine(c)}.

## What to include

So we can act quickly, please include:

1. **Identification of the work** — the name of the course or material you hold rights to.
2. **The exact URL(s)** on this site where the content appears (for example \`https://courses.monster/courses/...\`).
3. **Proof of ownership or authorisation** — for example a link to the official course or publisher page, or a statement that you are authorised to act on behalf of the rights holder.
4. **A good-faith statement** that use of the material in the manner complained of is not authorised by the rights holder.

## What happens next

- We review every complete request promptly.
- Where the claim is verified, we remove or disable access to the reported content.
- We may ask for more information if it is needed to verify the request.`;
}
