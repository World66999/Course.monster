/**
 * Public-site route boundary.
 *
 * This used to animate a fade/slide on every navigation and on first page
 * load (the page-entrance "flip" motion). That has been removed per request —
 * pages now render immediately with no transition. Kept as a `template.tsx`
 * seam (rather than deleted) so a transition can be reintroduced later without
 * restructuring the route tree.
 */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
