import { createHash } from "node:crypto";
import ts from "typescript";

type Counts = { teachingSlides: number; learnerSlides: number };
const countsByRevision = new Map<string, Counts | null>();

// Recognize our standalone compiler's lazy slide factories without executing
// uploaded JS on the server. Other export formats keep runtime counting.
export function interactiveLessonCounts(source: string): Counts | null {
  const revision = createHash("sha256").update(source).digest("hex");
  if (countsByRevision.has(revision)) return countsByRevision.get(revision)!;
  const parsed = ts.createSourceFile("lesson.js", source, ts.ScriptTarget.ES2020, true, ts.ScriptKind.JS);
  let data: unknown;
  let factory = "";
  for (const statement of parsed.statements) {
    if (ts.isVariableStatement(statement) && (statement.declarationList.flags & ts.NodeFlags.Const)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === "course" && declaration.initializer) {
          try { data = JSON.parse(declaration.initializer.getText(parsed)); } catch { /* Unknown format. */ }
        }
      }
    }
    if (ts.isExpressionStatement(statement) && ts.isBinaryExpression(statement.expression) &&
      statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      statement.expression.left.getText(parsed) === "exports.default") {
      factory = statement.expression.right.getText(parsed).replace(/\s+/g, "");
    }
  }
  const plain = /^course\.slides\.map\(s=>\(\)=>[\w$]+\(s\)\)$/.test(factory);
  const withRoles = /^course\.slides\.map\(s=>Object\.assign\(\(\)=>[\w$]+\(s\),\{adminOnly:s\.adminOnly===true\}\)\)$/.test(factory);
  const slides = data && typeof data === "object" && "slides" in data ? data.slides : null;
  const counts = (plain || withRoles) && Array.isArray(slides) && slides.length > 0 && slides.length <= 10_000
    ? { teachingSlides: slides.length, learnerSlides: withRoles ? slides.filter(slide => slide?.adminOnly !== true).length : slides.length }
    : null;
  if (countsByRevision.size >= 64) countsByRevision.delete(countsByRevision.keys().next().value!);
  countsByRevision.set(revision, counts);
  return counts;
}
