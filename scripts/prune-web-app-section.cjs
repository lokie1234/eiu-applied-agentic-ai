const ts = require('typescript');

// Keep each standalone deck limited to its actual slide routes. Run this after
// generation too, so shared-renderer edits cannot restore another section's code.
module.exports = function pruneSection(source, section) {
  const parse = text => ts.createSourceFile('section.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visuals = new Set(section.slides.map(slide => slide.visual));
  let file = parse(source);
  const edits = [];
  const content = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'content');
  for (const statement of content.body.statements) {
    if (ts.isIfStatement(statement) && !section.slides.some(slide =>
      statement.expression.getText(file).includes('workspace-') ? slide.visual.startsWith('workspace-') : slide.visual.startsWith('git-intro-'))) {
      edits.push([statement.getFullStart(), statement.end]);
    }
    if (ts.isSwitchStatement(statement)) {
      for (const clause of statement.caseBlock.clauses) {
        if (ts.isCaseClause(clause) && !visuals.has(clause.expression.text)) edits.push([clause.getFullStart(), clause.end]);
      }
    }
  }
  // These routes bypass the regular content renderer.
  if (!visuals.has('lab-divider')) {
    const slide = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'slide');
    for (const statement of slide.body.statements) {
      if (ts.isIfStatement(statement)) edits.push([statement.getFullStart(), statement.end]);
    }
  }
  for (const [start, end] of edits.sort((a, b) => b[0] - a[0])) source = source.slice(0, start) + source.slice(end);
  if (section.slides[0].section === 2) {
    source = source.replace('css+openingCss+sectionOneCss+detailCss+workspaceCss+vscodeCss+regionDetailCss+aiAlternativesCss+gitIntroCss', 'css+openingCss');
  }
  // Fold section guards without reprinting embedded images or the user's text.
  const sectionNumber = section.slides[0].section;
  for (;;) {
    const tree = parse(source), changes = [];
    function fold(node) {
      let replacement;
      if (ts.isJsxExpression(node) && node.expression?.kind === ts.SyntaxKind.FalseKeyword) {
        replacement = '';
      } else if (sectionNumber === 1 && ts.isIfStatement(node) && node.expression.kind === ts.SyntaxKind.FalseKeyword) {
        replacement = node.elseStatement?.getText(tree) || '';
      } else if (sectionNumber === 1 && ts.isIfStatement(node) && node.expression.kind === ts.SyntaxKind.TrueKeyword) {
        replacement = node.thenStatement.getText(tree);
      } else if (ts.isBinaryExpression(node) && /^s\.section\s*===?\s*[12]$/.test(node.getText(tree))) {
        replacement = String(Number(node.right.getText(tree)) === sectionNumber);
      } else if (ts.isConditionalExpression(node) && ['true', 'false'].includes(node.condition.getText(tree))) {
        replacement = (node.condition.getText(tree) === 'true' ? node.whenTrue : node.whenFalse).getText(tree);
      } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && ['true', 'false'].includes(node.left.getText(tree))) {
        replacement = node.left.getText(tree) === 'true' ? node.right.getText(tree) : 'false';
      }
      if (replacement !== undefined) changes.push([node.getStart(tree), node.end, replacement]);
      else ts.forEachChild(node, fold);
    }
    fold(tree);
    if (!changes.length) break;
    for (const [start, end, replacement] of changes.sort((a,b) => b[0]-a[0])) source = source.slice(0,start)+replacement+source.slice(end);
  }
  // Drop declarations unreachable from the export. Identifier traversal retains
  // callbacks and popup handlers, even when they only run after a click.
  const opening = parse(source).statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'opening');
  if (opening && !/\bs\b/.test(opening.body.getText())) {
    source = source.replace('function opening(s:SlideData)', 'function opening()').replaceAll('opening(s)', 'opening()');
  }
  file = parse(source);
  const declarations = new Map();
  for (const node of file.statements) {
    if (ts.isFunctionDeclaration(node) && node.name) declarations.set(node.name.text, node);
    if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) declarations.set(declaration.name.text, node);
    }
  }
  const retained = new Set();
  function visit(node) {
    if (ts.isIdentifier(node) && declarations.has(node.text) && !retained.has(node.text)) {
      retained.add(node.text);
      ts.forEachChild(declarations.get(node.text), visit);
    }
    ts.forEachChild(node, visit);
  }
  for (const node of file.statements) if (ts.isExportAssignment(node)) visit(node);
  const removed = new Set([...declarations].filter(([name]) => !retained.has(name)).map(([, node]) => node));
  for (const node of [...removed].sort((a, b) => b.pos - a.pos)) source = source.slice(0, node.getFullStart()) + source.slice(node.end);
  return source;
};
