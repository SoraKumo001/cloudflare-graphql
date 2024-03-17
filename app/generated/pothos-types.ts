/* eslint-disable */
import type { Prisma, User, Post, Category, TypeTest } from "C:\\prog\\test\\cloudflare\\cloudflare-graphql\\node_modules\\@prisma\\client";
export default interface PrismaTypes {
    User: {
        Name: "User";
        Shape: User;
        Include: Prisma.UserInclude;
        Select: Prisma.UserSelect;
        OrderBy: Prisma.UserOrderByWithRelationInput;
        WhereUnique: Prisma.UserWhereUniqueInput;
        Where: Prisma.UserWhereInput;
        Create: {};
        Update: {};
        RelationName: "posts";
        ListRelations: "posts";
        Relations: {
            posts: {
                Shape: Post[];
                Name: "Post";
                Nullable: false;
            };
        };
    };
    Post: {
        Name: "Post";
        Shape: Post;
        Include: Prisma.PostInclude;
        Select: Prisma.PostSelect;
        OrderBy: Prisma.PostOrderByWithRelationInput;
        WhereUnique: Prisma.PostWhereUniqueInput;
        Where: Prisma.PostWhereInput;
        Create: {};
        Update: {};
        RelationName: "author" | "categories";
        ListRelations: "categories";
        Relations: {
            author: {
                Shape: User | null;
                Name: "User";
                Nullable: true;
            };
            categories: {
                Shape: Category[];
                Name: "Category";
                Nullable: false;
            };
        };
    };
    Category: {
        Name: "Category";
        Shape: Category;
        Include: Prisma.CategoryInclude;
        Select: Prisma.CategorySelect;
        OrderBy: Prisma.CategoryOrderByWithRelationInput;
        WhereUnique: Prisma.CategoryWhereUniqueInput;
        Where: Prisma.CategoryWhereInput;
        Create: {};
        Update: {};
        RelationName: "posts";
        ListRelations: "posts";
        Relations: {
            posts: {
                Shape: Post[];
                Name: "Post";
                Nullable: false;
            };
        };
    };
    TypeTest: {
        Name: "TypeTest";
        Shape: TypeTest;
        Include: never;
        Select: Prisma.TypeTestSelect;
        OrderBy: Prisma.TypeTestOrderByWithRelationInput;
        WhereUnique: Prisma.TypeTestWhereUniqueInput;
        Where: Prisma.TypeTestWhereInput;
        Create: {};
        Update: {};
        RelationName: never;
        ListRelations: never;
        Relations: {};
    };
}