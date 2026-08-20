/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as authEmail from "../authEmail.js";
import type * as authz from "../authz.js";
import type * as campaigns from "../campaigns.js";
import type * as catalogue from "../catalogue.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as investors from "../investors.js";
import type * as maintenance from "../maintenance.js";
import type * as migrations from "../migrations.js";
import type * as observability from "../observability.js";
import type * as onboarding from "../onboarding.js";
import type * as organizations from "../organizations.js";
import type * as outreach from "../outreach.js";
import type * as participants from "../participants.js";
import type * as profiles from "../profiles.js";
import type * as providers from "../providers.js";
import type * as publicRoutes from "../publicRoutes.js";
import type * as rateLimit from "../rateLimit.js";
import type * as research from "../research.js";
import type * as signups from "../signups.js";
import type * as users from "../users.js";
import type * as webhooks from "../webhooks.js";
import type * as workflows from "../workflows.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  authEmail: typeof authEmail;
  authz: typeof authz;
  campaigns: typeof campaigns;
  catalogue: typeof catalogue;
  crons: typeof crons;
  http: typeof http;
  investors: typeof investors;
  maintenance: typeof maintenance;
  migrations: typeof migrations;
  observability: typeof observability;
  onboarding: typeof onboarding;
  organizations: typeof organizations;
  outreach: typeof outreach;
  participants: typeof participants;
  profiles: typeof profiles;
  providers: typeof providers;
  publicRoutes: typeof publicRoutes;
  rateLimit: typeof rateLimit;
  research: typeof research;
  signups: typeof signups;
  users: typeof users;
  webhooks: typeof webhooks;
  workflows: typeof workflows;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
