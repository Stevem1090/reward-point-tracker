export type VintedImage = { name: string; type: 'image/jpeg'; base64: string };

/**
 * Resize to ~1000px longest edge, JPEG 0.8. The photo's built-in (EXIF) orientation is applied
 * first, so the copy looks exactly as on screen; canvas re-encoding leaves no orientation tag.
 * Returns raw base64 (no data: prefix).
 */
export async function resizeForVinted(file: File, index: number, maxEdge = 1000, quality = 0.8): Promise<VintedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { name: `photo-${index + 1}.jpg`, type: 'image/jpeg', base64: dataUrl.split(',')[1] };
}

/** Rotate clockwise on a canvas (rotation only, no mirroring or cropping), re-encoded as JPEG ~0.85. */
export async function rotateImage(img: VintedImage, degrees: 0 | 90 | 180 | 270, name = img.name, quality = 0.85): Promise<VintedImage> {
  if (!degrees) return { ...img, name };
  const el = new Image();
  el.src = `data:image/jpeg;base64,${img.base64}`;
  await el.decode();
  const sideways = degrees === 90 || degrees === 270;
  const canvas = document.createElement('canvas');
  canvas.width = sideways ? el.naturalHeight : el.naturalWidth;
  canvas.height = sideways ? el.naturalWidth : el.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(el, -el.naturalWidth / 2, -el.naturalHeight / 2);
  return { name, type: 'image/jpeg', base64: canvas.toDataURL('image/jpeg', quality).split(',')[1] };
}
