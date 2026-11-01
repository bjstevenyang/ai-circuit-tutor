import { LED_CURRENT_LIMIT_MA } from '../circuit';
import type { ComponentReading } from '../circuit';

/** A teaching display level, not luminous intensity or a physical brightness prediction. */
export function relativeLedBrightness(reading?: ComponentReading): number | null {
  if(!reading||!Number.isFinite(reading.currentMa)||reading.currentMa<0)return null;
  if(!reading.on)return 0;
  return Math.min(1,reading.currentMa/LED_CURRENT_LIMIT_MA);
}
export const ledDescriptionId=(id:string)=>`led-polarity-${encodeURIComponent(id)}`;
