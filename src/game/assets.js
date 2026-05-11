export async function loadImage(src) {
  const img = new Image();
  img.decoding = "async";
  img.loading = "eager";
  const p = new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
  });
  img.src = src;
  return await p;
}

