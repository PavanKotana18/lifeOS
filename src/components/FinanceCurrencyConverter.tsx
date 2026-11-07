import { useMemo, useState } from 'react';
import { assessExchangeRateFreshness, convertMinorUnits, decimalToMinorUnits, formatMinorUnits, getCurrencyMetadata, formatCurrencyChoice, CURRENCY_CATALOG } from '../services/financeCore';
import { formatLocalDate } from '../services/domainUtils';

type Props = { currencyCode: string; locale?: string };
const currencyCodes = Object.keys(CURRENCY_CATALOG).sort();
const fieldClass = 'lifeos-input mt-1 block min-h-12 w-full rounded-xl px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

export default function FinanceCurrencyConverter({ currencyCode, locale }: Props) {
  const [amount, setAmount] = useState('');
  const [fromCurrency, setFromCurrency] = useState(currencyCode);
  const [toCurrency, setToCurrency] = useState(currencyCode === 'USD' ? 'INR' : 'USD');
  const [rate, setRate] = useState('');
  const [rateDate, setRateDate] = useState(() => formatLocalDate(new Date()));
  const [source, setSource] = useState('');
  const [today] = useState(() => formatLocalDate(new Date()));

  const conversion = useMemo(() => {
    if (!amount.trim() || !rate.trim() || !rateDate || !source.trim()) return { result: null, freshness: null, error: '' };
    try {
      const sourceMinorUnits = decimalToMinorUnits(amount, fromCurrency);
      const convertedMinorUnits = convertMinorUnits(sourceMinorUnits, fromCurrency, toCurrency, rate);
      const freshness = assessExchangeRateFreshness(rateDate, today);
      return { result: convertedMinorUnits, freshness, error: '' };
    } catch (error) {
      return { result: null, freshness: null, error: error instanceof Error ? error.message : 'Check the exchange rate and date.' };
    }
  }, [amount, fromCurrency, toCurrency, rate, rateDate, source, today]);

  const money = (minorUnits: bigint, code: string) => formatMinorUnits(minorUnits, code, locale);
  const rateDescription = '1 ' + fromCurrency + ' = ' + (rate || '…') + ' ' + toCurrency;

  return <section className="lifeos-panel space-y-3 rounded-2xl border p-4" aria-labelledby="currency-converter-title">
    <div>
      <h3 id="currency-converter-title" className="text-base font-semibold">Convert with your exchange rate</h3>
      <p className="mt-1 text-sm text-secondary">Enter a rate and where it came from. LifeOS does not fetch or invent exchange rates.</p>
    </div>
    <label className="block text-sm font-medium text-primary">Amount
      <input aria-label="Amount to convert" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} className={fieldClass} />
    </label>
    <div className="grid grid-cols-2 gap-3">
      <label className="block text-sm font-medium text-primary">From
        <select aria-label="Source currency" value={fromCurrency} onChange={event => setFromCurrency(event.target.value)} className={fieldClass}>
          {currencyCodes.map(code => <option key={code} value={code}>{formatCurrencyChoice(code, locale)} · {getCurrencyMetadata(code).fractionDigits} decimal places</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium text-primary">To
        <select aria-label="Target currency" value={toCurrency} onChange={event => setToCurrency(event.target.value)} className={fieldClass}>
          {currencyCodes.map(code => <option key={code} value={code}>{formatCurrencyChoice(code, locale)} · {getCurrencyMetadata(code).fractionDigits} decimal places</option>)}
        </select>
      </label>
    </div>
    <label className="block text-sm font-medium text-primary">Rate · {rateDescription}
      <input aria-label={'Exchange rate ' + fromCurrency + ' to ' + toCurrency} type="number" inputMode="decimal" min="0.00000001" step="any" value={rate} onChange={event => setRate(event.target.value)} className={fieldClass} />
      <span className="mt-1 block text-xs font-normal text-secondary">Quote-currency units for one source-currency unit.</span>
    </label>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="block text-sm font-medium text-primary">Rate date
        <input aria-label="Exchange rate date" type="date" max={today} value={rateDate} onChange={event => setRateDate(event.target.value)} className={fieldClass} />
      </label>
      <label className="block text-sm font-medium text-primary">Rate source
        <input aria-label="Exchange rate source" type="text" maxLength={120} value={source} onChange={event => setSource(event.target.value)} placeholder="For example, a bank quote" className={fieldClass} />
      </label>
    </div>
    {conversion.error && <p role="alert" className="lifeos-danger rounded-xl border p-3 text-sm">{conversion.error}</p>}
    {conversion.result !== null && conversion.freshness && <div aria-live="polite" className="lifeos-raised rounded-xl p-4">
      <p className="text-xs text-secondary">Estimated conversion · {rateDate} · {source.trim()}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{money(decimalToMinorUnits(amount, fromCurrency), fromCurrency)} → {money(conversion.result, toCurrency)}</p>
      <p className={'mt-2 text-xs ' + (conversion.freshness.freshness === 'stale' ? 'lifeos-warning' : 'text-secondary')}>
        {conversion.freshness.freshness === 'stale' ? 'Rate is ' + conversion.freshness.ageDays + ' days old; verify it before relying on this estimate.' : 'Rate age: ' + conversion.freshness.ageDays + ' days · Source: ' + source.trim() + '.'}
      </p>
      <p className="mt-2 text-xs text-secondary">The result rounds to {getCurrencyMetadata(toCurrency).fractionDigits} minor-unit decimals. It is an estimate, not a live quote.</p>
    </div>}
  </section>;
}
