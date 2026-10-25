const ts = require('typescript');
const postcss = require('postcss');

// Only remove selectors proven impossible in this standalone section. Dynamic
// class prefixes and functional pseudo-classes stay conservative.
module.exports = function pruneStyles(source) {
  const file = ts.createSourceFile('section.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set(), prefixes = new Set(), sheets = [];
  function visit(node) {
    if (ts.isStringLiteralLike(node) && /\{[^}]*:[^}]*\}/.test(node.text)) {
      if (ts.isNoSubstitutionTemplateLiteral(node)) sheets.push(node);
      return;
    }
    if (ts.isStringLiteralLike(node)) {
      for (const token of node.text.match(/[a-zA-Z_][\w-]*/g) || []) names.add(token);
      if (ts.isBinaryExpression(node.parent) && node.parent.operatorToken.kind === ts.SyntaxKind.PlusToken && /^[\w-]+$/.test(node.text)) prefixes.add(node.text);
    }
    if (ts.isTemplateExpression(node)) {
      for (const text of [node.head.text, ...node.templateSpans.map(span=>span.literal.text)]) {
        for (const token of text.match(/[a-zA-Z_][\w-]*/g) || []) names.add(token);
      }
      for (const token of node.head.text.match(/[a-zA-Z_][\w-]*$/g) || []) prefixes.add(token);
    }
    ts.forEachChild(node, visit);
  }
  // Embedded images and authored course metadata are not DOM class references.
  for (const statement of file.statements) {
    if (ts.isVariableStatement(statement) && statement.declarationList.declarations.some(d => ['assets','course'].includes(d.name.getText(file)))) continue;
    visit(statement);
  }
  const edits = [];
  for (const node of sheets) {
    let css;
    try { css = postcss.parse(node.text); } catch { continue; }
    css.walkRules(rule => {
      if (rule.parent.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
      const selectors = rule.selectors.filter(selector => {
        if (/:(?:not|is|where|has)\(/.test(selector)) return true;
        const classes = [...selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match => match[1]);
        return classes.every(name => names.has(name) || [...prefixes].some(prefix => name.startsWith(prefix)));
      });
      if (!selectors.length) rule.remove();
      else rule.selectors = selectors;
    });
    function deduplicate(parent) {
      const seen = new Set();
      for (const child of [...(parent.nodes || [])].reverse()) {
        if (child.type === 'rule') {
          const key = child.selector + '|' + child.nodes.map(n => n.toString().trim()).join(';');
          if (seen.has(key)) child.remove(); else seen.add(key);
        }
        if (child.nodes) deduplicate(child);
        if (child.type === 'atrule' && child.nodes?.length === 0) child.remove();
      }
    }
    deduplicate(css);
    const result = css.toString();
    if (result !== node.text) edits.push([node.getStart(file), node.end, '`' + result + '`']);
  }
  for (const [start,end,text] of edits.sort((a,b)=>b[0]-a[0])) source = source.slice(0,start)+text+source.slice(end);
  return source;
};
