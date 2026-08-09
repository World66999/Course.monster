export type ChallengeType = "slider" | "dial" | "sequence";

export interface SliderParams {
  target: number;
  tolerance: number;
}
export interface DialParams {
  target: number;
  tolerance: number;
}
export interface SequenceParams {
  tiles: number;
  sequence: number[];
}

export type ChallengeParams = SliderParams | DialParams | SequenceParams;

export interface IssuedChallenge {
  type: ChallengeType;
  params: ChallengeParams;
  ticket: string;
}

export interface InteractionTrace {
  elapsedMs: number;
  samples: number;
}

export interface ChallengeCompletion {
  solution: unknown;
  trace: InteractionTrace;
}
