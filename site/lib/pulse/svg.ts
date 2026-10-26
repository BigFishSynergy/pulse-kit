// Generated graphics are shown and downloaded as images, but they are still cleaned first.
/** Keep the drawing, drop anything that could run code or pull from the internet. */
export function sanitize(raw: string, W: number, H: number) {
  const a = raw.indexOf("<svg"), b = raw.lastIndexOf("</svg>");
  if (a < 0 || b < 0) return null;
  let svg = raw.slice(a, b + 6);
  svg = svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/<image\b[^>]*>(<\/image>)?/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/\s(?:xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, "")
    .replace(/@import[^;]*;/gi, "")
    .replace(/url\(\s*['"]?(?!#)[^)]*\)/gi, "none");
  // force the exact canvas
  svg = svg.replace(/<svg\b[^>]*>/i, (tag) => {
    const t = tag.replace(/\s(width|height|viewBox|xmlns(:xlink)?)\s*=\s*("[^"]*"|'[^']*')/gi, "");
    return t.replace(/<svg/i, `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"`);
  });
  return svg;
}
