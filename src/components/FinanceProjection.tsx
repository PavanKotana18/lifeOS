import { useMemo, useState } from 'react';
import { decimalToMinorUnits, formatMinorUnits, projectSavings } from '../services/financeCore';

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
  starting: '0', monthly: '100', months: '60', returnPercent: '5', compareReturnPercent: '7',
  inflationPercent: '3', stepMonths: '0', stepUpPercent: '0',
};

const inputClass = 'lifeos-input mt-1 block min-h-12 w-full rounded-xl px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

export default function FinanceProjection({ currencyCode, locale }: Props) {
  const [inputs, setInputs] = useState(initial);
  const update = (key: keyof Inputs, value: string) => setInputs(current => ({ ...current, [key]: value }));
  const calculation = useMemo(() => {
    try {
      const basisPoints = (value: string) => Number(decimalToMinorUnits(value || '0', 'USD'));
      const months = Number(inputs.months);
      const input = {
          startingMinorUnits: decimalToMinorUnits(inputs.starting || '0', currencyCode),
          monthlyContributionMinorUnits: decimalToMinorUnits(inputs.monthly || '0', currencyCode),
          months,
          annualReturnBasisPoints: basisPoints(inputs.returnPercent),
          annualInflationBasisPoints: basisPoints(inputs.inflationPercent),
          contributionStepUpMonths: Number(inputs.stepMonths || 0),
          contributionStepUpBasisPoints: basisPoints(inputs.stepUpPercent),
      };
      const result = projectSavings(input);
      const comparison = projectSavings({ ...input, annualReturnBasisPoints: basisPoints(inputs.compareReturnPercent) });
      return {
        result,
        comparison,
        months,
        error: '',
      };
    } catch (error) {
      return { result: null, comparison: null, months: Number(inputs.months) || 0, error: error instanceof Error ? error.message : 'Check your planning inputs.' };
    }
  }, [currencyCode, inputs]);

  const money = (minor: bigint) => formatMinorUnits(minor, currencyCode, locale);
  const fields: Array<[keyof Inputs, string, string, string]> = [
    ['starting', 'Starting savings', '0', 'Enter money already set aside.'],
    ['monthly', 'Monthly contribution', '0.01', 'Added at the end of each month.'],
    ['months', 'Plan duration (months)', '1', 'Between 1 and 1200 months.'],
    ['returnPercent', 'Assumed annual return (%)', '0.01', 'A scenario input, not a promised return.'],
    ['compareReturnPercent', 'Compare with annual return (%)', '0.01', 'A second scenario using the same contributions and inflation.'],
    ['inflationPercent', 'Assumed annual inflation (%)', '0.01', 'Used to estimate today’s purchasing power.'],
    ['stepMonths', 'Contribution increase every (months)', '1', 'Use 0 to keep contributions level.'],
    ['stepUpPercent', 'Contribution increase (%)', '0.01', 'Applied after each selected interval.'],
  ];

  return <section aria-labelledby="savings-plan-title" className="lifeos-panel space-y-4 rounded-2xl border p-4 sm:p-5">
    <div>
      <h3 id="savings-plan-title" className="text-lg font-semibold">Explore a savings plan</h3>
      <p className="mt-1 text-sm text-secondary">Change the inputs to see how regular contributions may add up.</p>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map(([key, label, step, help]) => <label key={key} className="text-sm font-medium text-primary">
        {label}
        <input aria-label={label} type="number" inputMode="decimal" min={key === 'months' || key === 'stepMonths' ? '0' : undefined}
          max={key === 'months' ? '1200' : undefined} step={step} value={inputs[key]} onChange={event => update(key, event.target.value)} className={inputClass} />
        <span className="mt-1 block text-xs font-normal text-secondary">{help}</span>
      </label>)}
    </div>
    {calculation.error ? <p role="alert" className="lifeos-danger rounded-xl border p-3 text-sm">{calculation.error}</p> : calculation.result && calculation.comparison && <>
      <div aria-live="polite" aria-label="Savings projection results" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[
          { label: `Scenario A · ${inputs.returnPercent}% annual return`, value: calculation.result },
          { label: `Scenario B · ${inputs.compareReturnPercent}% annual return`, value: calculation.comparison },
        ].map(scenario => <section key={scenario.label} className="lifeos-raised rounded-xl p-4" aria-label={scenario.label}>
          <h4 className="font-semibold">{scenario.label}</h4>
          <p className="mt-3 text-xs text-secondary">Estimated amount after {calculation.months} months</p><p className="text-xl font-semibold tabular-nums">{money(scenario.value.projectedMinorUnits)}</p>
          <p className="mt-3 text-xs text-secondary">Value in today’s money</p><p className="text-base font-semibold tabular-nums">{money(scenario.value.realProjectedMinorUnits)}</p>
          <p className="mt-3 text-xs text-secondary">Contributions · growth</p><p className="text-sm font-semibold tabular-nums">{money(scenario.value.contributedMinorUnits)} · {money(scenario.value.growthMinorUnits)}</p>
        </section>)}
      </div>
      <p className="text-xs leading-relaxed text-secondary">Method: monthly return and inflation are annual inputs divided by 12; contributions are added at month end and interest rounds to the currency’s minor unit each month. Excludes taxes, fees and changing market conditions. Results are estimates, not guarantees.</p>
    </>}
  </section>;
}
