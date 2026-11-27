import { APP_NAME } from '../config/appBrand';

export function BusyDooBrand({ className = '', markClassName = '', assetRoot = './' }: { className?: string; markClassName?: string; assetRoot?: string }) {
  return <span className={`lifeos-brand ${className}`}>
    <img src={assetRoot + 'brand/busydoo-approved-icon.png'} alt="" className={`busydoo-brand-mark ${markClassName}`} />
    <span className="lifeos-brand-word">{APP_NAME}</span>
  </span>;
}
