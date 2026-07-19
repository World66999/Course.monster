/**
 * Seed the standalone legal/info pages (create-only: never overwrites a page
 * the admin has already written). Run with the production env loaded:
 *
 *   set -a; source .env; set +a; npx tsx scripts/seed-pages.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const TELEGRAM_URL = "https://t.me/Unique_One_in";

const PAGES: { slug: string; title: string; content: string }[] = [
  {
    slug: "copyright",
    title: "Copyright & DMCA",
    content: `Courses Monster is an educational platform whose goal is education and skill development — helping learners discover learning resources. The platform does not intend to harm creators or misrepresent ownership. Credit belongs to the original creators, instructors, publishers, and course providers whenever applicable.

## Our commitment to rights holders

If any copyright owner, instructor, publisher, or authorized representative believes that any content on this platform infringes their rights, they may contact us with sufficient proof of ownership. We will promptly review the request and, where appropriate, remove or disable access to the reported content.

## How to submit a takedown request

Reach us through any channel on the [Contact page](/contact) and include the following, so we can act quickly:

1. **Identification of the work** — the name of the course or material you hold rights to.
2. **The exact URL(s)** on this site where the content appears (for example \`https://courses.monster/courses/...\`).
3. **Proof of ownership or authorization** — for example a link to the official course or publisher page, or a statement that you are authorized to act on behalf of the rights holder.
4. **Your contact information**, so we can respond to your request.
5. **A good-faith statement** that use of the material in the manner complained of is not authorized by the rights holder.

## What happens next

- We review every complete request promptly.
- Where the claim is verified, we remove or disable access to the reported content.
- We may contact you if additional information is needed to verify the request.

Incomplete requests may take longer while we ask for missing details, so please include as much of the information above as possible.`,
  },
  {
    slug: "terms",
    title: "Terms of Use",
    content: `By accessing or using this website, you agree to these terms. If you do not agree, please do not use the site.

## What this site provides

Courses Monster is an educational discovery platform. It lists learning resources and provides links that redirect to content hosted on third-party platforms. This site does not host course video files itself; downloads take place on external services that have their own terms and policies.

## Acceptable use

You agree not to:

- use bots, scrapers, or other automation to access the site or its download flow;
- attempt to bypass the human-verification (captcha) or rate-limiting protections;
- attempt to gain access to the administration area or other users' data;
- use the site for any unlawful purpose.

## Intellectual property

Credit for all course materials belongs to their original creators, instructors, publishers, and providers. Rights holders can request removal of content at any time — see our [Copyright & DMCA policy](/copyright). We review such requests promptly and remove or disable access to content where appropriate.

## No warranty

The site is provided "as is" without warranties of any kind. We do not guarantee that any listed resource remains available, accurate, or complete, and we are not responsible for the content, availability, or policies of external websites that links on this site lead to.

## Changes

We may update these terms from time to time. The "Last updated" date at the top of this page reflects the latest revision. Continued use of the site after a change means you accept the updated terms.`,
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    content: `This policy describes what data this website collects, why, and how it is protected. The short version: you can browse and download without creating an account, and we collect very little.

## What we collect

- **No visitor accounts.** There is no registration or login for visitors, so we store no visitor profiles or passwords.
- **Newsletter (optional).** If you subscribe, we store your email address and use it only to tell you about new courses. You can ask us to remove it at any time via the [Contact page](/contact).
- **Download statistics.** When a download is started we record the course, the time, a truncated browser user-agent string, and a **salted one-way hash** of your IP address. The raw IP address is not stored; the hash cannot be reversed into your IP and is used only for abuse prevention and aggregate statistics.
- **Human verification.** The download flow uses Cloudflare Turnstile to block bots. Turnstile processes the verification on Cloudflare's infrastructure under [Cloudflare's privacy policy](https://www.cloudflare.com/privacypolicy/).

## Cookies and local storage

- Your **theme preference** (light/dark) is stored in your own browser, not on our servers.
- A **session cookie** is used only for administrators signing in to the management area; it is HttpOnly and sent only over HTTPS. Regular visitors are not given login cookies.
- We do not set advertising cookies. Analytics cookies are **not currently in use**; if analytics is enabled in the future, this policy will be updated.

## Security and encryption

- All traffic to and from this website is encrypted **in transit with HTTPS/TLS**. End-to-end encryption is not applicable to a public website like this one — there is no private message content to encrypt between two end users; TLS is the appropriate and industry-standard protection here, and it is what we use.
- Administrator passwords are stored only as bcrypt hashes.
- The site sits behind Cloudflare, which provides network-level protection and may process technical connection data under its own policy.

## Third parties

Download links lead to external platforms (for example link-shortening services and Telegram). Once you leave this site, the destination's own privacy policy applies. We do not sell or share collected data with third parties for marketing.

## Contact

Questions about this policy, or a request to delete your newsletter email? Reach us via the [Contact page](/contact).`,
  },
  {
    slug: "contact",
    title: "Contact",
    content: `We're happy to hear from learners, creators, and rights holders.

## Reach us

- **Telegram (fastest):** [${TELEGRAM_URL.replace("https://", "")}](${TELEGRAM_URL}) — message the channel admins.

## Copyright owners and instructors

If you believe content on this platform infringes your rights, please read the [Copyright & DMCA policy](/copyright) first — it lists exactly what to include (URLs, proof of ownership, contact details) so that we can review your request promptly and remove or disable access to the reported content where appropriate.

## Newsletter removal

If you subscribed to the newsletter and want your email address deleted, send us a message and we will remove it.`,
  },
];

async function main() {
  for (const page of PAGES) {
    const existing = await db.page.findUnique({ where: { slug: page.slug } });
    if (existing) {
      console.log(`skip ${page.slug} (already exists, not overwriting)`);
      continue;
    }
    await db.page.create({ data: page });
    console.log(`created ${page.slug}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
