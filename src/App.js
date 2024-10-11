import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ZoomIn, ZoomOut, Upload, X } from 'lucide-react';

const GRID_SIZE = 1000;
const PIXEL_SIZE = 5;
const CHUNK_SIZE = 100;

export default function MillionDollarHomepage() {
  const [zoom, setZoom] = useState(1);
  const [selectedPixels, setSelectedPixels] = useState(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState([0, 0]);
  const [selectionSize, setSelectionSize] = useState([0, 0]);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const gridRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  const handleZoomIn = useCallback(() => {
    setZoom(prevZoom => Math.min(prevZoom + 0.5, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prevZoom => Math.max(prevZoom - 0.5, 1));
  }, []);

  const getPixelIndex = useCallback((x, y) => {
    return y * GRID_SIZE + x;
  }, []);

  const handleMouseDown = useCallback((event) => {
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / (PIXEL_SIZE * zoom));
    const y = Math.floor((event.clientY - rect.top) / (PIXEL_SIZE * zoom));
    setSelectionStart([x, y]);
    setIsSelecting(true);
    setSelectedPixels(new Set());
  }, [zoom]);

  const handleMouseMove = useCallback((event) => {
    if (!isSelecting || !gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const endX = Math.floor((event.clientX - rect.left) / (PIXEL_SIZE * zoom));
    const endY = Math.floor((event.clientY - rect.top) / (PIXEL_SIZE * zoom));
    const [startX, startY] = selectionStart;

    const newSelectedPixels = new Set();
    for (let y = Math.min(startY, endY); y <= Math.max(startY, endY); y++) {
      for (let x = Math.min(startX, endX); x <= Math.max(startX, endX); x++) {
        newSelectedPixels.add(getPixelIndex(x, y));
      }
    }
    setSelectedPixels(newSelectedPixels);

    const width = Math.abs(endX - startX) + 1;
    const height = Math.abs(endY - startY) + 1;
    setSelectionSize([width, height]);
  }, [isSelecting, selectionStart, zoom, getPixelIndex]);

  const handleMouseUp = useCallback(() => {
    setIsSelecting(false);
  }, []);

  const handleImageUpload = useCallback(() => {
    if (imageFile && selectionSize[0] > 0 && selectionSize[1] > 0) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const [width, height] = selectionSize;
          const [startX, startY] = selectionStart;
          const aspectRatio = img.width / img.height;
          let newWidth = width;
          let newHeight = height;
          if (width / height > aspectRatio) {
            newWidth = Math.round(height * aspectRatio);
          } else {
            newHeight = Math.round(width / aspectRatio);
          }
          const offsetX = Math.floor((width - newWidth) / 2);
          const offsetY = Math.floor((height - newHeight) / 2);
          setUploadedImages(prev => [...prev, { 
            img, 
            x: startX + offsetX, 
            y: startY + offsetY, 
            width: newWidth, 
            height: newHeight,
            url: imageUrl 
          }]);
          setImageUrl('');
          setImageFile(null);
          setIsModalOpen(false);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(imageFile);
    }
  }, [selectionSize, selectionStart, imageUrl, imageFile]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsSelecting(false);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  const gridStyle = useMemo(() => ({
    width: `${GRID_SIZE * PIXEL_SIZE * zoom}px`,
    height: `${GRID_SIZE * PIXEL_SIZE * zoom}px`,
    position: 'relative',
  }), [zoom]);

  const renderChunk = useCallback((ctx, startX, startY, endX, endY) => {
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const pixelX = x * PIXEL_SIZE * zoom;
        const pixelY = y * PIXEL_SIZE * zoom;
        const pixelSize = PIXEL_SIZE * zoom;

        ctx.fillStyle = 'white';
        ctx.fillRect(pixelX, pixelY, pixelSize, pixelSize);
        
        ctx.strokeStyle = '#e5e7eb';
        ctx.strokeRect(pixelX, pixelY, pixelSize, pixelSize);

        if (selectedPixels.has(getPixelIndex(x, y))) {
          ctx.fillStyle = 'rgba(0, 123, 255, 0.5)';
          ctx.fillRect(pixelX, pixelY, pixelSize, pixelSize);
        }
      }
    }

    uploadedImages.forEach(({ img, x, y, width, height }) => {
      if (x + width > startX && x < endX && y + height > startY && y < endY) {
        ctx.drawImage(
          img,
          Math.max(startX - x, 0) * PIXEL_SIZE * zoom,
          Math.max(startY - y, 0) * PIXEL_SIZE * zoom,
          Math.min(endX - x, width) * PIXEL_SIZE * zoom,
          Math.min(endY - y, height) * PIXEL_SIZE * zoom,
          Math.max(x, startX) * PIXEL_SIZE * zoom,
          Math.max(y, startY) * PIXEL_SIZE * zoom,
          Math.min(endX - x, width) * PIXEL_SIZE * zoom,
          Math.min(endY - y, height) * PIXEL_SIZE * zoom
        );
      }
    });
  }, [zoom, selectedPixels, getPixelIndex, uploadedImages]);

  const renderGrid = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    canvas.width = GRID_SIZE * PIXEL_SIZE * zoom;
    canvas.height = GRID_SIZE * PIXEL_SIZE * zoom;

    let chunkX = 0;
    let chunkY = 0;

    const renderNextChunk = () => {
      const startX = chunkX * CHUNK_SIZE;
      const startY = chunkY * CHUNK_SIZE;
      const endX = Math.min(startX + CHUNK_SIZE, GRID_SIZE);
      const endY = Math.min(startY + CHUNK_SIZE, GRID_SIZE);

      renderChunk(ctx, startX, startY, endX, endY);

      chunkX++;
      if (chunkX * CHUNK_SIZE >= GRID_SIZE) {
        chunkX = 0;
        chunkY++;
      }

      if (chunkY * CHUNK_SIZE < GRID_SIZE) {
        rafRef.current = requestAnimationFrame(renderNextChunk);
      }
    };

    renderNextChunk();
  }, [zoom, renderChunk]);

  useEffect(() => {
    renderGrid();
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [renderGrid]);

  const handleCanvasClick = useCallback((event) => {
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / (PIXEL_SIZE * zoom));
    const y = Math.floor((event.clientY - rect.top) / (PIXEL_SIZE * zoom));
    
    const clickedImage = uploadedImages.find(img => 
      x >= img.x && x < img.x + img.width && 
      y >= img.y && y < img.y + img.height
    );

    if (clickedImage && clickedImage.url) {
      window.open(clickedImage.url, '_blank');
    }
  }, [uploadedImages, zoom]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-yellow-400 relative overflow-x-hidden p-4 sm:p-6 md:p-8">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50"></div>
      <div className="container mx-auto max-w-[1200px] bg-white bg-opacity-90 rounded-lg shadow-2xl p-4 sm:p-6 md:p-8 relative z-10 my-4 sm:my-6 md:my-8">
        <header className="text-center mb-4 sm:mb-6 md:mb-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold mb-2 sm:mb-3 md:mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-green-500" style={{ fontFamily: "'Bungee Shade', cursive" }}>
            The Million Dollar
          </h1>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold mb-2 sm:mb-3 md:mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-green-500" style={{ fontFamily: "'Bungee Shade', cursive" }}>
            $$Web3
          </h1>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold mb-2 sm:mb-3 md:mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-green-500" style={{ fontFamily: "'Bungee Shade', cursive" }}>
            Homepage
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl mb-2 sm:mb-3 md:mb-4 text-gray-700">1,000,000 pixels @ $1 per pixel</p>
          <p className="text-sm sm:text-base md:text-lg text-gray-600 mb-2 sm:mb-3 md:mb-4 font-semibold">
            Click and drag to select pixels. Selected area: {selectionSize[0]} x {selectionSize[1]} pixels
          </p>
        </header>

        <div className="flex flex-col sm:flex-row justify-center items-center mb-4 sm:mb-5 md:mb-6 space-y-2 sm:space-y-0 sm:space-x-2 md:space-x-4">
          <button onClick={handleZoomOut} disabled={zoom === 1} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold py-1 px-2 sm:py-2 sm:px-3 md:py-2 md:px-4 rounded-full transition duration-300 flex items-center text-xs sm:text-sm md:text-base">
            <ZoomOut className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5" /> Zoom Out
          </button>
          <button onClick={handleZoomIn} disabled={zoom === 4} className="bg-gradient-to-r from-green-400 to-blue-500 hover:from-green-500 hover:to-blue-600 text-white font-bold py-1 px-2 sm:py-2 sm:px-3 md:py-2 md:px-4 rounded-full transition duration-300 flex items-center text-xs sm:text-sm md:text-base">
            <ZoomIn className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5" /> Zoom In
          </button>
          <button 
            onClick={() => setIsModalOpen(true)} 
            disabled={selectedPixels.size === 0}
            className="bg-gradient-to-r from-purple-400 to-pink-500 hover:from-purple-500 hover:to-pink-600 text-white font-bold py-1 px-2 sm:py-2 sm:px-3 md:py-2 md:px-4 rounded-full transition duration-300 flex items-center text-xs sm:text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5" /> Upload Details
          </button>
        </div>

        <div className="border-2 sm:border-3 md:border-4 border-gray-300 rounded-lg shadow-inner overflow-hidden">
          <div 
            ref={gridRef}
            style={gridStyle}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={handleCanvasClick}
          >
            <canvas
              ref={canvasRef}
              style={{ width: '100%', height: '100%' }}
            />
          
          </div>
        </div>

        <footer className="mt-4 sm:mt-6 md:mt-8 text-center text-xs sm:text-sm md:text-base text-gray-600">
          <p>© Made with ❤️ for Web3, by a Web3 Dude 😎</p>
        </footer>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Upload Image and URL</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files[0])}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700 mb-2">
                Image URL
              </label>
              <input
                type="text"
                id="imageUrl"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://example.com/image-link"
              />
            </div>
            <button
              onClick={handleImageUpload}
              disabled={!imageFile}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Upload
            </button>
          </div>
        </div>
      )}
    </div>
  );
}