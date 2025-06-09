
export interface APCoordinate {
  x: number;
  y: number;
}

export interface OptimizationResult {
  nAP: number;
  coordinates: APCoordinate[];
  message?: string;
}

export interface BuildingDimensions {
  length: number;
  width: number;
}
    