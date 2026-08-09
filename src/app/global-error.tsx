"use client";

/**
 * Last-resort boundary for errors in the root layout itself. Global CSS may
 * not be available here, so styles are inline and dependency-free.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#060913",
          color: "#e2e8f0",
          textAlign: "center",
          padding: "1rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Something went wrong</h1>
          <p style={{ opacity: 0.7, marginBottom: "1.5rem" }}>
            An unexpected error occurred.
            {error.digest ? ` (Ref: ${error.digest})` : ""}
          </p>
          <button
            onClick={reset}
            style={{
              cursor: "pointer",
              border: 0,
              borderRadius: "0.5rem",
              padding: "0.6rem 1.4rem",
              fontSize: "1rem",
              fontWeight: 600,
              color: "#fff",
              background: "#4f46e5",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
