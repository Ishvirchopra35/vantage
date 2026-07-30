import type { ReactElement, ReactNode } from 'react';

export interface PageHeaderProps {
  /** Page name, sentence case (e.g. "Job feed"). Rendered as the page h1. */
  title: string;
  /** One-line description of what the page is for. */
  subtitle?: string;
  /** Right-aligned control(s), typically the page's primary button. */
  action?: ReactNode;
}

/**
 * The shared page "letterhead" for every dashboard page. A gold kicker tick,
 * a display-face title, an optional muted subtitle, and an optional action
 * slot. Presentational only (no hooks) so it works in server and client pages.
 */
export default function PageHeader({ title, subtitle, action }: PageHeaderProps): ReactElement {
  return (
    // data-tour: the walkthrough anchors to the letterhead on every page, so
    // one attribute here gives it a stable target everywhere rather than
    // thirteen page-specific selectors that break when a page is restyled.
    <div className="page-header" data-tour="page-header">
      <div className="page-header-text">
        <span className="page-header-kicker" aria-hidden="true" />
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '26px',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            color: 'var(--text)',
            margin: 0,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'var(--muted)',
              lineHeight: 1.55,
              maxWidth: '580px',
              margin: '6px 0 0',
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </div>
  );
}
