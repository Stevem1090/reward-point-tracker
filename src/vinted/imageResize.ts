export type VintedImage = { name: string; type: 'image/jpeg'; base64: string };

/** Resize to ~1000px longest edge, JPEG 0.8. Returns raw base64 (no data: prefix). */
export async function resizeForVinted(file: File, index: number, maxEdge = 1000, quality = 0.8): Promise<VintedImage> {
  const bitmap = await createImageBitmap(file);
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
