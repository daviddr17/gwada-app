/** Markiert das Ende des sichtbaren Embed-Inhalts für iframe-Höhenmessung. */
export function EmbedMeasureEnd() {
  return (
    <span
      data-gwada-embed-measure-end
      className="block h-0 w-full shrink-0"
      aria-hidden
    />
  );
}
