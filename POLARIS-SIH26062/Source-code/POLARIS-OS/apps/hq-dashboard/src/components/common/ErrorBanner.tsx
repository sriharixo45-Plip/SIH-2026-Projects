type ErrorBannerProps = { message: string; onRetry?: () => void; details?: { status?: number; endpoint?: string; requestId?: string; body?: string } }
export function ErrorBanner({ message, onRetry, details }: ErrorBannerProps) {
  const hasDetails = details && (details.status != null || details.endpoint || details.requestId || details.body)
  const authorizationDenied = details?.status === 403
  return <div className="error-banner" role="alert">
    <div className="error-content"><div><strong>{authorizationDenied ? 'ACCESS RESTRICTED' : 'DATA TEMPORARILY UNAVAILABLE'}</strong><p>{authorizationDenied ? 'Your account does not have permission for this operational action.' : message}</p>{hasDetails && <details className="error-details"><summary>Technical details</summary><dl>{details.status != null && <><dt>HTTP status</dt><dd>{details.status}</dd></>}{details.endpoint && <><dt>Endpoint</dt><dd>{details.endpoint}</dd></>}{details.requestId && <><dt>Request ID</dt><dd>{details.requestId}</dd></>}{details.body && <><dt>Response</dt><dd><pre>{details.body}</pre></dd></>}</dl></details>}</div></div>
    {onRetry && <button type="button" className="btn-retry" onClick={onRetry}>Retry</button>}
  </div>
}
