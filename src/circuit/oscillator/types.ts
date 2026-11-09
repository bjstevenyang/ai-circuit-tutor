import type { CircuitDocument, ComponentReading, SimulationControls } from '../types';
import type { ErrorVoltagePair, NumericModel, Precision } from './numeric';
import type { AcceptedPoint, IntegrationState, NumericLimits } from './integration';

export type OscillatorOutcome = 'periodic'|'settled-DC'|'window-no-period'|'unsupported-topology'|'unsupported-model-domain'|'unsupported-model-version'|'numerical-failure'|'resource-limit';
export type OscillatorStats = {
  accepted:number; rejected:number; passes:number; unknowns:number; reducedUnknowns:number;
  perPass:{accepted:number;rejected:number}[]; minStepS:number; maxResidualA:number; maxNewton:number;
  sourcePeakA:number; sourceMeanA?:number; maxConductionA:number; maxDisplacementA:number;
};
export type TransistorPortReading = {
  conductionA:{b:number;c:number;e:number}; displacementA:{b:number;c:number;e:number};
  totalA:{b:number;c:number;e:number};
};
export type OscillatorSample = {timeS:number;voltageV:number[]};
export type OscillatorResult = {
  outcome:OscillatorOutcome; timeS:number; reason:string; entities:string[];
  currentMa?:number; readings?:Record<string,ComponentReading>;
  nodeVoltages?:Record<string,number>; transistorPorts?:Record<string,TransistorPortReading>;
  speaker?:{id:string; voltageV:number; acRmsV:number; frequencyHz?:number; bypassed:boolean};
  samples?:OscillatorSample[]; stats?:OscillatorStats;
};
export type PassiveBranch = {id:string;a:number;b:number;value:number;kind:'resistor'|'speaker'|'capacitor'};
export type Reconstruction = {node:string;weights:Float64Array;sourceWeight:number};
export type CompiledOscillator = {
  model:NumericModel; pairs:ErrorVoltagePair[]; branches:PassiveBranch[];
  /** Electrical node identities are canonical endpoint IDs, independent of drawing order. */
  nodeIds:string[]; endpointNodes:Record<string,string>; reconstruction:Reconstruction[];
  unknowns:number; speaker?:PassiveBranch; document:CircuitDocument;
};
export type CompileOscillatorResult = {ok:true;compiled:CompiledOscillator}|{ok:false;result:OscillatorResult};
export type AnalysisOptions = {precision?:Precision;limits?:Partial<NumericLimits>};
export type OscillatorProgress = {pass:1|2;timeS:number;accepted:number;rejected:number};
export type OscillatorAdvanceResult = {state:OscillatorAnalysisState}&({done:false;progress:OscillatorProgress}|{done:true;result:OscillatorResult});
export type PeriodIntegral = {startS:number;endS:number;area:number;square:number;sourceArea:number};
export type OscillatorAnalysisState = {
  numeric:IntegrationState; precision:Precision; limits:Partial<NumericLimits>; pass:1|2;
  previous:AcceptedPoint; previousFullVoltage:Float64Array; previousSourceCurrentA:number; samples:OscillatorSample[]; nextSampleS:number;
  speakerMin:number;speakerMax:number; tailMin:Float64Array;tailMax:Float64Array;tailDerivative:number;
  sourcePeakA:number;maxConductionA:number;maxDisplacementA:number;
  threshold:number;hysteresis:number;armed:boolean;cycles:PeriodIntegral[];currentCycle?:PeriodIntegral;
  firstPassFinal?:Float64Array;firstPassCounts?:{accepted:number;rejected:number};
  firstPassStats?:{minStepS:number;maxResidualA:number;maxNewton:number};
  result?:OscillatorResult;
};
export type OscillatorRequest = {document:CircuitDocument;controls?:SimulationControls};
