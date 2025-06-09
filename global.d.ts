// global.d.ts
interface Window {
  jspdf: any; // You can replace 'any' with more specific types if available for jsPDF
  html2canvas: any; // Added for completeness, though already declared locally in App.tsx
}
