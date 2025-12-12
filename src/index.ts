import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import PrismaUtils from '@pothos/plugin-prisma-utils';
import { PrismaClient, User } from '@prisma/client';
import { GraphQLScalarType, type GraphQLSchema } from 'graphql';
import { createYoga } from 'graphql-yoga';
import PothosPrismaGeneratorPlugin from 'pothos-prisma-generator';
import { explorer } from './explorer';
import PrismaTypes from './generated/pothos-types';
import { parse, serialize, type SerializeOptions, type SetCookie, type StringifyOptions } from 'cookie';
import { SignJWT, jwtVerify } from 'jose';
import { PrismaPg } from '@prisma/adapter-pg';
import { prismaDmmf } from './generated/prisma-dmmf';

/**
 * @type {Env}
 * @description Cloudflare Environment variables
 */
type Env = {
	DATABASE_URL: string;
	SECRET: string;
};

/**
 * @type {Context}
 * @description Context for the GraphQL server
 */
type Context = {
	env: Env;
	request: Request;
	responseCookies: string[];
	setCookie: (name: string, val: string, options?: SerializeOptions) => string;
	cookies: { [key: string]: string };
	user?: User;
};

/**
 * @type {ExecutionContext}
 * @description Type definition for Pothos
 */
type BuilderType = {
	PrismaTypes: PrismaTypes;
	Scalars: {
		Upload: {
			Input: File;
			Output: File;
		};
	};
	Context: Context;
};

export const createBuilder = (prisma: PrismaClient) => {
	const builder = new SchemaBuilder<BuilderType>({
		plugins: [PrismaPlugin, PrismaUtils, PothosPrismaGeneratorPlugin],
		prisma: {
			client: prisma,
			dmmf: prismaDmmf,
		},
		// authorization settings
		pothosPrismaGenerator: {
			authority: ({ context }) => context.user?.roles ?? [],
			replace: { '%%USER%%': ({ context }) => context.user?.id },
			// autoScalers: false,
		},
	});
	return builder;
};

const customSchema = ({ builder, env }: { builder: ReturnType<typeof createBuilder>; env: Env }) => {
	// Add signIn mutation
	builder.mutationType({
		fields: (t) => ({
			signIn: t.prismaField({
				args: { email: t.arg({ type: 'String' }) },
				type: 'User',
				nullable: true,
				resolve: async (_query, _root, { email }, { setCookie }) => {
					const prisma = builder.options.prisma.client as PrismaClient;
					const user = email && (await prisma.user.findUnique({ where: { email: email } }));
					if (!user) {
						setCookie('auth-token', '', {
							httpOnly: true,
							sameSite: 'strict',
							path: '/',
							maxAge: 0,
							domain: undefined,
						});
					} else {
						const secret = env.SECRET;
						if (!secret) throw new Error('SECRET_KEY is not defined');
						const token = await new SignJWT({ user: user }).setProtectedHeader({ alg: 'HS256' }).sign(new TextEncoder().encode(secret));
						setCookie('auth-token', token, {
							httpOnly: true,
							maxAge: 1000 * 60 * 60 * 24 * 7,
							sameSite: 'strict',
							path: '/',
							domain: undefined,
						});
					}
					return user || null;
				},
			}),
		}),
	});
};

const schema = () => {
	let schema: GraphQLSchema;
	let builder: ReturnType<typeof createBuilder>;
	const createSchema = async ({ env }: { env: Env }) => {
		const url = new URL(env.DATABASE_URL.replace(/^([^:]+):/, 'http:'));
		const adapter = new PrismaPg(
			{ connectionString: env.DATABASE_URL },
			{
				schema: url.searchParams.get('schema') ?? undefined,
			}
		);
		const prisma = new PrismaClient({ adapter });
		if (schema && builder) {
			// Update the prisma client
			builder.options.prisma.client = prisma;
			return schema;
		}
		// Create a new schema
		builder = createBuilder(prisma);
		const Upload = new GraphQLScalarType({
			name: 'Upload',
		});
		builder.addScalarType('Upload', Upload as never, {});
		customSchema({ builder, env });
		schema = builder.toSchema();
		return schema;
	};
	return createSchema;
};

const yoga = createYoga<Context>({
	schema: schema(),
	fetchAPI: { Response },
});

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		switch (url.pathname) {
			case '/':
				return new Response(explorer(await schema()({ env })), {
					headers: { 'content-type': 'text/html' },
				});
			case '/graphql':
				// Get the user from the token
				const cookies = parse(request.headers.get('Cookie') || '');
				const token = cookies['auth-token'] ?? '';
				const secret = env.SECRET;
				const user = await jwtVerify(token, new TextEncoder().encode(secret))
					.then((data) => data.payload.user as User)
					.catch(() => undefined);
				// For cookie setting
				const responseCookies: string[] = [];
				const setCookie = (name: string, value: string, options?: SerializeOptions) => {
					const result = serialize(name, value, options);
					responseCookies.push(result);
					return result;
				};
				// Executing GraphQL queries
				const response = await yoga.handleRequest(request, {
					request,
					env,
					responseCookies,
					setCookie,
					cookies: {},
					user,
				});
				// Set the cookies
				responseCookies.forEach((v) => {
					response.headers.append('set-cookie', v);
				});
				return new Response(response.body, response);
		}
		return new Response('Not Found', { status: 404 });
	},
};
