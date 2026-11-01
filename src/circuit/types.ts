export type Rotation = 0 | 90 | 180 | 270;
export type Resistance = number;
export type ComponentKind = 'resistor' | 'led' | 'switch' | 'button' | 'potentiometer' | 'buzzer' | 'diode' | 'ldr';
export type ComponentInstance = {
  id: string;
  kind: ComponentKind;
  anchor: string;
  rotation: Rotation;
  resistance?: number;
  closed?: boolean;
  position?: number;
  light?: number;
};
export type Wire = { id: string; from: string; to: string; color: string; bend: 'horizontal' | 'vertical' };
export type CircuitDocument = {
  schemaVersion: 1 | 2 | 3;
  boardId: 'breadboard-30-v1';
  lessonId: 'led-series-v1' | 'dc-lab-v2';
  supplyVoltage?: number;
  components: ComponentInstance[];
  wires: Wire[];
};
export type SimulationControls = { pressedButtons?: readonly string[] };
export type DiagnosticCode = 'source-short' | 'missing-resistor' | 'resistor-bypassed' | 'led-bypassed' | 'open-circuit' | 'reversed-led' | 'overcurrent' | 'unsupported' | 'missing-led' | 'control-open' | 'insufficient-voltage' | 'reversed-diode' | 'buzzer-reversed' | 'buzzer-undervoltage' | 'buzzer-overvoltage';
export type Diagnostic = { code: DiagnosticCode; entities: string[] };
export type ComponentReading = { currentMa: number; voltageV?: number; on?: boolean; resistanceOhms?: number };
export type AnalysisResult = {
  status: 'supported' | 'fault' | 'unsupported';
  currentMa?: number;
  ledOn?: boolean;
  complete: boolean;
  diagnostics: Diagnostic[];
  readings?: Record<string, ComponentReading>;
};
export type BoardEndpoint = { id: string; x: number; y: number; group: string };
export const MAX_COMPONENTS = 24;
export const MAX_POLAR_COMPONENTS = 6;
export const MAX_WIRES = 120;
