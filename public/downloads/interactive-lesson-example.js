// Learning Space interactive lesson. Plain JavaScript; no TSX or build step.
// The web lesson renderer supplies h(), Fragment, React.createElement and exports.
// Do not import modules. Embed images/fonts as data URLs for self-contained rendering.
exports.default = [
  function introduction() {
    let count = 0;
    const result = h("p", { "aria-live": "polite" }, "Ideas launched: 0");
    return h("main", { style: { padding: "48px", background: "#082945", color: "#fff", height: "100%" } },
      h("h1", null, "Launch your next idea"),
      h("button", { onClick: () => { count++; result.textContent = "Ideas launched: " + count; } }, "Launch"),
      result);
  },
  () => h("main", { style: { padding: "48px" } }, h("h1", null, "Slide 2"), h("p", null, "Create directly in JavaScript.")),
];
