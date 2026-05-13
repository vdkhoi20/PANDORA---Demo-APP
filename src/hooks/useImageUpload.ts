import { createElement, useCallback, useMemo, useState } from 'react';
import { Upload } from 'lucide-react';
import { useEditor } from '../state/useEditor';

/**
 * Shared file-upload behavior for any drop zone or input element.
 *
 * Returns:
 * - `onInputChange`: wire to `<input type="file" onChange={...} />`
 * - `dragHandlers`: spread on a div to make it a drop target
 * - `isDragOver`: true while a file is hovering the zone (for visual feedback)
 * - `loadFile`: imperative entry point if you have a File reference
 */
export function useImageUpload() {
  const ed = useEditor();
  const [isDragOver, setIsDragOver] = useState(false);

  const loadFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) {
        ed.setErrorBanner('Please drop an image file.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        ed.setImage(url);
        ed.setOriginalImage(url);
        ed.setResultImage(null);
        ed.setShowResult(false);
        ed.setIsComparing(false);
        ed.setImageId(null);
        ed.setMode('idle');
        ed.pushHistory({
          type: 'New image uploaded',
          icon: createElement(Upload, { size: 14 }),
          color: 'text-emerald-400',
        });
      };
      reader.readAsDataURL(file);
    },
    [ed],
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) loadFile(file);
      // Reset so picking the same file twice in a row still triggers onChange.
      e.target.value = '';
    },
    [loadFile],
  );

  const dragHandlers = useMemo(
    () => ({
      onDragEnter: (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
      },
      onDragOver: (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        setIsDragOver(true);
      },
      onDragLeave: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only un-highlight when the cursor truly leaves the zone (not a child).
        const related = e.relatedTarget as Node | null;
        if (!related || !(e.currentTarget as Node).contains(related)) {
          setIsDragOver(false);
        }
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) loadFile(file);
      },
    }),
    [loadFile],
  );

  return { loadFile, onInputChange, dragHandlers, isDragOver };
}
