import { cn } from '@/lib/utils'
import { TAKA_SYMBOL } from '@/lib/currency'

type TakaIconProps = {
  className?: string
}

/** Bangladeshi Taka (BDT) symbol for stat cards and money UI — replaces dollar icons. */
export function TakaIcon({ className }: TakaIconProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-bold leading-none select-none',
        className
      )}
      aria-hidden
    >
      {TAKA_SYMBOL}
    </span>
  )
}
