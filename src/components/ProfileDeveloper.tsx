import type { NotificationDiagnostics } from '../services/notificationService';
import { ProfileButton, ProfileGroup, ProfileStatus } from './ProfileSettings';

export default function ProfileDeveloper({ diagnostics, canUseSamples, onTest, onAndroid, onRefresh, onCopy, onResetTour, onSamples }: {
  diagnostics: NotificationDiagnostics; canUseSamples: boolean;
  onTest(immediate: boolean): void; onAndroid(): void; onRefresh(): void; onCopy(): void; onResetTour(): void; onSamples(remove: boolean): void;
}) {
  return <>
    <ProfileGroup title="Runtime" variant="feature" description="Build and delivery details for this Debug installation.">
      <ProfileStatus title="Build" value={diagnostics.versionName || diagnostics.build.appVersion}
        detail={diagnostics.build.commit + ' · API ' + (diagnostics.androidApi ?? 'unknown')} />
      <ProfileStatus title="Notification bridge" value={diagnostics.capability}
        detail={diagnostics.platform + ' · Capacitor ' + diagnostics.build.capacitor.core + ' / ' + diagnostics.build.capacitor.localNotifications} />
    </ProfileGroup>
    <ProfileGroup title="Android notification delivery">
      <ProfileStatus title="Permission" value={diagnostics.permission} detail={'App notifications: ' + diagnostics.appNotifications} />
      <ProfileStatus title="Exact alarms" value={diagnostics.exactAlarm} detail={'Channel: ' + diagnostics.channel} />
      <ProfileStatus title="Pending reminders" value={String(diagnostics.pendingCount ?? 'Unknown')}
        detail={'Visible: ' + diagnostics.visibleNotificationCount + ' · IDs ' + (diagnostics.visibleNotificationIds.join(', ') || 'none')} />
      <ProfileStatus title="Last scheduling result" value={diagnostics.lastScheduleResult}
        detail={diagnostics.lastScheduleAttempt || 'No attempt observed'} />
      <ProfileStatus title="Last scheduling error" value={diagnostics.lastError || 'None recorded'}
        detail={'Last cancellation: ' + (diagnostics.lastCancellationReason || 'none')} />
      <ProfileStatus title="Last action" value={diagnostics.lastActionEvent?.kind || 'None observed'} detail={diagnostics.lastActionEvent?.at} />
    </ProfileGroup>
    {!!diagnostics.reminderLifecycle.length && <ProfileGroup title="Reminder timeline" variant="plain" description="Delivery observations omit task titles.">
      {diagnostics.reminderLifecycle.map(item => <details key={item.notificationId} className="profile-disclosure">
        <summary>Reminder {item.notificationId} · {item.deliveryState}</summary>
        <dl className="profile-events">
          {Object.entries({ Scheduled: item.reminderAt, Accepted: item.nativeAcceptedAt, Pending: item.pendingObservedAt,
            'Android posted': item.androidPostedAt, 'Receiver event': item.receiverEventAt, Tapped: item.tappedAt }).map(([label, time]) =>
            <div key={label}><dt>{label}</dt><dd>{time || 'Not observed'}</dd></div>)}
        </dl>
      </details>)}
    </ProfileGroup>}
    <ProfileGroup title="Test and share diagnostics" variant="plain" description="Test requests do not prove Android delivered a notification.">
      <div className="profile-actions">
        <ProfileButton onClick={() => onTest(false)}>Schedule test · 10 sec</ProfileButton><ProfileButton onClick={() => onTest(true)}>Immediate test</ProfileButton>
        <ProfileButton onClick={onAndroid}>Android notification settings</ProfileButton><ProfileButton onClick={onRefresh}>Refresh diagnostics</ProfileButton>
        <ProfileButton onClick={onCopy}>Copy privacy-safe diagnostics</ProfileButton>
      </div>
    </ProfileGroup>
    <ProfileGroup title="Synthetic data" variant="plain" description="Add or remove demonstration records in this local Debug workspace.">
      <div className="profile-actions">
        <ProfileButton onClick={onResetTour}>Reset onboarding for testing</ProfileButton>
        <ProfileButton disabled={!canUseSamples} onClick={() => onSamples(false)}>Add sample data</ProfileButton>
        <ProfileButton disabled={!canUseSamples} onClick={() => onSamples(true)}>Remove sample data</ProfileButton>
      </div>
    </ProfileGroup>
  </>;
}
