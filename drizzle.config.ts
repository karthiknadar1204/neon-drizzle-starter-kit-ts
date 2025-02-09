/** @type { import("drizzle-kit").Config } */
export default {
    schema: "./configs/schema.ts",
    dialect: 'postgresql',
    dbCredentials: {
      url: process.env.NEXT_PUBLIC_DRIZZLE_DATABASE_URL,
    }
  };
  
  