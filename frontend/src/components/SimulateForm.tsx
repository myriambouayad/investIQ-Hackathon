import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import type { SimulateFormData, RiskTier } from '../types';
import { Info, Play } from 'lucide-react';

const schema = z.object({
  amount: z.coerce.number().positive('Must be positive'),
  horizon_years: z.coerce.number().min(1).max(50),
  risk: z.enum(['conservative', 'balanced', 'aggressive']),
  monthly_contribution: z.coerce.number().min(0),
  rebalance: z.enum(['never', 'quarterly', 'annual']),
  extra_fee: z.coerce.number().min(0).max(0.05),
  goal: z.coerce.number().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  onSubmit: (data: SimulateFormData) => void;
  loading: boolean;
  initialValues?: Partial<SimulateFormData>;
  /** 'rail' stacks for a narrow sidebar; 'grid' pairs fields across a page. */
  layout?: 'rail' | 'grid';
  submitLabel?: string;
}

/**
 * Risk is a single ordered axis, so it is presented as one — three stops on a
 * scale, left to right. The previous rendering gave each tier its own colour
 * and its own bordered card, which implied three unrelated products.
 */
const RISK_OPTIONS: { value: RiskTier; label: string; equity: string; desc: string }[] = [
  { value: 'conservative', label: 'Conservative', equity: '~30% equity', desc: 'Capital preservation, steady income' },
  { value: 'balanced', label: 'Balanced', equity: '~60% equity', desc: 'Moderate growth with stability' },
  { value: 'aggressive', label: 'Aggressive', equity: '~90% equity', desc: 'Maximum growth, higher risk' },
];

const TOOLTIPS: Record<string, string> = {
  extra_fee: 'Annual advisor or platform fee on top of the ETF expense ratios. 1% = 0.01.',
  rebalance: 'How often to reset weights back to targets. Annual is usually best for taxable accounts.',
  goal: 'Optional target balance to track probability of hitting it.',
};

export function SimulateForm({
  onSubmit,
  loading,
  initialValues,
  layout = 'grid',
  submitLabel = 'Run simulation',
}: Props) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      amount: initialValues?.amount ?? 10000,
      horizon_years: initialValues?.horizon_years ?? 20,
      risk: initialValues?.risk ?? 'balanced',
      monthly_contribution: initialValues?.monthly_contribution ?? 0,
      rebalance: initialValues?.rebalance ?? 'annual',
      extra_fee: initialValues?.extra_fee ?? 0,
    },
  });

  const selectedRisk = watch('risk');
  const pair = layout === 'rail' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2';

  return (
    <form
      onSubmit={handleSubmit((d) => onSubmit(d as unknown as SimulateFormData))}
      className="flex flex-col gap-4"
    >
      <div className={`grid ${pair} gap-3`}>
        <Input
          label="Initial investment"
          type="number"
          prefix="$"
          placeholder="10000"
          error={errors.amount?.message}
          {...register('amount')}
        />
        <Input
          label="Horizon"
          type="number"
          suffix="years"
          placeholder="20"
          min={1}
          max={50}
          error={errors.horizon_years?.message}
          {...register('horizon_years')}
        />
      </div>

      {/* Risk scale */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="eyebrow mb-1.5">Risk tolerance</legend>
        <div className="grid grid-cols-3 gap-px bg-gray-700 rounded-md overflow-hidden border border-gray-700">
          {RISK_OPTIONS.map((opt) => {
            const active = selectedRisk === opt.value;
            return (
              <label key={opt.value} className="cursor-pointer" title={opt.desc}>
                <input type="radio" value={opt.value} {...register('risk')} className="sr-only peer" />
                <div
                  className={`h-full px-1 py-2.5 text-center transition-colors
                    peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-accent)] peer-focus-visible:ring-inset
                    ${
                      active
                        ? 'bg-[var(--color-accent)]/12 text-gray-50'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-750 hover:text-gray-200'
                    }`}
                >
                  <p className="text-[0.6875rem] font-semibold leading-tight">{opt.label}</p>
                  <p
                    className={`text-[0.6875rem] mono mt-0.5 ${
                      active ? 'text-[var(--color-accent)]' : 'text-gray-600'
                    }`}
                  >
                    {opt.equity}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 leading-snug">
          {RISK_OPTIONS.find((o) => o.value === selectedRisk)?.desc}
        </p>
        {errors.risk && <p className="text-xs text-red-400">{errors.risk.message}</p>}
      </fieldset>

      <div className={`grid ${pair} gap-3`}>
        <Input
          label="Monthly contribution"
          type="number"
          prefix="$"
          placeholder="500"
          hint="Added at the start of each month"
          error={errors.monthly_contribution?.message}
          {...register('monthly_contribution')}
        />
        <Input
          label="Goal (optional)"
          type="number"
          prefix="$"
          placeholder="500000"
          hint={TOOLTIPS.goal}
          error={errors.goal?.message}
          {...register('goal')}
        />
      </div>

      <div className={`grid ${pair} gap-3`}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rebalance" className="eyebrow flex items-center gap-1">
            Rebalancing
            <span title={TOOLTIPS.rebalance} className="text-gray-600 cursor-help">
              <Info className="w-3 h-3" />
            </span>
          </label>
          <select
            id="rebalance"
            {...register('rebalance')}
            className="rounded-md border border-gray-700 bg-gray-800 text-gray-50 px-3 py-2 text-sm
                       focus:outline-none focus:border-[var(--color-accent)] focus:ring-1
                       focus:ring-[var(--color-accent)] transition-colors"
          >
            <option value="never">Never</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
          </select>
        </div>
        <Input
          label="Extra annual fee"
          type="number"
          suffix="%/yr"
          placeholder="0"
          step="0.001"
          hint={TOOLTIPS.extra_fee}
          error={errors.extra_fee?.message}
          {...register('extra_fee')}
        />
      </div>

      <Button type="submit" size="lg" loading={loading} className="w-full mt-1">
        {!loading && <Play className="w-3.5 h-3.5 fill-current" />}
        {loading ? 'Running…' : submitLabel}
      </Button>
    </form>
  );
}
