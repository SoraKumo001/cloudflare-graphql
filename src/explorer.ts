import { GraphQLSchema, printSchema } from 'graphql';

const document = `mutation SignIn {
  signIn(email: "example@example.com") {
    id
  }
}

mutation SignOut {
  signIn {
    id
  }
}

query FindManyPost {
  findManyPost {
    id
    title
    author {
      id
      name
    }
  }
}

# Require SignIn
mutation CreateOnePost {
  createOnePost(input: { title: "Test" }) {
    id
    author {
      name
      email
    }
    title
  }
}
`
	.replace(/\n/g, '\\n')
	.replace(/'/g, "\\'");

export const explorer = (schema: GraphQLSchema) => {
	const schemaString = printSchema(schema).replace(/\n/g, '\\n').replace(/'/g, "\\'");
	const html = `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<title>Embedded Explorer</title>
		<script src="https://embeddable-explorer.cdn.apollographql.com/_latest/embeddable-explorer.umd.production.min.js"></script>
	</head>
	<body style="margin: 0; overflow-x: hidden; overflow-y: hidden; height: 100vh; width: 100vw" id="explorer"></body>
		<script>
			const getExampleSchema = () => '${schemaString}';
			new EmbeddedExplorer({
				target: '#explorer',
				initialState:{
					document: '${document}',
				},
				endpointUrl: '/graphql',
				schema: getExampleSchema(),
				handleRequest:(url, option) =>
          fetch(url, { ...option, credentials: "same-origin" })
        ,
			});
		</script>
  </html>
`;
	return html;
};
