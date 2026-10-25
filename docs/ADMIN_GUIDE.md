# Admin Guide

Everything in the admin panel lives under `https://yourdomain.com/<ADMIN_SEGMENT>`,
where `<ADMIN_SEGMENT>` is the random path constant in `src/lib/admin-path.ts`.
`/admin` itself is not a route and never was on this deployment — the segment is an
extra layer over the authentication checks, not a replacement for them, so treat the
URL as sensitive but never as the thing keeping the panel private.
Sign in with your admin email and password. Sessions last 12 hours.

## Dashboard

At-a-glance stats (courses, downloads, views, subscribers), a 14-day download
chart, the most popular courses, the latest download events and recent admin
activity. Numbers on cards link nowhere — the sidebar is your navigation.

## Courses

**Create** — "New course". Required fields: title, slug (auto-filled from the
title, editable), description (Markdown with live preview) and the download
URL. Everything else is optional:

- **Short description** — one line used on cards and in search results.
- **Category / tags** — power the filters on the public listing.
- **Size / lectures** — informational chips shown on cards and course pages.
- **Thumbnail / banner** — upload (converted to WebP automatically) or paste a
  URL. Courses without artwork get a branded gradient placeholder.
- **Featured / Trending** — control the homepage sections.
- **SEO fields** — override title/description/social image for search engines.
- **Telegram URL** — per-course override; otherwise the site-wide link is used.
- **Published** — drafts are invisible on the public site.

**Manage** — the course table supports:

- Search and status filtering.
- Row menu: edit, view on site, duplicate (creates an unpublished copy),
  publish/unpublish, delete.
- Bulk operations: select rows (or the header checkbox) → publish, unpublish
  or delete the whole selection.
- Reorder: up/down arrows (visible when no search/filter is active). Order
  affects the featured section on the homepage.

Changing a course's download URL automatically invalidates its cached short
link; a fresh one is generated on the next download.

## Categories

Create, edit, reorder and delete categories. Deleting a category never deletes
its courses — they just become uncategorized. The `icon` field accepts:
`code`, `palette`, `bar-chart`, `megaphone`, `briefcase`, `smartphone`.

## Pages

Markdown editor for the **How to Download** page with a preview tab. Saved
changes go live within seconds.

## Subscribers

Newsletter signups from the footer form, newest first.

## Activity

Full audit log: every create/update/delete/publish action with who did it and
when, plus failed login attempts.

## Settings

- **General** — site name, tagline, description, logo, favicon, footer text,
  Telegram link, newsletter toggle, download countdown seconds, default theme.
- **Announcement** — a site-wide banner with optional link.
- **Social** — footer social links (empty = hidden).
- **SEO** — default meta title/template/description, Twitter handle, default
  social share image.
- **Advanced** — Google Analytics ID and the raw robots.txt content (the
  sitemap line is appended automatically).

All settings apply site-wide within about a minute (usually instantly).

## Tips

- The public site caches the homepage for 2 minutes; course pages are always
  fresh.
- Download counts increase when a visitor actually passes the protected flow,
  not when they click the button.
- Use **duplicate** to create templates for similar courses.
