import type { CSSProperties } from 'react';
import { Bell, CalendarDays, Home, UserRound, Wallet } from 'lucide-react';
import type { ThemeTokens } from '../services/themeCatalog';

export function InterfacePreview({ tokens, accent }: { tokens: ThemeTokens; accent?: Record<string, string> }) {
  const style = {
    '--preview-page': tokens.background, '--preview-card': tokens.surface, '--preview-text': tokens.primaryText,
    '--preview-muted': tokens.secondaryText, '--preview-stroke': tokens.border,
    '--preview-accent': accent?.['--accent'] ?? tokens.accent,
    '--preview-on-accent': accent?.['--accent-foreground'] ?? tokens.accentForeground,
  } as CSSProperties;
  return <span className="profile-preview-device" aria-hidden="true" style={style}>
    <span className="profile-preview-header">BusyDoo <Bell size={14} /></span>
    <span className="profile-preview-card"><strong>Today’s plan</strong><small>Review your weekly goals</small>
      <span className="profile-preview-control">Open plan</span>
    </span>
    <span className="profile-preview-nav">
      <span><Home size={12} />Today</span><span><Wallet size={12} />Money</span><span><CalendarDays size={12} />Plan</span><span><UserRound size={12} />Profile</span>
    </span>
  </span>;
}
