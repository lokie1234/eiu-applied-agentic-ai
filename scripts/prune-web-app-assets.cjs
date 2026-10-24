const ts = require('typescript');

// Dynamic logo lookups use names from the surviving renderer and slide data.
// Keep those names (including AI-prefixed aliases), rather than shipping the
// entire shared image catalog in both independently downloadable sections.
module.exports = function pruneAssets(source, assets) {
  const file = ts.createSourceFile('section.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = file.statements.find(node => ts.isVariableStatement(node) &&
    node.declarationList.declarations.some(item => item.name.getText(file) === 'assets'));
  if (!declaration) throw Error('Missing embedded section assets.');
  const names = new Set();
  function visit(node) {
    if (node === declaration) return;
    if (ts.isStringLiteralLike(node)) names.add(node.text);
    ts.forEachChild(node, visit);
  }
  visit(file);
  const selected = Object.fromEntries(Object.entries(assets).filter(([name]) =>
    names.has(name) || name.startsWith('AI ') && names.has(name.slice(3))));
  return source.slice(0, declaration.getStart(file)) +
    `const assets: Record<string,string> = ${JSON.stringify(selected, null, 2)};` + source.slice(declaration.end);
};
