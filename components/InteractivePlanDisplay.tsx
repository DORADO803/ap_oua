
import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { APCoordinate } from '../types';

interface InteractivePlanDisplayProps {
  visualizationId: string;
  imageDataUrl: string | null;
  manualAPs: APCoordinate[];
  onImageClick: (coords: APCoordinate) => void;
  coverageRadiusMeters: number;
  buildingLengthMeters: number;
  onDeleteAp: (index: number) => void;
  onMoveAp: (index: number, newCoords: APCoordinate) => void;
}

const InteractivePlanDisplay: React.FC<InteractivePlanDisplayProps> = ({
  visualizationId,
  imageDataUrl,
  manualAPs,
  onImageClick,
  coverageRadiusMeters,
  buildingLengthMeters,
  onDeleteAp,
  onMoveAp,
}) => {
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [displayedImageDimensions, setDisplayedImageDimensions] = useState<{width: number, height: number}>({width: 0, height: 0});
  const [draggingApIndex, setDraggingApIndex] = useState<number | null>(null);
  const [dragStartOffset, setDragStartOffset] = useState<{ x: number, y: number } | null>(null); // Offset from AP center to mouse click, in display pixels

  useEffect(() => {
    const imgElement = imageRef.current;
    if (imgElement) {
        const updateDimensions = () => {
          if (imgElement.complete && imgElement.naturalWidth > 0) {
            const rect = imgElement.getBoundingClientRect();
            setDisplayedImageDimensions({ width: rect.width, height: rect.height });
          } else {
            setDisplayedImageDimensions({width:0, height:0}); // Reset if image not ready
          }
        };
        
        if (imgElement.complete && imgElement.naturalWidth > 0) {
            updateDimensions();
        } else {
            imgElement.onload = updateDimensions;
            imgElement.onerror = () => {
                 setDisplayedImageDimensions({width: 0, height: 0});
                 console.error("InteractivePlanDisplay: Image failed to load or has no dimensions.");
            }
        }
        
        window.addEventListener('resize', updateDimensions);
        return () => {
            window.removeEventListener('resize', updateDimensions);
            if (imgElement) {
                imgElement.onload = null;
                imgElement.onerror = null;
            }
        };
    }
  }, [imageDataUrl]);

  const handleContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (draggingApIndex !== null) return; // Don't add AP if a drag operation just finished on the container
    if (!imageRef.current || !containerRef.current || !imageRef.current.complete || imageRef.current.naturalWidth === 0) return;

    const imageDisplayRect = imageRef.current.getBoundingClientRect(); 
    const clientX = event.clientX;
    const clientY = event.clientY;

    const xOnDisplayedImage = clientX - imageDisplayRect.left;
    const yOnDisplayedImage = clientY - imageDisplayRect.top;

    if (xOnDisplayedImage >= 0 && xOnDisplayedImage <= imageDisplayRect.width && 
        yOnDisplayedImage >= 0 && yOnDisplayedImage <= imageDisplayRect.height) {
      
      const naturalWidth = imageRef.current.naturalWidth;
      const naturalHeight = imageRef.current.naturalHeight;
      
      const originalX = (xOnDisplayedImage / imageDisplayRect.width) * naturalWidth;
      const originalY = (yOnDisplayedImage / imageDisplayRect.height) * naturalHeight;
      
      onImageClick({ x: originalX, y: originalY });
    }
  };

  const handleApMouseDown = (event: React.MouseEvent, index: number) => {
    event.stopPropagation(); // Prevent container click
    if (!imageRef.current || !imageRef.current.complete || imageRef.current.naturalWidth === 0) return;

    const ap = manualAPs[index];
    const imageDisplayRect = imageRef.current.getBoundingClientRect();
    const displayScaleX = displayedImageDimensions.width / imageRef.current.naturalWidth;
    const displayScaleY = displayedImageDimensions.height / imageRef.current.naturalHeight;

    const apCenterX_display = ap.x * displayScaleX;
    const apCenterY_display = ap.y * displayScaleY;

    setDraggingApIndex(index);
    setDragStartOffset({
      x: event.clientX - imageDisplayRect.left - apCenterX_display,
      y: event.clientY - imageDisplayRect.top - apCenterY_display,
    });
  };

  const handleApDoubleClick = (event: React.MouseEvent, index: number) => {
    event.stopPropagation();
    onDeleteAp(index);
  };
  
  const handleGlobalMouseMove = useCallback((event: MouseEvent) => {
    if (draggingApIndex === null || !imageRef.current || !dragStartOffset || !imageRef.current.complete || imageRef.current.naturalWidth === 0) return;
    event.preventDefault();

    const imageDisplayRect = imageRef.current.getBoundingClientRect();
    const naturalWidth = imageRef.current.naturalWidth;
    const naturalHeight = imageRef.current.naturalHeight;

    const mouseXOnDisplayedImage = event.clientX - imageDisplayRect.left;
    const mouseYOnDisplayedImage = event.clientY - imageDisplayRect.top;

    const newApCenterX_display = mouseXOnDisplayedImage - dragStartOffset.x;
    const newApCenterY_display = mouseYOnDisplayedImage - dragStartOffset.y;
    
    let originalX = (newApCenterX_display / displayedImageDimensions.width) * naturalWidth;
    let originalY = (newApCenterY_display / displayedImageDimensions.height) * naturalHeight;

    // Clamp to image boundaries (natural dimensions)
    originalX = Math.max(0, Math.min(originalX, naturalWidth));
    originalY = Math.max(0, Math.min(originalY, naturalHeight));
    
    onMoveAp(draggingApIndex, { x: originalX, y: originalY });
  }, [draggingApIndex, dragStartOffset, displayedImageDimensions, onMoveAp]);

  const handleGlobalMouseUp = useCallback(() => {
    if (draggingApIndex !== null) {
      setDraggingApIndex(null);
      setDragStartOffset(null);
    }
  }, [draggingApIndex]);

  useEffect(() => {
    if (draggingApIndex !== null) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [draggingApIndex, handleGlobalMouseMove, handleGlobalMouseUp]);


  if (!imageDataUrl) {
    return null;
  }
  
  const apMarkerRadiusOnScreen = 6; 
  let pixelsPerMeterScale = 0;
  let coverageRadiusInOriginalImagePixels = 0;

  if (imageRef.current && imageRef.current.naturalWidth > 0 && buildingLengthMeters > 0) {
    pixelsPerMeterScale = imageRef.current.naturalWidth / buildingLengthMeters;
    coverageRadiusInOriginalImagePixels = coverageRadiusMeters * pixelsPerMeterScale;
  }


  return (
    <div 
      id={visualizationId}
      className="mt-4 border border-gray-300 rounded-lg shadow bg-gray-50 p-2" 
      aria-label="Visualización interactiva del plano"
    >
      <p className="text-sm text-gray-600 mb-2">
        Haga clic en la imagen para marcar la ubicación de un AP. Arrastre un AP para moverlo. Doble clic en un AP para eliminarlo.
        <br />
        <span className="text-xs">
          La visualización de radios de cobertura se basa en el 'Largo del Edificio' y el ancho de esta imagen.
          Asegúrese que la dimensión principal de la imagen corresponda al largo ingresado para una escala precisa.
        </span>
      </p>
      <div
        ref={containerRef}
        className="relative w-full overflow-auto" 
        style={{ 
            maxHeight: '600px', 
            cursor: draggingApIndex !== null ? 'grabbing' : 'crosshair' 
        }} 
        onClick={handleContainerClick}
        role="group" 
        aria-label="Plano del edificio. Haga clic en la imagen para añadir un AP."
      >
        <img
          ref={imageRef}
          src={imageDataUrl}
          alt="Plano del edificio cargado por el usuario"
          className="block w-full h-auto select-none" // select-none to prevent image dragging
          style={{ 
            objectFit: 'contain',
          }} 
          draggable="false" // Prevent native image dragging
        />
        {displayedImageDimensions.width > 0 && displayedImageDimensions.height > 0 && imageRef.current && imageRef.current.complete && imageRef.current.naturalWidth > 0 && (
          <svg
            className="absolute top-0 left-0"
            width={displayedImageDimensions.width}
            height={displayedImageDimensions.height}
            viewBox={`0 0 ${displayedImageDimensions.width} ${displayedImageDimensions.height}`}
            style={{ pointerEvents: 'none' }} // SVG itself doesn't capture clicks, circles below will
          >
            {manualAPs.map((ap, index) => {
              // Ensure naturalWidth is available before scaling
              if (!imageRef.current || imageRef.current.naturalWidth === 0 || imageRef.current.naturalHeight === 0) return null;

              const displayScaleX = displayedImageDimensions.width / imageRef.current.naturalWidth;
              const displayScaleY = displayedImageDimensions.height / imageRef.current.naturalHeight;

              const apCenterX_display = ap.x * displayScaleX;
              const apCenterY_display = ap.y * displayScaleY;
              
              let coverageRadius_display = 0;
              if (pixelsPerMeterScale > 0) { // Check if scale is valid
                 coverageRadius_display = coverageRadiusInOriginalImagePixels * displayScaleX;
              }


              return (
                <g key={`manual-ap-vis-${index}`} style={{ pointerEvents: 'all', cursor: 'grab' }} 
                   onMouseDown={(e) => handleApMouseDown(e, index)}
                   onDoubleClick={(e) => handleApDoubleClick(e, index)}
                >
                  {coverageRadius_display > 0 && buildingLengthMeters > 0 && (
                    <circle
                      cx={apCenterX_display}
                      cy={apCenterY_display}
                      r={coverageRadius_display}
                      fill="rgba(52, 211, 153, 0.2)" 
                      stroke="rgba(16, 185, 129, 0.5)" 
                      strokeWidth="1"
                      strokeDasharray="3 2"
                      style={{pointerEvents: 'none'}} // Coverage circle should not be interactive itself
                    />
                  )}
                  <circle
                    cx={apCenterX_display}
                    cy={apCenterY_display}
                    r={apMarkerRadiusOnScreen + (draggingApIndex === index ? 2 : 0)} // Slightly larger when dragging
                    fill={draggingApIndex === index ? "rgba(220, 38, 38, 0.9)" : "rgba(239, 68, 68, 0.8)"}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
};

export default InteractivePlanDisplay;
