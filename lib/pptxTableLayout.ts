/** Browser table rows can exceed the renderer's fixed wrapper height.
 * Expand only overflowing table wrappers; never rescale text or move shapes.
 */
export function fitPptxTables(slide: HTMLElement) {
  for (const table of slide.querySelectorAll("table")) {
    const wrapper = table.parentElement;
    if (!wrapper || wrapper === slide || wrapper.style.position !== "absolute") continue;
    // offsetHeight/scrollHeight are intrinsic CSS pixels, unaffected by slide zoom.
    const actualHeight = Math.max(table.offsetHeight, table.scrollHeight);
    const originalHeight = wrapper.clientHeight || Number.parseFloat(wrapper.style.height);
    if (actualHeight > originalHeight + 1) {
      // Lock the measured table height before changing its percentage-height parent.
      table.style.height = `${actualHeight}px`;
      wrapper.style.height = `${actualHeight}px`;
    }
  }
}
