import { APP_NAME } from '../config/appBrand';

export function BusyDooBrand({ className = '', markClassName = '' }: { className?: string; markClassName?: string }) {
  return <span className={`lifeos-brand ${className}`}>
    <img src="./brand/busydoo-approved-icon.png" alt="" className={`busydoo-brand-mark ${markClassName}`} />
    <span className="lifeos-brand-word">{APP_NAME}</span>
  </span>;
}
