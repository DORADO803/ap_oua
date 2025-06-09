import React from 'react';
import type { APCoordinate, BuildingDimensions } from '../types';

interface BuildingVisualizerProps {
  visualizationId: string; // Unique ID for this visualizer instance
  building: BuildingDimensions;
  aps: APCoordinate[];
  coverageRadius: number; // For visualizing coverage circles
  planImageUrl?: string | null; // Optional URL for the floor plan image
}

const BuildingVisualizer: React.FC<BuildingVisualizerProps> = ({ visualizationId, building, aps, coverageRadius, planImageUrl }) => {
  const viewBoxWidth = 800; // Fixed SVG viewport width for consistency
  const scaleFactor = building.length > 0 ? viewBoxWidth / building.length : 1;
  const viewBoxHeight = building.width * scaleFactor;
  const padding = 20; // Padding around the building in SVG units

  const scaledAPs = aps.map(ap => ({
    x: ap.x * scaleFactor + padding,
    y: ap.y * scaleFactor + padding,
  }));

  const scaledRadius = coverageRadius * scaleFactor;

  return (
    <div 
      id={visualizationId} // Use the passed ID for PDF capture
      className="my-6 p-4 border border-gray-300 rounded-lg shadow bg-white building-visualizer-container"
    >
      <h3 className="text-lg font-semibold text-gray-800 mb-3">Visualización del Edificio y APs</h3>
      {planImageUrl && <p className="text-xs text-gray-500 mb-2">El plano cargado se muestra como fondo, ajustado a las dimensiones del edificio (puede distorsionarse si las proporciones no coinciden). Las ubicaciones de AP se superponen.</p>}
      {building.length > 0 && building.width > 0 ? (
        <svg 
          viewBox={`0 0 ${viewBoxWidth + 2 * padding} ${viewBoxHeight + 2 * padding}`} 
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-auto max-h-[500px] border border-gray-200 rounded bg-gray-50"
        >
          {/* Building Background: Image or Rectangle */}
          {planImageUrl ? (
            <image
              href={planImageUrl}
              x={padding}
              y={padding}
              width={viewBoxWidth}
              height={viewBoxHeight}
              preserveAspectRatio="none" // Stretch image to fill building dimensions
            />
          ) : (
            <rect
              x={padding}
              y={padding}
              width={viewBoxWidth}
              height={viewBoxHeight}
              fill="rgba(191, 219, 254, 0.5)"
              stroke="#60a5fa"
              strokeWidth="2"
            />
          )}

          {/* APs and Coverage Circles */}
          {scaledAPs.map((ap, index) => (
            <React.Fragment key={`ap-vis-${visualizationId}-${index}`}>
              {/* Coverage Circle */}
              <circle
                cx={ap.x}
                cy={ap.y}
                r={scaledRadius}
                fill="rgba(52, 211, 153, 0.25)"
                stroke="rgba(16, 185, 129, 0.6)"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              {/* AP Point */}
              <circle
                cx={ap.x}
                cy={ap.y}
                r="6"
                fill="#ef4444"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              <text
                x={ap.x + 10}
                y={ap.y + 5}
                fontSize="14"
                fill="#1f2937"
                stroke="#ffffff"
                strokeWidth="0.5px"
                paintOrder="stroke"
                className="font-semibold"
              >
                AP{index + 1}
              </text>
            </React.Fragment>
          ))}
           {/* Dimension Labels */}
          <text 
            x={padding + viewBoxWidth / 2} 
            y={padding - 8} 
            textAnchor="middle" 
            fontSize="12" 
            fill="#374151"
            className="font-medium"
            >
            Largo: {building.length.toFixed(2)} m
          </text>
          <text 
            x={padding - 8} 
            y={padding + viewBoxHeight / 2} 
            textAnchor="middle" 
            dominantBaseline="middle" 
            transform={`rotate(-90, ${padding - 8}, ${padding + viewBoxHeight/2})`} 
            fontSize="12" 
            fill="#374151"
            className="font-medium"
            >
            Ancho: {building.width.toFixed(2)} m
          </text>
        </svg>
      ) : (
        <p className="text-gray-500">Ingrese las dimensiones del edificio para ver la visualización.</p>
      )}
    </div>
  );
};

export default BuildingVisualizer;