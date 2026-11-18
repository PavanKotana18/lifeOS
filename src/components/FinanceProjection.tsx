import { useMemo, useState } from 'react';
import { decimalToMinorUnits, formatMinorUnits, projectSavings } from '../services/financeCore';
import InfoTip from './InfoTip';

type Props = { currencyCode: string; locale?: string };
type Inputs = {
  starting: string;
  monthly: string;
  months: string;
  returnPercent: string;
  compareReturnPercent: string;
  inflationPercent: string;
  stepMonths: string;
  stepUpPercent: string;
};

const initial: Inputs = {
  starting: '0', monthly: '100', months: '60', returnPercent: '0', compareReturnPercent: '',
  inflationPercent: '0', stepMonths: '0', stepUpPercent: '0',
};

const inputClass = 'lifeos-input mt-1 block min-h-12 w-full rounded-xl px-3 py-2 text-base';

const fields = [
  ['starting', 'Starting savings', '0.01'],
  ['monthly', 'Monthly contribution', '0.01'],
  ['months', 'Duration in months', '1'],
  ['returnPercent', 'Estimated annual return (%)', '0.01'],
] as const;
const advancedFields = [
  ['stepMonths', 'Increase contribution every (months)', '1'],
  ['stepUpPercent', 'Contribution increase (%)', '0.01'],
  ['compareReturnPercent', 'Compare with annual return (%)', '0.01'],
  ['inflationPercent', 'Estimated annual inflation (%)', '0.01'],
] as const;

export default function FinanceProjection({ currencyCode, locale }: Props) {
  const [inputs, setInputs] = useState(initial);
  const [advanced, setAdvanced] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const calculation = useMemo(() => {
    try {
      const basisPoints = (value: string) => Number(decimalToMinorUnits(value || '0', 'USD'));
      const months = Number(inputs.months);
      const scenario = {
        startingMinorUnits: decimalToMinorUnits(inputs.starting || '0', currencyCode),
        monthlyContributionMinorUnits: decimalToMinorUnits(inputs.monthly || '0', currencyCode),
        months,
        annualReturnBasisPoints: basisPoints(inputs.returnPercent),
        annualInflationBasisPoints: basisPoints(inputs.inflationPercent),
        contributionStepUpMonths: Number(inputs.stepMonths || 0),
        contributionStepUpBasisPoints: basisPoints(inputs.stepUpPercent),
      };
      const points = [{ month: 0, balance: scenario.startingMinorUnits }];
      const result = projectSavings(scenario, (month, balance) => {
        if (month % 12 === 0 || month === months) points.push({ month, balance });
      });
      const comparison = inputs.compareReturnPercent.trim() ? projectSavings({
        ...scenario, annualReturnBasisPoints: basisPoints(inputs.compareReturnPercent),
      }) : null;
      const maxBalance = points.reduce((max, point) => point.balance > max ? point.balance : max, 0n);
      return { result, comparison, points, maxBalance, error: '' };
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : 'Check your projection inputs.' };
    }
  }, [currencyCode, inputs]);

  const money = (minor: bigint) => formatMinorUnits(minor, currencyCode, locale);
  const field = ([key, label, step]: readonly [keyof Inputs, string, string]) => <label key={key} className="min-w-0 text-sm font-medium">
    {label}
    <input type="number" inputMode={step === '1' ? 'numeric' : 'decimal'} step={step} value={inputs[key]} className={inputClass}
      onChange={event => { const value = event.target.value; setInputs(current => ({ ...current, [key]: value })); }} />
  </label>;

  return <div className="space-y-4" data-testid="savings-projection">
    <section className="lifeos-panel space-y-3 rounded-2xl border p-4" aria-label="Projection inputs">
      <div className="flex items-center justify-between gap-2"><h3 className="type-section-title">Your assumptions</h3>
        <button type="button" className="min-h-11 text-sm lifeos-accent-text" onClick={() => { setInputs(initial); setAdvanced(false); setShowBreakdown(false); }}>Reset</button></div>
      <div className="grid gap-3 sm:grid-cols-2">{fields.map(field)}</div>
      <button type="button" className="min-h-11 text-sm font-semibold lifeos-accent-text" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>Contribution growth and comparison</button>
      {advanced && <div className="grid gap-3 sm:grid-cols-2">{advancedFields.map(field)}</div>}
    </section>
    {calculation.error && <p role="alert" className="lifeos-danger rounded-xl border p-3 text-sm">{calculation.error}</p>}
    {calculation.result && <section className="lifeos-panel space-y-4 rounded-2xl border p-4" aria-labelledby="projected-value">
      <div aria-live="polite">
        <div className="flex items-center gap-2"><h3 id="projected-value" className="type-section-title">Projected value</h3><InfoTip label="Projected value">The annual return is divided by 12. Interest rounds to the currency's smallest unit each month. Contributions are added at month end. The estimate excludes taxes and fees.</InfoTip></div>
        <p className="type-display-amount break-all tabular-nums" data-testid="projected-value">{money(calculation.result.projectedMinorUnits)}</p>
        <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-secondary">Total contributions</dt><dd className="font-semibold">{money(calculation.result.contributedMinorUnits)}</dd></div>
          <div><dt className="text-secondary">Estimated growth</dt><dd className="font-semibold">{money(calculation.result.growthMinorUnits)}</dd></div></dl>
        {calculation.comparison && <p className="mt-2 text-sm">At {inputs.compareReturnPercent}% annual return: {money(calculation.comparison.projectedMinorUnits)}</p>}
        {Number(inputs.inflationPercent) !== 0 && <p className="mt-2 text-sm">In today's money: {money(calculation.result.realProjectedMinorUnits)}</p>}
      </div>
      <figure className="space-y-2" aria-label="Projected savings over time">
        <div className="projection-bars" aria-hidden="true">{calculation.points.map(point => <span key={point.month} style={{ height: calculation.maxBalance ? Number(point.balance * 10000n / calculation.maxBalance) / 100 + '%' : '0%' }} />)}</div>
        <figcaption className="flex justify-between text-xs text-secondary"><span>Start</span><span>{inputs.months} months</span></figcaption>
      </figure>
      <p className="text-xs text-secondary">Estimates vary and are not guaranteed.</p>
      <button type="button" className="min-h-11 text-sm font-semibold lifeos-accent-text" aria-expanded={showBreakdown} onClick={() => setShowBreakdown(!showBreakdown)}>Period breakdown</button>
      {showBreakdown && <table className="w-full text-sm"><thead><tr><th scope="col" className="pb-2 text-left">Month</th><th scope="col" className="pb-2 text-right">Value</th></tr></thead>
        <tbody>{calculation.points.map(point => <tr key={point.month} className="border-t border-[var(--stroke)]"><th scope="row" className="py-2 text-left font-medium">{point.month || 'Start'}</th><td className="text-right tabular-nums">{money(point.balance)}</td></tr>)}</tbody></table>}
    </section>}
  </div>;
}
