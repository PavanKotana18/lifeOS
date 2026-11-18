export default function MoneyPeriod({ label, month, onChange }: {
  label: string; month: string; onChange: (month: string) => void;
}) {
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/;
  const date = valid.test(month) ? new Date(month + '-01T12:00:00') : new Date();
  const name = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return <label className="money-period-control money-period-unified">
    <span className="money-period-value" aria-hidden="true">{name}</span>
    <input aria-label={label + ' period, ' + name} type="month" value={month}
      onChange={event => { if (valid.test(event.target.value)) onChange(event.target.value); }} />
  </label>;
}
