import { presentReminderStatus, type ReminderStatusInput } from '../services/reminderStatusPresentation';

export default function ReminderStatusSummary({ report, reminderAt }: { report: ReminderStatusInput; reminderAt?: string | null }) {
  const status = presentReminderStatus(report);
  const reminderDate = reminderAt ? new Date(reminderAt) : null;
  const validReminderDate = reminderDate && Number.isFinite(reminderDate.getTime());
  return <section className={`reminder-status-summary is-${status.tone}`} aria-live="polite" aria-label="Reminder status">
    <strong>{status.title}</strong>
    <p>{status.message}</p>
    {validReminderDate && report.schedulingState === 'scheduled-for-future' && <p className="reminder-status-time">Chosen time · {reminderDate.toLocaleString()}</p>}
  </section>;
}
