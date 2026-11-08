export type ReminderStatusInput = {
  visibleInNotificationShade?: unknown;
  schedulingState?: unknown;
  categoryEnabled?: unknown;
  androidPermission?: unknown;
  synchronizationFailed?: unknown;
  cancellationReason?: unknown;
  deliveryTiming?: unknown;
};

export type ReminderStatusCopy = { title: string; message: string; tone: 'positive' | 'neutral' | 'attention' };

/** Convert internal scheduling diagnostics to concise, non-identifying user copy. */
export function presentReminderStatus(report: ReminderStatusInput): ReminderStatusCopy {
  const permission = report.androidPermission;
  const reason = report.cancellationReason;

  if (report.visibleInNotificationShade === true) {
    return { title: 'Reminder delivered', message: 'Android currently shows this reminder in your notifications.', tone: 'positive' };
  }
  if (report.schedulingState === 'scheduled-for-future' && permission === 'granted' && report.categoryEnabled === true) {
    const timing = typeof report.deliveryTiming === 'string' && report.deliveryTiming.startsWith('inexact')
      ? ' Android may delay it while the device is idle.' : '';
    const syncNote = report.synchronizationFailed === true ? ' The latest refresh could not be confirmed.' : '';
    return { title: 'Reminder scheduled', message: `LifeOS has asked Android to show this reminder at the chosen time.${timing}${syncNote}`, tone: 'positive' };
  }
  if (reason === 'task-completed') {
    return { title: 'No reminder needed', message: 'This task is complete, so its reminder is no longer active.', tone: 'neutral' };
  }
  if (reason === 'reminder-not-configured') {
    return { title: 'No reminder set', message: 'Add a reminder time while editing this task if you want an alert.', tone: 'neutral' };
  }
  if (reason === 'category-disabled' || report.categoryEnabled === false) {
    return { title: 'Task reminders are off', message: 'Turn on task reminders in Profile → Notifications to receive alerts.', tone: 'attention' };
  }
  if (permission === 'denied' || (typeof reason === 'string' && reason.startsWith('permission-'))) {
    return { title: 'Notifications are not allowed', message: 'Allow LifeOS notifications in Android settings, then check this reminder again.', tone: 'attention' };
  }
  if (report.schedulingState === 'past-time-still-persisted;delivery-unconfirmed') {
    return { title: 'Reminder time has passed', message: 'LifeOS could not confirm whether Android showed the alert. Check your notification history if available.', tone: 'attention' };
  }
  if (report.synchronizationFailed === true) {
    return { title: 'Reminder status could not be refreshed', message: 'Your task is saved. Check the reminder time and Android notification access before relying on an alert.', tone: 'attention' };
  }
  return { title: 'Reminder not scheduled', message: 'Check the reminder time and your notification preferences.', tone: 'attention' };
}
