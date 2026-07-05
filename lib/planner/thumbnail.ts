/** Client-side SVG → WebP data URL for plan thumbnail capture. */
export async function captureSvgAsWebpDataUrl(svg: SVGSVGElement): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const viewBox = svg.viewBox.baseVal;
  const width = Math.max(1, Math.round(viewBox.width || svg.clientWidth || 800));
  const height = Math.max(1, Math.round(viewBox.height || svg.clientHeight || 600));
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const xml = new XMLSerializer().serializeToString(clone);
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;

  const image = new Image();
  image.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to render SVG for thumbnail"));
    image.src = svgUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas not supported");
  }

  context.fillStyle = getComputedStyle(document.documentElement)
    .getPropertyValue("--planner-canvas-bg")
    .trim() || "#e8e0d0";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/webp", 0.85);
}

export async function uploadGardenThumbnail(
  gardenId: string,
  version: number,
  svg: SVGSVGElement,
): Promise<string | null> {
  const imageData = await captureSvgAsWebpDataUrl(svg);
  const response = await fetch(`/api/gardens/${gardenId}/thumbnail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      expected_version: version,
      image_data: imageData,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const body = await response.json();
  return body.thumbnail_url ?? null;
}
