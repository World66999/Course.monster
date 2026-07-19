/**
 * One-off: update the Contact and Copyright pages with the current
 * contact channels (overwrites those two pages by design):
 *   - General support: Telegram @Peace_mean_What
 *   - Copyright / DMCA / legal: chessmasterpiece9@gmail.com
 *
 * Run: set -a; source .env; set +a; npx tsx scripts/update-contact-info.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const TELEGRAM_URL = "https://t.me/Peace_mean_What";
const TELEGRAM_HANDLE = "@Peace_mean_What";
const LEGAL_EMAIL = "chessmasterpiece9@gmail.com";

const CONTACT_CONTENT = `We're happy to hear from learners, creators, and rights holders. Please use the channel that matches your request so it reaches the right person quickly.

## General support & questions

For anything about using the site — download help, broken links, course requests, feedback:

- **Telegram:** [${TELEGRAM_HANDLE}](${TELEGRAM_URL})

## Copyright, DMCA & legal

For copyright matters, DMCA takedown requests, ownership claims, or any legal communication:

- **Email:** [${LEGAL_EMAIL}](mailto:${LEGAL_EMAIL})

Before writing, please read the [Copyright & DMCA policy](/copyright) — it lists exactly what to include (URLs, proof of ownership, contact details) so we can review your request promptly and remove or disable access to the reported content where appropriate.

## Newsletter removal

If you subscribed to the newsletter and want your email address deleted, message us on [Telegram](${TELEGRAM_URL}) or email [${LEGAL_EMAIL}](mailto:${LEGAL_EMAIL}) and we will remove it.`;

const COPYRIGHT_CONTENT = `Courses Monster is an educational platform whose goal is education and skill development — helping learners discover learning resources. The platform does not intend to harm creators or misrepresent ownership. Credit belongs to the original creators, instructors, publishers, and course providers whenever applicable.

## Our commitment to rights holders

If any copyright owner, instructor, publisher, or authorized representative believes that any content on this platform infringes their rights, they may contact us with sufficient proof of ownership. We will promptly review the request and, where appropriate, remove or disable access to the reported content.

## Where to send your notice

Send copyright, DMCA, and ownership claims by email to:

**[${LEGAL_EMAIL}](mailto:${LEGAL_EMAIL})**

(For general, non-legal questions, use our Telegram instead: [${TELEGRAM_HANDLE}](${TELEGRAM_URL}).)

## What to include

So we can act quickly, please include:

1. **Identification of the work** — the name of the course or material you hold rights to.
2. **The exact URL(s)** on this site where the content appears (for example \`https://courses.monster/courses/...\`).
3. **Proof of ownership or authorization** — for example a link to the official course or publisher page, or a statement that you are authorized to act on behalf of the rights holder.
4. **Your contact information**, so we can respond to your request.
5. **A good-faith statement** that use of the material in the manner complained of is not authorized by the rights holder.

## What happens next

- We review every complete request promptly.
- Where the claim is verified, we remove or disable access to the reported content.
- We may contact you if additional information is needed to verify the request.

Incomplete requests may take longer while we ask for missing details, so please include as much of the information above as possible.`;

async function main() {
  await db.page.upsert({
    where: { slug: "contact" },
    create: { slug: "contact", title: "Contact", content: CONTACT_CONTENT },
    update: { content: CONTACT_CONTENT },
  });
  console.log("updated contact");
  await db.page.upsert({
    where: { slug: "copyright" },
    create: { slug: "copyright", title: "Copyright & DMCA", content: COPYRIGHT_CONTENT },
    update: { content: COPYRIGHT_CONTENT },
  });
  console.log("updated copyright");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
