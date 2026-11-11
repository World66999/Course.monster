import { z } from "zod";

// Import `z` from here, not from "zod".
//
// Zod normally probes whether it may compile validators with `new Function`.
// The site's Content-Security-Policy forbids that (no 'unsafe-eval'), so in the
// browser the probe only produces a CSP violation in the console (Firefox
// reports it as an error). Setting this in one module that every schema goes
// through guarantees it is applied before the first parse, whichever page
// loads zod first. Interpreted validation is plenty fast for form-sized input.
z.config({ jitless: true });

export { z };
