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
import type * as authz from "../authz.js";
import type * as campaigns from "../campaigns.js";
import type * as catalogue from "../catalogue.js";
import type * as crons from "../crons.js";
import type * as founder from "../founder.js";
import type * as maintenance from "../maintenance.js";
import type * as organizations from "../organizations.js";
import type * as profiles from "../profiles.js";
import type * as signups from "../signups.js";
import type * as webhooks from "../webhooks.js";
import type * as workflows from "../workflows.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  authz: typeof authz;
  campaigns: typeof campaigns;
  catalogue: typeof catalogue;
  crons: typeof crons;
  founder: typeof founder;
  maintenance: typeof maintenance;
  organizations: typeof organizations;
  profiles: typeof profiles;
  signups: typeof signups;
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
