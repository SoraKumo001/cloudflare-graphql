import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import PrismaUtils from '@pothos/plugin-prisma-utils';
import { PrismaClient, User } from '@prisma/client';
import { GraphQLScalarType, GraphQLSchema } from 'graphql';
import { createYoga } from 'graphql-yoga';
import PothosPrismaGeneratorPlugin from 'pothos-prisma-generator';
import { explorer } from './explorer';
import PrismaTypes from './generated/pothos-types';
import { parse, serialize } from 'cookie';
import { SignJWT, jwtVerify } from 'jose';
import { Pool } from '@prisma/pg-worker';
import { PrismaPg } from '@prisma/adapter-pg-worker';

type Env = {
	DATABASE_URL: string;
};

type Context = {
	request: Request;
	env: Env;
	responseCookies: string[];
	setCookie: typeof serialize;
	cookies: { [key: string]: string };
	user?: User;
};

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

const secret = 'secret';

export const createBuilder = (prisma: PrismaClient) => {
	const builder = new SchemaBuilder<BuilderType>({
		plugins: [PrismaPlugin, PrismaUtils, PothosPrismaGeneratorPlugin],
		prisma: {
			client: prisma,
		},
		pothosPrismaGenerator: {
			authority: ({ context }) => (context.user ? ['USER'] : []),
			replace: { '%%USER%%': ({ context }) => context.user?.id },
		},
	});
	return builder;
};

const customSchema = ({ builder }: { builder: ReturnType<typeof createBuilder> }) => {
	builder.mutationType({
		fields: (t) => ({
			signIn: t.prismaField({
				args: { email: t.arg({ type: 'String', required: true }) },
				type: 'User',
				nullable: true,
				resolve: async (_query, _root, { email }, { setCookie }) => {
					const prisma = builder.options.prisma.client as PrismaClient;
					const user = await prisma.user.findUnique({ where: { email: email } });

					if (!user) {
						setCookie('auth-token', '', {
							httpOnly: true,
							sameSite: 'strict',
							path: '/',
							maxAge: 0,
							domain: undefined,
						});
						return null;
					}
					if (user) {
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
					return user;
				},
			}),
		}),
	});
};

const schema = () => {
	let schema: GraphQLSchema;
	let builder: ReturnType<typeof createBuilder>;
	const createSchema = async ({ env }: { env: Env }) => {
		const pool = new Pool({
			connectionString: env.DATABASE_URL,
			max: 1,
			idleTimeoutMillis: 0,
			keepAlive: false,
		});
		const url = new URL(env.DATABASE_URL.replace(/^([^:]+):/, 'http:'));
		const adapter = new PrismaPg(pool, {
			schema: url.searchParams.get('schema') ?? undefined,
		});
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
		customSchema({ builder });
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
				const responseCookies: string[] = [];
				const setCookie: typeof serialize = (name, value, options) => {
					const result = serialize(name, value, options);
					responseCookies.push(result);
					return result;
				};
				const cookies = parse(request.headers.get('Cookie') || '');
				const token = cookies['auth-token'];
				const user = await jwtVerify(token, new TextEncoder().encode(secret))
					.then((data) => data.payload.user as User)
					.catch(() => undefined);
				const response = await yoga.handleRequest(request, {
					request,
					env,
					responseCookies,
					setCookie,
					cookies: {},
					user,
				});
				responseCookies.forEach((v) => {
					response.headers.append('set-cookie', v);
				});
				return new Response(response.body, response);
		}
		return new Response('Not Found', { status: 404 });
	},
};
