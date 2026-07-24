// Gera src/api/schema.ts a partir do openapi.json que a API publica.
//
// Por que não o CLI direto: o OpenAPI do .NET 10 declara todo campo numérico como
// `type: ["integer", "string"]` — a forma do JSON Schema que também aceita o número
// codificado como texto. O openapi-typescript traduz isso fielmente para
// `string | number`, o que contaminaria cada uso com uma conversão defensiva.
//
// O `System.Text.Json` do servidor serializa números como números; a variante string
// existe no schema pela tolerância de ENTRADA, não porque a resposta venha assim. Por
// isso o transform abaixo fixa esses campos como `number`. É uma decisão consciente:
// se algum dia a API passar a devolver números como string, este é o ponto que quebra.
import fs from 'node:fs';
import openapiTS, { astToString } from 'openapi-typescript';
import ts from 'typescript';

const NUMBER = ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
const NULL = ts.factory.createLiteralTypeNode(ts.factory.createNull());

const NUMERIC_FORMATS = new Set(['int32', 'int64', 'float', 'double', 'decimal']);

function types(schema) {
  return Array.isArray(schema?.type) ? schema.type : [schema?.type];
}

/** Numérico com a variante string pendurada por causa do serializador. */
function isNumericWithStringVariant(schema) {
  if (!NUMERIC_FORMATS.has(schema?.format)) return false;
  const t = types(schema);
  return t.includes('integer') || t.includes('number');
}

const input = new URL('../openapi.json', import.meta.url);
const output = new URL('../src/api/schema.ts', import.meta.url);

const ast = await openapiTS(input, {
  transform(schema) {
    if (!isNumericWithStringVariant(schema)) return undefined;
    return types(schema).includes('null')
      ? ts.factory.createUnionTypeNode([NUMBER, NULL])
      : NUMBER;
  },
});

fs.writeFileSync(output, astToString(ast));
console.log('schema.ts gerado a partir de openapi.json');
