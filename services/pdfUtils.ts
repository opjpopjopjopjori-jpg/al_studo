// We declare the global window variable for pdfjsLib loaded via CDN
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

/**
 * Converts a PDF file into an array of Base64 strings (images), one for each page.
 * Optimized for speed using parallel batch processing.
 */
export const convertPdfToImages = async (file: File): Promise<string[]> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Load the document using the global pdfjsLib
    const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    const totalPages = pdf.numPages;
    // Pre-allocate array to keep order correct
    const images: string[] = new Array(totalPages);

    // PROCESS IN BATCHES
    // Instead of doing 1 by 1, we do chunks (e.g., 4 pages at a time).
    // This balances speed with browser memory usage.
    const BATCH_SIZE = 4;
    const pageIndices = Array.from({ length: totalPages }, (_, i) => i + 1);

    for (let i = 0; i < pageIndices.length; i += BATCH_SIZE) {
      const batch = pageIndices.slice(i, i + BATCH_SIZE);
      
      // Process the current batch in parallel
      await Promise.all(batch.map(async (pageNum) => {
        const page = await pdf.getPage(pageNum);
        
        // SCALE OPTIMIZATION:
        // 1.2 is sufficient for AI to read text and screenshots clearly.
        // Reducing from 1.5 speeds up rendering significantly.
        const viewport = page.getViewport({ scale: 1.2 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (!context) {
          throw new Error("Could not create canvas context");
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        
        // QUALITY OPTIMIZATION:
        // 0.6 quality reduces the payload size drastically for upload speed
        // while remaining perfectly legible for Gemini Vision.
        const base64Url = canvas.toDataURL('image/jpeg', 0.6);
        const base64Data = base64Url.split(',')[1]; // Remove header
        
        // Assign to the correct index (pageNum is 1-based)
        images[pageNum - 1] = base64Data;
        
        // Clean up memory immediately
        page.cleanup();
        canvas.width = 0;
        canvas.height = 0;
      }));
    }

    return images;
  } catch (error) {
    console.error("Error converting PDF to images:", error);
    throw new Error(`فشل في معالجة الملف: ${file.name}. يرجى التأكد من أن الملف صالح.`);
  }
};
/** Extract digital text to save vision-model context; send image-only pages as images. */
export const extractPdfForLocalAI = async (file: File): Promise<{ text: string; images: string[] }> => {
  const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  const images: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item: any) => item.str || '').join(' ').trim();
    if (text.length >= 40) {
      pages.push(`[Page ${pageNumber}]\n${text}`);
    } else {
      const viewport = page.getViewport({ scale: 1.2 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('تعذر قراءة صفحة مصوّرة من ملف PDF.');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport }).promise;
      images.push(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
      pages.push(`[Page ${pageNumber}: see image ${images.length}]`);
      canvas.width = 0;
      canvas.height = 0;
    }
    page.cleanup();
  }
  return { text: pages.join('\n\n'), images };
};
