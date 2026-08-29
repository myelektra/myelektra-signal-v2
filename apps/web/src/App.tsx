import { describeApiBoundary } from "./api";

/**
 * Foundation shell.
 *
 * Deliberately contains no screen, no route, no marketing copy, and no business
 * logic. Rendering configuration status is presentation; deciding anything about
 * a customer, a signal, or a payment is not, and none of it happens here
 * (legacy-exclusion-list R-LC-2: business rules implemented in React are
 * prohibited).
 *
 * Homepage, customer dashboard, and admin dashboard are deferred to Phases 5 and
 * 6 (foundation-plan R-FN-11).
 */
export function App() {
  const boundary = describeApiBoundary();

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="site-header">
        <p className="site-name">Myelektra Signal</p>
      </header>

      <main id="main">
        <h1>Foundation build</h1>
        <p>
          This is the Phase 1B foundation shell. No product features are implemented yet: there is
          no sign-in, no dashboard, and no checkout.
        </p>

        <section aria-labelledby="boundary-heading">
          <h2 id="boundary-heading">API boundary</h2>
          <dl>
            <dt>Contracts package</dt>
            <dd>
              <code>
                {boundary.contractsPackage}@{boundary.contractsVersion}
              </code>
            </dd>

            <dt>Contract schema version</dt>
            <dd>
              <code>{boundary.schemaVersion}</code>
            </dd>

            <dt>Supabase configuration</dt>
            <dd>
              {boundary.supabaseConfigured ? (
                <span>configured</span>
              ) : (
                <span>
                  not configured — copy <code>.env.example</code> to{" "}
                  <code>apps/web/.env.local</code>
                </span>
              )}
            </dd>
          </dl>

          {boundary.missingRequiredKeys.length > 0 && (
            <p>
              <strong>Missing required variables:</strong>{" "}
              <code>{boundary.missingRequiredKeys.join(", ")}</code>
            </p>
          )}

          {boundary.issues.length > 0 && (
            <ul aria-label="Environment problems">
              {boundary.issues.map((issue) => (
                <li key={issue.key}>
                  <code>{issue.key}</code>: {issue.problem}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="site-footer">
        <p>Myelektra Signal — Phase 1B foundation.</p>
      </footer>
    </>
  );
}
