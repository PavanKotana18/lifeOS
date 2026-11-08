import { MODULE_CATALOG, type ModuleTab } from '../services/navigationCatalog';

type ModuleCounts = { transactions: number; habits: number; goals: number; openTasks: number };
type Props = { counts: ModuleCounts; onNavigate: (tab: ModuleTab) => void };

export default function ExploreHub({ counts, onNavigate }: Props) {
  return <section aria-labelledby="explore-title" className="space-y-4">
    <header><p className="text-sm text-secondary">Your tools, in one place</p><h2 id="explore-title" className="text-xl font-semibold">Explore LifeOS</h2></header>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {MODULE_CATALOG.map(module => <button key={module.tab} type="button" data-module={module.tab} onClick={() => onNavigate(module.tab)} className="lifeos-panel min-h-28 rounded-2xl border p-4 text-left transition hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2">
        <span className="block text-base font-semibold">{module.title}</span>
        <span className="mt-1 block text-sm text-secondary">{module.description}</span>
        <span className="mt-3 block text-xs font-medium text-secondary">{module.countKey ? counts[module.countKey] + (module.countKey === 'transactions' ? ' saved transactions' : module.countKey === 'openTasks' ? ' open tasks' : module.countKey === 'habits' ? ' active routines' : ' active goals') : 'Preferences and data controls'}</span>
      </button>)}
    </div>
  </section>;
}
