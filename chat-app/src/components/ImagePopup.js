import React from 'react';
import { X } from 'lucide-react';

const ImagePopup = ({ imageUrl, onClose }) => {
  console.log('ImagePopup rendered with URL:', imageUrl);

  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50"
      onClick={onClose} // Close when clicking outside the image
    >
      <div
        className="relative"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on the image or button
      >
        <button
          onClick={onClose}
          className="absolute top-0 right-0 m-4 text-white bg-black bg-opacity-50 rounded-full p-2"
        >
          <X size={24} />
        </button>
        <img src={imageUrl} alt="Popup" className="max-w-full max-h-full" />
      </div>
    </div>
  );
};

export default ImagePopup;