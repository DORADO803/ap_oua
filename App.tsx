
import React, { useState, useCallback, useRef, useEffect } from 'react';
import Input from './components/Input';
import Button from './components/Button';
import BuildingVisualizer from './components/BuildingVisualizer';
import InteractivePlanDisplay from './components/InteractivePlanDisplay';
import { calculateAPPlacement } from './services/optimizationService';
import type { OptimizationResult, APCoordinate, BuildingDimensions } from './types';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Declare html2canvas to inform TypeScript about global variable from CDN
declare var html2canvas: any;

const App: React.FC = () => {
  const initialCoverageArea = '200'; // Used for fallback in calculatedRadiusForViz
  const [coverageAreaInput, setCoverageAreaInput] = useState<string>('');
  const [buildingLength, setBuildingLength] = useState<string>('');
  const [buildingWidth, setBuildingWidth] = useState<string>('');
  
  // Algorithmic Optimization State
  const [results, setResults] = useState<OptimizationResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  // AI Optimization State
  const [aiResults, setAiResults] = useState<OptimizationResult | null>(null);
  const [isAiOptimizing, setIsAiOptimizing] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isDownloadingAiPdf, setIsDownloadingAiPdf] = useState<boolean>(false);

  // Manual Placement State
  const [isDownloadingManualPdf, setIsDownloadingManualPdf] = useState<boolean>(false);
  const [uploadedPlanNaturalDimensions, setUploadedPlanNaturalDimensions] = useState<{width: number, height: number} | null>(null);


  const [calculatedRadiusForViz, setCalculatedRadiusForViz] = useState<number>(() => Math.sqrt(parseFloat(initialCoverageArea) / 2));

  // State for manual AP placement on plan
  const [uploadedPlanImage, setUploadedPlanImage] = useState<File | null>(null);
  const [uploadedPlanImageDataUrl, setUploadedPlanImageDataUrl] = useState<string | null>(null);
  const [manualAPs, setManualAPs] = useState<APCoordinate[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Effect to update calculatedRadiusForViz when coverageAreaInput changes
  useEffect(() => {
    const area = parseFloat(coverageAreaInput);
    if (!isNaN(area) && area > 0) {
      setCalculatedRadiusForViz(Math.sqrt(area / 2));
    } else {
      // Fallback if input is invalid or empty, using initial area constant
      setCalculatedRadiusForViz(Math.sqrt(parseFloat(initialCoverageArea) / 2));
    }
  }, [coverageAreaInput, initialCoverageArea]);

  const clearPlan = useCallback(() => {
    setUploadedPlanImage(null);
    setUploadedPlanImageDataUrl(null);
    setManualAPs([]);
    setUploadedPlanNaturalDimensions(null);
    if(fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleClearAll = useCallback(() => {
    setCoverageAreaInput('');
    setBuildingLength('');
    setBuildingWidth('');
    setResults(null);
    setError(null);
    setAiResults(null);
    setAiError(null);
    clearPlan();
    // calculatedRadiusForViz will be updated by its useEffect due to coverageAreaInput change
  }, [clearPlan]);


  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setResults(null); 

    const area_m2 = parseFloat(coverageAreaInput);
    const l = parseFloat(buildingLength);
    const w = parseFloat(buildingWidth);

    if (isNaN(area_m2) || isNaN(l) || isNaN(w)) {
      setError('Por favor, ingrese valores numéricos válidos.');
      setIsLoading(false);
      return;
    }
    if (area_m2 <= 0 || l <= 0 || w <= 0) {
      setError('Los valores de área y dimensiones deben ser positivos.');
      setIsLoading(false);
      return;
    }

    const rParamForAlgorithm = Math.sqrt(area_m2 / 2);
    
    // Directly call the calculation, it can be synchronous and potentially long
    const optimizationData = calculateAPPlacement(rParamForAlgorithm, l, w);
    
    if (optimizationData.message && optimizationData.coordinates.length === 0) {
        setError(optimizationData.message);
    } else if (optimizationData.message) {
        // Display message even if some coordinates were generated (e.g., warning or info)
        setError(optimizationData.message); 
        setResults(optimizationData); // Still show results if any
    }
    else {
        setResults(optimizationData);
    }
    setIsLoading(false);

  }, [coverageAreaInput, buildingLength, buildingWidth]);

  const getAiPlacementSuggestions = async (
      length: number,
      width: number,
      coverageArea: number,
      planImageFile: File | null,
  ): Promise<OptimizationResult> => {
    if (!process.env.API_KEY) {
        throw new Error("La clave API de Google GenAI no está configurada en el entorno.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const modelName = 'gemini-2.5-flash-preview-04-17';

    let promptText = `Eres un experto en planificación de redes Wi-Fi. Para un edificio de ${length}m de largo por ${width}m de ancho, y donde cada AP cubre aproximadamente ${coverageArea}m², sugiere coordenadas X,Y óptimas para los Puntos de Acceso.
El origen (0,0) es la esquina superior izquierda del edificio.
Las coordenadas X deben estar entre 0 y ${length}.
Las coordenadas Y deben estar entre 0 y ${width}.
IMPORTANTE: Devuelve tu respuesta ÚNICAMENTE como un array JSON de objetos, donde cada objeto es {"x": number, "y": number}. No incluyas ninguna otra explicación o texto fuera del array JSON. Ejemplo: [{"x": 10.5, "y": 20.0}, {"x": 30.2, "y": 15.7}]`;

    const requestPayload: any = { 
      model: modelName,
      config: { 
        responseMimeType: "application/json",
      }
    };

    let imagePart = null;
    if (planImageFile) {
      promptText += "\nSe proporciona una imagen del plano. Considera el diseño visual, los posibles obstáculos y los espacios abiertos para refinar las ubicaciones de los AP para una cobertura óptima y una interferencia mínima. Coloca los AP en ubicaciones sensatas según la información visual.";
      
      const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(planImageFile);
      });

      imagePart = {
        inlineData: {
          mimeType: planImageFile.type || 'image/png',
          data: base64Data,
        },
      };
      requestPayload.contents = { parts: [imagePart, { text: promptText }] };
    } else {
      requestPayload.contents = promptText;
    }
    
    try {
      const response: GenerateContentResponse = await ai.models.generateContent(requestPayload);
      if (!response.text) {
        throw new Error("La respuesta de la IA no contiene texto.");
      }
      let jsonStr = response.text.trim();
      
      const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
      const match = jsonStr.match(fenceRegex);
      if (match && match[2]) {
        jsonStr = match[2].trim();
      }

      const parsedData = JSON.parse(jsonStr);

      if (Array.isArray(parsedData) && parsedData.every(item => typeof item.x === 'number' && typeof item.y === 'number')) {
        const validatedCoordinates = parsedData
          .map(ap => ({
            x: parseFloat(ap.x.toFixed(2)), 
            y: parseFloat(ap.y.toFixed(2)),
          }))
          .filter(ap => 
            !isNaN(ap.x) && !isNaN(ap.y) &&
            ap.x >= 0 && ap.x <= length && 
            ap.y >= 0 && ap.y <= width
          );
        
        if (validatedCoordinates.length === 0 && parsedData.length > 0) {
           return { nAP: 0, coordinates: [], message: "La IA devolvió coordenadas, pero ninguna era válida o estaba dentro de los límites del edificio después del formateo." };
        }
        return { nAP: validatedCoordinates.length, coordinates: validatedCoordinates, message: validatedCoordinates.length > 0 ? undefined : "La IA no devolvió coordenadas válidas." };
      } else {
        throw new Error("La respuesta de la IA no tiene el formato esperado (array de objetos {x, y}).");
      }
    } catch (e: any) {
      console.error("Error processing AI response:", e);
      const errorMessage = e.message || "Error desconocido al procesar la respuesta de la IA.";
      const rawText = e.response?.text || (e.toString ? e.toString() : "");
      throw new Error(`${errorMessage} Raw: ${rawText.substring(0,300)}`);
    }
  };

  const handleAiOptimize = async () => {
    setIsAiOptimizing(true);
    setAiError(null);
    setAiResults(null); 

    const l = parseFloat(buildingLength);
    const w = parseFloat(buildingWidth);
    const area = parseFloat(coverageAreaInput);

    if (isNaN(l) || isNaN(w) || isNaN(area) || l <= 0 || w <= 0 || area <= 0) {
      setAiError('Por favor, ingrese valores numéricos válidos y positivos para dimensiones y área de cobertura.');
      setIsAiOptimizing(false);
      return;
    }
    
    if (!process.env.API_KEY) {
        setAiError("La clave API de Google GenAI no está configurada. La optimización con IA no está disponible.");
        setIsAiOptimizing(false);
        return;
    }

    try {
      const aiData = await getAiPlacementSuggestions(l, w, area, uploadedPlanImage);
      
      if (aiData.coordinates.length === 0 && !aiData.message) {
          setAiResults({ ...aiData, message: "La IA no sugirió ninguna ubicación de AP."});
      } else {
          setAiResults(aiData);
      }
    } catch (e: any) {
      setAiError(e.message || 'Ocurrió un error durante la optimización con IA.');
    } finally {
      setIsAiOptimizing(false);
    }
  };

  const handlePlanImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedPlanImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setUploadedPlanImageDataUrl(dataUrl);
        setManualAPs([]); // Clear APs on new plan upload
        // Get natural dimensions
        const img = new Image();
        img.onload = () => {
            setUploadedPlanNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
            setUploadedPlanNaturalDimensions(null); // Reset if image fails to load
            console.error("Error loading image to get natural dimensions.");
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    } else {
      setUploadedPlanImage(null);
      setUploadedPlanImageDataUrl(null);
      setManualAPs([]);
      setUploadedPlanNaturalDimensions(null);
    }
  };

  const handlePlanClick = useCallback((coords: APCoordinate) => {
    const MIN_DISTANCE_THRESHOLD = 5; // Minimum distance in original image pixels to consider a new AP as distinct

    const isTooCloseToExisting = manualAPs.some(existingAP => {
      const distanceSquared = Math.pow(existingAP.x - coords.x, 2) + Math.pow(existingAP.y - coords.y, 2);
      return distanceSquared < (MIN_DISTANCE_THRESHOLD * MIN_DISTANCE_THRESHOLD);
    });

    if (!isTooCloseToExisting) {
      setManualAPs(prevAPs => [...prevAPs, coords]);
    } else {
      // Optionally, provide user feedback that the AP was not added because it's too close.
      console.log("AP not added: too close to an existing AP.");
    }
  }, [manualAPs]);

  const clearManualAPs = useCallback(() => setManualAPs([]),[]);

  const handleDeleteManualAp = useCallback((index: number) => {
    setManualAPs(prevAPs => prevAPs.filter((_, i) => i !== index));
  },[]);

  const handleMoveManualAp = useCallback((index: number, newCoords: APCoordinate) => {
    setManualAPs(prevAPs => prevAPs.map((ap, i) => (i === index ? newCoords : ap)));
  },[]);
  
  const currentBuildingDimensions: BuildingDimensions = {
    length: parseFloat(buildingLength) || 0,
    width: parseFloat(buildingWidth) || 0,
  };

  const handleDownloadPdf = async (isAiPdf: boolean) => {
    const sourceResults = isAiPdf ? aiResults : results;
    const visualizerId = isAiPdf ? 'ai-building-visualization-for-pdf' : 'algorithmic-building-visualization-for-pdf';
    const pdfFileName = isAiPdf ? 'ap_ai_optimization_results.pdf' : 'ap_optimization_results.pdf';
    const reportTitle = isAiPdf ? "Reporte de Optimización de APs (IA)" : "Reporte de Optimización de APs (Algoritmo)";
    const numApsLabel = isAiPdf ? "Número de APs Sugeridos por IA" : "Número de APs Optimizados";

    if (!sourceResults || !sourceResults.coordinates || sourceResults.coordinates.length === 0) {
      alert(`No hay resultados ${isAiPdf ? '(IA)' : '(Algoritmo)'} para descargar o no se generaron coordenadas.`);
      return;
    }

    if (isAiPdf) setIsDownloadingAiPdf(true); else setIsDownloadingPdf(true);

    try {
      const doc = new window.jspdf.jsPDF();
      doc.setFontSize(18);
      doc.text(reportTitle, 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Fecha de generación: ${new Date().toLocaleDateString()}`, 14, 30);

      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text("Parámetros de Entrada:", 14, 45);
      doc.setFontSize(10);
      const paramsStartY = 52;
      const lineHeight = 7;
      doc.text(`- Largo del Edificio: ${buildingLength} m`, 14, paramsStartY);
      doc.text(`- Ancho del Edificio: ${buildingWidth} m`, 14, paramsStartY + lineHeight);
      doc.text(`- Área de Cobertura por AP: ${coverageAreaInput} m²`, 14, paramsStartY + 2 * lineHeight);
      doc.text(`- Radio de Cobertura Visualizado: ${calculatedRadiusForViz.toFixed(2)} m`, 14, paramsStartY + 3 * lineHeight);
      doc.text(`- ${numApsLabel}: ${sourceResults.nAP}`, 14, paramsStartY + 4 * lineHeight);
      
      let currentY = paramsStartY + 5 * lineHeight + 10;

      doc.setFontSize(12);
      doc.text(`Coordenadas de APs ${isAiPdf ? '(IA)' : '(Optimizadas)'}:`, 14, currentY);
      currentY += 6;

      const tableColumn = [`AP # ${isAiPdf ? '(IA)' : ''}`, "Coordenada X (m)", "Coordenada Y (m)"];
      const tableRows = sourceResults.coordinates.map((ap, index) => [
        index + 1,
        ap.x.toFixed(2),
        ap.y.toFixed(2)
      ]);

      (doc as any).autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: isAiPdf ? [67, 56, 202] : [22, 160, 133] }, 
        margin: { top: 10, right: 14, bottom: 10, left: 14 },
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 15;

      const visualizerElement = document.getElementById(visualizerId);
      if (visualizerElement) {
        const pageHeight = doc.internal.pageSize.height;
        const imageRenderHeight = 100; 
        if (currentY + imageRenderHeight > pageHeight - 20) {
            doc.addPage();
            currentY = 20;
        }
        
        doc.setFontSize(12);
        doc.text("Visualización del Edificio y APs:", 14, currentY);
        currentY += 8;

        const canvas = await html2canvas(visualizerElement, { 
            scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff',
        });
        const imgData = canvas.toDataURL('image/png');
        
        const imgProps = doc.getImageProperties(imgData);
        const pdfPageWidth = doc.internal.pageSize.getWidth() - 28;
        const imgWidth = pdfPageWidth;
        const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

        doc.addImage(imgData, 'PNG', 14, currentY, imgWidth, imgHeight);
      } else {
         doc.text(`No se pudo capturar la visualización (${visualizerId}).`, 14, currentY + 10);
      }
      doc.save(pdfFileName);
    } catch (e) {
      console.error(`Error generating ${isAiPdf ? 'AI ' : ''}PDF:`, e);
      alert(`Hubo un error al generar el PDF ${isAiPdf ? 'de resultados de IA' : 'de resultados'}.`);
    } finally {
      if (isAiPdf) setIsDownloadingAiPdf(false); else setIsDownloadingPdf(false);
    }
  };

  const handleDownloadManualPdf = async () => {
    if (!uploadedPlanImageDataUrl || manualAPs.length === 0) {
      alert("Por favor, cargue un plano y marque al menos un AP para generar el PDF.");
      return;
    }
    setIsDownloadingManualPdf(true);

    try {
      const doc = new window.jspdf.jsPDF();
      doc.setFontSize(18);
      doc.text("Reporte de Ubicaciones Manuales de APs", 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Fecha de generación: ${new Date().toLocaleDateString()}`, 14, 30);

      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text("Parámetros Relevantes:", 14, 45);
      doc.setFontSize(10);
      const paramsStartY = 52;
      const lineHeight = 7;
      doc.text(`- Largo del Edificio (para escala): ${buildingLength} m`, 14, paramsStartY);
      doc.text(`- Área de Cobertura por AP (visualización): ${coverageAreaInput} m²`, 14, paramsStartY + lineHeight);
      doc.text(`- Radio de Cobertura Visualizado: ${calculatedRadiusForViz.toFixed(2)} m`, 14, paramsStartY + 2 * lineHeight);
      doc.text(`- Número de APs Marcados: ${manualAPs.length}`, 14, paramsStartY + 3 * lineHeight);
      
      let currentY = paramsStartY + 4 * lineHeight + 10;

      const visualizerElement = document.getElementById('manual-plan-visualization-for-pdf');
      if (visualizerElement) {
        const pageHeight = doc.internal.pageSize.height;
        const imageRenderHeight = 120; // Estimate height for plan image
        if (currentY + imageRenderHeight > pageHeight - 20) { // Check if image fits
            doc.addPage();
            currentY = 20;
        }
        
        doc.setFontSize(12);
        doc.text("Plano con APs Marcados:", 14, currentY);
        currentY += 8;

        const canvas = await html2canvas(visualizerElement, { 
            scale: 1.5, // Adjusted scale for potentially larger display
            useCORS: true, 
            logging: false, 
            backgroundColor: '#ffffff',
            scrollX: 0, // Ensure capture starts from the top-left of the element
            scrollY: 0,
            windowWidth: visualizerElement.scrollWidth, // Capture full scrollable width
            windowHeight: visualizerElement.scrollHeight, // Capture full scrollable height
        });
        const imgData = canvas.toDataURL('image/png');
        
        const imgProps = doc.getImageProperties(imgData);
        const pdfPageWidth = doc.internal.pageSize.getWidth() - 28; // Page width - margins
        let imgWidth = pdfPageWidth;
        let imgHeight = (imgProps.height * imgWidth) / imgProps.width;
        const maxImgHeight = pageHeight - currentY - 20; // Max height available on current page
        
        if (imgHeight > maxImgHeight) {
            imgHeight = maxImgHeight;
            imgWidth = (imgProps.width * imgHeight) / imgProps.height;
        }
        if (imgWidth > pdfPageWidth) { // Recalculate if constrained by height
            imgWidth = pdfPageWidth;
            imgHeight = (imgProps.height * imgWidth) / imgProps.width;
        }


        doc.addImage(imgData, 'PNG', 14, currentY, imgWidth, imgHeight);
        currentY += imgHeight + 10;
      } else {
         doc.text("No se pudo capturar la visualización del plano manual.", 14, currentY + 10);
         currentY += 20;
      }

      if (currentY > doc.internal.pageSize.height - 40) { // Check space for table
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(12);
      doc.text("Coordenadas de APs Marcados Manualmente:", 14, currentY);
      currentY += 6;

      let pixelsPerMeterScaleManual = 0;
      if (uploadedPlanNaturalDimensions && uploadedPlanNaturalDimensions.width > 0 && parseFloat(buildingLength) > 0) {
        pixelsPerMeterScaleManual = uploadedPlanNaturalDimensions.width / parseFloat(buildingLength);
      }

      const tableColumn = ["AP #", "Pixel X", "Pixel Y", "X (m) Est.", "Y (m) Est."];
      const tableRows = manualAPs.map((ap, index) => {
        const x_m = pixelsPerMeterScaleManual > 0 ? (ap.x / pixelsPerMeterScaleManual).toFixed(2) : 'N/A';
        const y_m = pixelsPerMeterScaleManual > 0 ? (ap.y / pixelsPerMeterScaleManual).toFixed(2) : 'N/A'; // Simplistic Y scale
        return [
            index + 1,
            ap.x.toFixed(0),
            ap.y.toFixed(0),
            x_m,
            y_m
        ];
      });

      (doc as any).autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [34, 197, 94] }, // Green theme for manual
        margin: { top: 10, right: 14, bottom: 10, left: 14 },
      });
      
      doc.save('ap_manual_placement_results.pdf');
    } catch (e) {
      console.error("Error generating Manual PDF:", e);
      alert("Hubo un error al generar el PDF de ubicaciones manuales.");
    } finally {
      setIsDownloadingManualPdf(false);
    }
  };

  const spinner = (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
   const secondarySpinner = (
    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-extrabold text-white sm:text-5xl tracking-tight">
            Optimizador de Ubicación de APs
          </h1>
          <p className="mt-3 text-lg text-slate-300">
            Calcule la distribución óptima o marque ubicaciones de puntos de acceso en su edificio.
          </p>
        </header>

        {/* Optimization Form */}
        <form onSubmit={handleSubmit} className="bg-white shadow-2xl rounded-xl p-6 md:p-10 space-y-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-1">Parámetros de Configuración</h2>
           <p className="text-sm text-gray-600 mb-4">
            Ingrese los parámetros del edificio para la optimización. Estos se usarán para todos los métodos.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Input label="Área de Cobertura por AP (m²)" id="coverageArea" type="number" value={coverageAreaInput} onChange={(e) => setCoverageAreaInput(e.target.value)} placeholder="Ej: 200" min="1" step="1" required aria-describedby="coverageAreaHelp"/>
            <Input label="Largo del Edificio (m)" id="buildingLength" type="number" value={buildingLength} onChange={(e) => setBuildingLength(e.target.value)} placeholder="Ej: 50" min="1" step="0.1" required aria-describedby="lengthHelp"/>
            <Input label="Ancho del Edificio (m)" id="buildingWidth" type="number" value={buildingWidth} onChange={(e) => setBuildingWidth(e.target.value)} placeholder="Ej: 30" min="1" step="0.1" required aria-describedby="widthHelp"/>
          </div>
          <div id="coverageAreaHelp" className="text-xs text-gray-500 mt-1">Área cuadrada que se espera cubrir por cada AP. El radio se calcula internamente.</div>
          <div id="lengthHelp" className="text-xs text-gray-500 mt-1">Dimensión más larga del edificio. Usada para escalar radios en el plano.</div>
          <div id="widthHelp" className="text-xs text-gray-500 mt-1">Dimensión más corta del edificio.</div>

          <div className="flex flex-col md:flex-row justify-between items-center pt-4 space-y-3 md:space-y-0 md:space-x-3">
            <div className="flex flex-col md:flex-row md:items-center space-y-3 md:space-y-0 md:space-x-3 w-full md:w-auto">
              <Button type="submit" disabled={isLoading || isAiOptimizing} className="w-full md:w-auto">
                {isLoading ? <div className="flex items-center justify-center">{spinner} Calculando...</div> : 'Calcular (Algoritmo)'}
              </Button>
              <Button type="button" onClick={handleAiOptimize} disabled={isAiOptimizing || isLoading} variant="secondary" className="w-full md:w-auto">
                {isAiOptimizing ? <div className="flex items-center justify-center">{secondarySpinner} Optimizando IA...</div> : 'Optimizar con IA'}
              </Button>
            </div>
            <Button type="button" onClick={handleClearAll} disabled={isLoading || isAiOptimizing} variant="secondary" className="w-full md:w-auto order-first md:order-last mt-3 md:mt-0">
               Limpiar Todo
            </Button>
          </div>
        </form>

        {error && (
          <div className="mt-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md shadow-md" role="alert">
            <p className="font-bold">Error (Algoritmo)</p>
            <p className="whitespace-pre-line">{error}</p>
          </div>
        )}
        {aiError && (
          <div className="mt-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md shadow-md" role="alert">
            <p className="font-bold">Error (IA)</p>
            <p className="whitespace-pre-line">{aiError}</p>
          </div>
        )}

        {/* Algorithmic Optimization Results */}
        {results && (
          <div className="mt-10 bg-white shadow-xl rounded-lg p-6 md:p-8">
            <div className="flex justify-between items-center mb-4">
                 <h2 className="text-2xl font-semibold text-gray-800">Resultados (Algoritmo)</h2>
                 {results.coordinates.length > 0 && (
                    <Button onClick={() => handleDownloadPdf(false)} disabled={isDownloadingPdf} variant="secondary" size="sm">
                        {isDownloadingPdf ? <div className="flex items-center">{secondarySpinner} Descargando...</div> : 'Descargar PDF (Algoritmo)'}
                    </Button>
                 )}
            </div>
            {results.coordinates.length > 0 ? (
                <>
                    <p className="text-gray-700 mb-1"><span className="font-medium">Número estimado de APs:</span> {results.nAP}</p>
                    <p className="text-gray-700 mb-4"><span className="font-medium">Coordenadas (X, Y) en metros:</span></p>
                    <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 mb-6">
                        <thead className="bg-gray-50"><tr><th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AP #</th><th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">X</th><th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Y</th></tr></thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                        {results.coordinates.map((ap, index) => (<tr key={`opt-ap-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{index + 1}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ap.x.toFixed(2)}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ap.y.toFixed(2)}</td></tr>))}
                        </tbody>
                    </table>
                    </div>
                    <BuildingVisualizer visualizationId="algorithmic-building-visualization-for-pdf" building={currentBuildingDimensions} aps={results.coordinates} coverageRadius={calculatedRadiusForViz} planImageUrl={uploadedPlanImageDataUrl} />
                </>
            ) : (
                 <p className="text-gray-600">{results.message || 'No se pudieron generar ubicaciones de AP con el algoritmo.'}</p>
            )}
          </div>
        )}

        {/* AI Optimization Results */}
        {aiResults && (
          <div className="mt-10 bg-white shadow-xl rounded-lg p-6 md:p-8 border-2 border-indigo-500">
            <div className="flex justify-between items-center mb-4">
                 <h2 className="text-2xl font-semibold text-indigo-700">Resultados (IA)</h2>
                 {aiResults.coordinates.length > 0 && (
                    <Button onClick={() => handleDownloadPdf(true)} disabled={isDownloadingAiPdf} variant="secondary" size="sm" className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700">
                        {isDownloadingAiPdf ? <div className="flex items-center">{secondarySpinner} Descargando...</div> : 'Descargar PDF (IA)'}
                    </Button>
                 )}
            </div>
             {aiResults.coordinates.length > 0 ? (
                <>
                    <p className="text-gray-700 mb-1"><span className="font-medium">Número de APs sugeridos por IA:</span> {aiResults.nAP}</p>
                    <p className="text-gray-700 mb-4"><span className="font-medium">Coordenadas (X, Y) en metros:</span></p>
                    <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 mb-6">
                        <thead className="bg-indigo-50"><tr><th scope="col" className="px-6 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">AP # (IA)</th><th scope="col" className="px-6 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">X</th><th scope="col" className="px-6 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">Y</th></tr></thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                        {aiResults.coordinates.map((ap, index) => (<tr key={`ai-ap-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-indigo-50'}><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{index + 1}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ap.x.toFixed(2)}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ap.y.toFixed(2)}</td></tr>))}
                        </tbody>
                    </table>
                    </div>
                    <BuildingVisualizer visualizationId="ai-building-visualization-for-pdf" building={currentBuildingDimensions} aps={aiResults.coordinates} coverageRadius={calculatedRadiusForViz} planImageUrl={uploadedPlanImageDataUrl} />
                </>
            ) : (
                <p className="text-gray-600">{aiResults.message || 'La IA no generó ubicaciones de AP válidas.'}</p>
            )}
          </div>
        )}


        {/* Manual AP Placement Section */}
        <div className="mt-10 bg-white shadow-2xl rounded-xl p-6 md:p-10 space-y-6">
          <div className="flex flex-wrap justify-between items-center mb-1">
            <h2 className="text-2xl font-semibold text-gray-800">Plano y Ubicaciones Manuales</h2>
            {uploadedPlanImageDataUrl && manualAPs.length > 0 && (
                 <Button onClick={handleDownloadManualPdf} disabled={isDownloadingManualPdf} variant="secondary" size="sm" className="bg-green-100 hover:bg-green-200 text-green-700 mt-2 sm:mt-0">
                    {isDownloadingManualPdf ? <div className="flex items-center">{secondarySpinner} Descargando...</div> : 'Descargar PDF (Manual)'}
                </Button>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Cargue una imagen de su plano (PNG, JPG, SVG) y marque las ubicaciones de los APs.
            Los círculos de cobertura y las coordenadas métricas estimadas se basan en el 'Largo del Edificio'.
          </p>
          <div className="space-y-4">
            <div>
              <label htmlFor="planImageUpload" className="block text-sm font-medium text-gray-700 mb-1">
                Cargar Imagen del Plano (.png, .jpg, .jpeg, .svg)
              </label>
              <input ref={fileInputRef} type="file" id="planImageUpload" accept=".png,.jpg,.jpeg,.svg" onChange={handlePlanImageUpload} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" aria-describedby="planUploadHelp"/>
              <p id="planUploadHelp" className="mt-1 text-xs text-gray-500">Esta imagen se usará como fondo para la visualización de resultados y puede ser enviada a la IA para la optimización.</p>
            </div>
            {uploadedPlanImageDataUrl && (<Button onClick={clearPlan} variant="secondary" type="button" size="sm" className="mr-2">Quitar Plano</Button>)}
          </div>

          {uploadedPlanImageDataUrl && (
            <InteractivePlanDisplay 
                visualizationId="manual-plan-visualization-for-pdf"
                imageDataUrl={uploadedPlanImageDataUrl} 
                manualAPs={manualAPs} 
                onImageClick={handlePlanClick} 
                coverageRadiusMeters={calculatedRadiusForViz} 
                buildingLengthMeters={parseFloat(buildingLength) || 0}
                onDeleteAp={handleDeleteManualAp}
                onMoveAp={handleMoveManualAp}
            />
          )}

          {uploadedPlanImageDataUrl && manualAPs.length > 0 && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-3"><h3 className="text-lg font-semibold text-gray-800">APs Marcados Manualmente ({manualAPs.length})</h3><Button onClick={clearManualAPs} variant="secondary" size="sm" type="button">Limpiar Marcas</Button></div>
              <div className="overflow-x-auto max-h-60 border border-gray-200 rounded-md">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AP #</th>
                            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pixel X</th>
                            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pixel Y</th>
                            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">X (m) Est.</th>
                            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Y (m) Est.</th>
                        </tr>
                    </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(() => {
                        let pixelsPerMeterScaleManual = 0;
                        if (uploadedPlanNaturalDimensions && uploadedPlanNaturalDimensions.width > 0 && parseFloat(buildingLength) > 0) {
                            pixelsPerMeterScaleManual = uploadedPlanNaturalDimensions.width / parseFloat(buildingLength);
                        }
                        return manualAPs.map((ap, index) => {
                            const x_m = pixelsPerMeterScaleManual > 0 ? (ap.x / pixelsPerMeterScaleManual).toFixed(2) : 'N/A';
                            const y_m = pixelsPerMeterScaleManual > 0 ? (ap.y / pixelsPerMeterScaleManual).toFixed(2) : 'N/A'; // Simple Y scaling
                            return (
                                <tr key={`manual-ap-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{index + 1}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{ap.x.toFixed(0)}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{ap.y.toFixed(0)}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{x_m}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{y_m}</td>
                                </tr>
                            );
                        });
                    })()}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-gray-500">Coordenadas en píxeles son relativas a la imagen original. Coordenadas métricas (Est.) se calculan usando el 'Largo del Edificio' y el ancho de la imagen como referencia de escala.</p>
            </div>
          )}
          {uploadedPlanImageDataUrl && manualAPs.length === 0 && (<p className="mt-4 text-sm text-gray-600">Haga clic en el plano para marcar un AP.</p>)}
        </div>

      </div>
      <footer className="mt-12 text-center text-slate-400 text-sm">
        <p>&copy; {new Date().getFullYear()} AP Placement Optimizer.</p>
      </footer>
    </div>
  );
};

export default App;
