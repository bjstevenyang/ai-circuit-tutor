import type { ComponentInstance, ComponentKind, TransistorModelId } from './types';
import { EM } from './oscillator/numeric';

/**
 * A deliberately limited, auditable reduction of published SPICE cards.
 * Source: Sedra/Smith, Microelectronic Circuits 8e, Appendix B, Table B.11:
 * https://learninglink.oup.com/protected/files/content/file/1617108117122-Sedra8e_AppB.pdf
 * Units: IS in A, CJE/CJC in F, BF dimensionless.
 *
 * IMPORTANT: This solver does NOT implement the complete referenced SPICE card:
 * no bias-dependent junction capacitances, Early effect, high-level injection,
 * resistive parasitics, transit times or thermal behavior. CJE/CJC are constant
 * zero-bias approximations. A sourced card is NOT equivalent to a validated
 * physical 2N3904/2N3906 simulation or an observed oscillator frequency.
 */
export type TransistorParameters = { beta:number; saturationA:number; cbeF:number; cbcF:number };
export const TRANSISTOR_CARDS = {
  genericNpn: { beta:EM.betaN,saturationA:EM.saturationA,cbeF:EM.cbeF,cbcF:EM.cbcF },
  genericPnp: { beta:EM.betaP,saturationA:EM.saturationA,cbeF:EM.cbeF,cbcF:EM.cbcF },
  '2n3904': { beta:416.4,saturationA:6.734e-15,cbeF:4.493e-12,cbcF:3.638e-12 },
  '2n3906': { beta:180.7,saturationA:1.41e-15,cbeF:8.063e-12,cbcF:9.728e-12 },
} as const satisfies Record<string,TransistorParameters>;

export function isTransistorModelForKind(kind:ComponentKind,model:unknown):boolean {
  if(kind!=='npn'&&kind!=='pnp')return model===undefined;
  if(model===undefined||model==='generic')return true;
  return kind==='npn'?model==='2n3904':model==='2n3906';
}
/** The standard GP path has fixed named cards; generic virtual cards stay in EM. */
export function hasSpiceModelSelections(parts:readonly ComponentInstance[]):boolean {
  return parts.every(part=>(part.kind!=='npn'||part.transistorModel==='2n3904')&&(part.kind!=='pnp'||part.transistorModel==='2n3906'));
}
export function transistorParameters(kind:'npn'|'pnp',model:TransistorModelId|undefined):TransistorParameters {
  if(!isTransistorModelForKind(kind,model))throw new Error('晶体管型号与NPN/PNP类型不匹配');
  return model==='2n3904'?TRANSISTOR_CARDS['2n3904']:model==='2n3906'?TRANSISTOR_CARDS['2n3906']:kind==='npn'?TRANSISTOR_CARDS.genericNpn:TRANSISTOR_CARDS.genericPnp;
}
