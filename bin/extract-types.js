import ts from "typescript";
import fs from "fs/promises";
import path from "path";

// This is chat-GPT v 4 generated code to extract
// types from the openapi.d.ts file that we don't
// want to publicly share because the full API surface
// is too large and confusing for users.

const openapiPath = "private/openapi.d.ts";
// read sourceCodePath from argv.

const sourceCodePaths = process.argv.slice(2);

// const sourceCodePath = './path/to/your-source-code';

async function getUsedTypes(sourceCodePath) {
  const entries = await fs.readdir(sourceCodePath, { withFileTypes: true });
  const usedTypes = new Set();

  for (const entry of entries) {
    const fullPath = path.join(sourceCodePath, entry.name);

    if (entry.isDirectory()) {
      usedTypes.add(...(await getUsedTypes(fullPath)));
    } else if (
      (entry.isFile() && fullPath.endsWith(".ts")) ||
      fullPath.endsWith(".tsx")
    ) {
      const content = await fs.readFile(fullPath, "utf-8");
      const sourceFile = ts.createSourceFile(
        fullPath,
        content,
        ts.ScriptTarget.ESNext,
        true
      );

      ts.forEachChild(sourceFile, function visit(node) {
        if (ts.isTypeReferenceNode(node)) {
          usedTypes.add(node.typeName.escapedText);
        }
        ts.forEachChild(node, visit);
      });
    }
  }

  return usedTypes;
}

async function extractTypes(openapiPath, usedTypes) {
  const content = await fs.readFile(openapiPath, "utf-8");
  const sourceFile = ts.createSourceFile(
    openapiPath,
    content,
    ts.ScriptTarget.ESNext,
    true
  );
  const extractedNodes = [];

  const visit = (node) => {
    if (
      ts.isTypeAliasDeclaration(node) &&
      usedTypes.has(node.name.escapedText)
    ) {
      extractedNodes.push(node);
    } else if (
      ts.isInterfaceDeclaration(node) &&
      usedTypes.has(node.name.escapedText)
    ) {
      const newProperties = node.members.map((member) => {
        if (
          ts.isPropertySignature(member) &&
          member.type &&
          ts.isTypeReferenceNode(member.type)
        ) {
          const typeName = member.type.typeName.escapedText;
          if (usedTypes.has(typeName)) {
            return ts.factory.updatePropertySignature(
              member,
              member.decorators,
              member.modifiers,
              member.name,
              member.questionToken,
              ts.factory.createTypeReferenceNode(
                `MyApiTypes.${typeName}`,
                undefined
              )
            );
          }
        }
        return member;
      });
      extractedNodes.push(
        ts.factory.updateInterfaceDeclaration(
          node,
          node.decorators,
          node.modifiers,
          node.name,
          node.typeParameters,
          node.heritageClauses,
          newProperties
        )
      );
    } else if (
      ts.isModuleDeclaration(node) ||
      ts.isNamespaceExportDeclaration(node)
    ) {
      const nestedNodes = ts.visitNodes(node.body, visit);
      if (nestedNodes.length > 0) {
        extractedNodes.push(
          ts.factory.updateModuleDeclaration(
            node,
            node.decorators,
            node.modifiers,
            node.name,
            ts.factory.updateModuleBlock(node.body, nestedNodes)
          )
        );
      }
    }
  };

  ts.forEachChild(sourceFile, visit);
  return extractedNodes;
}

async function generateTypeFile(extractedTypes, outputPath) {
  const printer = ts.createPrinter();
  const sourceFile = ts.createSourceFile(
    outputPath,
    "",
    ts.ScriptTarget.ESNext,
    false,
    ts.ScriptKind.TS
  );

  // Print each extracted type with the `export` keyword
  const content = extractedTypes
    .map((type) => {
      const printedType = printer.printNode(
        ts.EmitHint.Unspecified,
        type,
        sourceFile
      );
      return printedType.replace(/^(\s*)interface/, "$1export interface");
    })
    .join("\n\n");

  // Wrap the content in a global export
  const wrappedContent = `declare global {\n  namespace AtlasAPI {\n${content
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n")}\n  }\n}\n`;

  await fs.writeFile(outputPath, wrappedContent);
}

async function main() {
  const usedTypes = new Set();
  for (let sourceCodePath of sourceCodePaths) {
    for (let type of await getUsedTypes(sourceCodePath)) {
      usedTypes.add(type);
    }
  }
  const extractedTypes = await extractTypes(openapiPath, usedTypes);
  const outputPath = "./src/extracted-types.d.ts";

  await generateTypeFile(extractedTypes, outputPath);
  console.log("Extracted types have been saved to", outputPath);
}

main();
