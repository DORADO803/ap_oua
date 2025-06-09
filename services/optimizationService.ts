
import type { APCoordinate, OptimizationResult } from '../types';

export const calculateAPPlacement = (
  radius: number,
  buildingLength: number,
  buildingWidth: number
): OptimizationResult => {
  const R_param = radius;
  const Largo = buildingLength;
  const Ancho = buildingWidth;

  if (R_param <= 0 || Largo <= 0 || Ancho <= 0) {
    return { nAP: 0, coordinates: [], message: "Todos los valores de entrada deben ser positivos." };
  }

  const L_calc = Math.sqrt(2) * R_param;

  // Check for L_calc being effectively zero to prevent division by zero or extreme scenarios.
  if (L_calc < 1e-6) { // Using a small epsilon for floating point comparison
      return { nAP: 0, coordinates: [], message: "El radio de cobertura produce un área de celda inválida o demasiado pequeña."};
  }

  const Area_C = L_calc * L_calc;
  const Area_E = Largo * Ancho;
  
  // Calculate target number of APs, ensuring at least 1 and enough to cover the area (ceiling).
  const nAP_target = Math.max(1, Math.ceil(Area_E / Area_C));

  let message: string | undefined = undefined;
  if (Largo < L_calc || Ancho < L_calc) {
    message = "Las dimensiones del edificio son más pequeñas que el tamaño de celda del AP (L_calc) en una o ambas direcciones. Los APs se colocarán centrados dentro del edificio para cubrirlo lo mejor posible con la configuración dada.";
  }

  // Determine the number of columns and rows for the placement grid
  // This grid aims to tile the entire building with cells of size L_calc
  const num_placement_cols = Math.max(1, Math.ceil(Largo / L_calc));
  const num_placement_rows = Math.max(1, Math.ceil(Ancho / L_calc));

  // Calculate the actual width/height of each cell in the placement grid
  // This ensures APs are spread across the entire building dimension
  const cell_placement_width = Largo / num_placement_cols;
  const cell_placement_height = Ancho / num_placement_rows;
  
  const resultado: APCoordinate[] = [];

  for (let r_idx = 0; r_idx < num_placement_rows; r_idx++) {
    for (let c_idx = 0; c_idx < num_placement_cols; c_idx++) {
      if (resultado.length >= nAP_target) {
        break; // Stop if we have placed the target number of APs
      }

      const ap_x = (c_idx + 0.5) * cell_placement_width;
      const ap_y = (r_idx + 0.5) * cell_placement_height;
      
      resultado.push({ x: ap_x, y: ap_y });
    }
    if (resultado.length >= nAP_target) {
      break;
    }
  }
  
  // Ensure all coordinates are valid numbers and formatted
  const finalCoordinates = resultado.map(ap => ({
    x: parseFloat(ap.x.toFixed(2)),
    y: parseFloat(ap.y.toFixed(2)),
  }));

  // The number of APs returned is the actual number of coordinates generated.
  return { nAP: finalCoordinates.length, coordinates: finalCoordinates, message };
};
