# Sample of Cloudflare Workers + Prisma handling GraphQL

## Required Environment Variables

- DATABASE_URL

## Sample code

```ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createYoga } from 'graphql-yoga';
import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import PrismaUtils from '@pothos/plugin-prisma-utils';
import PothosPrismaGeneratorPlugin from 'pothos-prisma-generator';
import PrismaTypes from '../app/generated/pothos-types';
import { GraphQLScalarType, GraphQLSchema } from 'graphql';

type BuilderType = {
	PrismaTypes: PrismaTypes;
	Scalars: {
		Upload: {
			Input: File;
			Output: File;
		};
	};
};

export const createBuilder = (prisma: PrismaClient) => {
	const builder = new SchemaBuilder<BuilderType>({
		plugins: [PrismaPlugin, PrismaUtils, PothosPrismaGeneratorPlugin],
		prisma: {
			client: prisma,
		},
	});

	return builder;
};

export interface Env {
	DATABASE_URL: string;
}

const schema = () => {
	let schema: GraphQLSchema;
	let builder: ReturnType<typeof createBuilder>;
	const createSchema = async ({ env }: { env: Env }) => {
		const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1, idleTimeoutMillis: 0, keepAlive: false });
		const url = new URL(env.DATABASE_URL.replace(/^([^:]+):/, 'http:'));
		const adapter = new PrismaPg(pool, { schema: url.searchParams.get('schema') ?? undefined });
		const prisma = new PrismaClient({ adapter });
		if (schema && builder) {
			builder.options.prisma.client = prisma;
			return schema;
		}
		builder = createBuilder(prisma);
		const Upload = new GraphQLScalarType({
			name: 'Upload',
		});
		builder.addScalarType('Upload', Upload, {});
		schema = builder.toSchema();
		return schema;
	};
	return createSchema;
};

const yoga = createYoga<{
	request: Request;
	env: Env;
	responseCookies: string[];
}>({
	schema: schema(),

	fetchAPI: { Response },
});

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === '/') {
			return Response.redirect(new URL('/graphql', url), 301);
		}
		if (url.pathname === '/graphql') {
			const response = await yoga.handleRequest(request, {
				request,
				env,
				responseCookies: [],
			});
			return new Response(response.body, response);
		}
		return new Response('');
	},
};
```
