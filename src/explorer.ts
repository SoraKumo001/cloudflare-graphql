import { GraphQLSchema, printSchema } from 'graphql';
export const explorer = (schema: GraphQLSchema) => {
	const schemaString = printSchema(schema).replace(/\n/g, '\\n').replace(/"/g, '\\"');
	const html = `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<title>Embedded Explorer</title>
		<script src="https://embeddable-explorer.cdn.apollographql.com/_latest/embeddable-explorer.umd.production.min.js"></script>
	</head>
	<body style="margin: 0; overflow-x: hidden; overflow-y: hidden; height: 100vh; width: 100vw" id="embeddableExplorer"></body>
		<script>
			const getExampleSchema = () => "${schemaString}";
			new EmbeddedExplorer({
				target: '#embeddableExplorer',
				endpointUrl: '/graphql',
				schema: getExampleSchema(),
			});
		</script>
  </html>
`;
	return html;
};
