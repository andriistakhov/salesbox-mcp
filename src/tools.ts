/**
 * MCP tool definitions wrapping the SalesBox public API.
 *
 * Each tool maps to one API endpoint. Tools are grouped by resource
 * (cashback, categories, chats, companies, custom fields, discounts, filters).
 *
 * The optional `token` argument on every tool lets a caller override the
 * server-wide token per request (useful for multi-tenant HTTP deployments).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiRequest, SalesBoxError, type RequestOptions } from "./client.js";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

/** Run an API request and format it as an MCP tool result. */
async function run(opts: RequestOptions): Promise<ToolResult> {
  try {
    const { status, data } = await apiRequest(opts);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ status, data }, null, 2),
        },
      ],
    };
  } catch (err) {
    if (err instanceof SalesBoxError) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { error: err.message, status: err.status, body: err.body },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Request failed: ${message}` }],
      isError: true,
    };
  }
}

/** Token override shared by every tool. */
const tokenArg = {
  token: z
    .string()
    .optional()
    .describe(
      "Optional SalesBox OpenAPI token overriding the server default for this call.",
    ),
};

const langArg = {
  lang: z.string().optional().describe("Language code, e.g. 'uk', 'en', 'ru'."),
};

export function registerTools(server: McpServer): void {
  // ----------------------------------------------------------------------
  // Cashback
  // ----------------------------------------------------------------------
  server.registerTool(
    "salesbox_cashback_list",
    {
      title: "List cashbacks",
      description: "Get the list of cashback rules for the company.",
      inputSchema: { ...langArg, ...tokenArg },
    },
    async ({ lang, token }) =>
      run({ method: "GET", path: "/openapi/cashback", query: { lang }, token }),
  );

  server.registerTool(
    "salesbox_cashback_get",
    {
      title: "Get cashback by id",
      description: "Return a single cashback rule by ID.",
      inputSchema: {
        cashbackId: z.string().describe("Cashback ID"),
        ...tokenArg,
      },
    },
    async ({ cashbackId, token }) =>
      run({
        method: "GET",
        path: `/openapi/cashback/${encodeURIComponent(cashbackId)}`,
        token,
      }),
  );

  server.registerTool(
    "salesbox_cashback_create",
    {
      title: "Create cashback",
      description: "Create a new cashback rule.",
      inputSchema: {
        name: z.string().describe("Cashback name"),
        size: z.number().describe("Cashback size"),
        type: z.string().describe("Cashback type"),
        ...tokenArg,
      },
    },
    async ({ name, size, type, token }) =>
      run({
        method: "POST",
        path: "/openapi/cashback",
        body: { name, size, type },
        token,
      }),
  );

  server.registerTool(
    "salesbox_cashback_update",
    {
      title: "Update cashback",
      description: "Update an existing cashback rule.",
      inputSchema: {
        cashbackId: z.string().describe("Cashback ID"),
        body: z
          .record(z.any())
          .describe("Fields to update (e.g. name, size, type)."),
        ...tokenArg,
      },
    },
    async ({ cashbackId, body, token }) =>
      run({
        method: "PUT",
        path: `/openapi/cashback/${encodeURIComponent(cashbackId)}`,
        body,
        token,
      }),
  );

  server.registerTool(
    "salesbox_cashback_delete",
    {
      title: "Delete cashback",
      description: "Delete a cashback rule by ID.",
      inputSchema: {
        cashbackId: z.string().describe("Cashback ID"),
        ...tokenArg,
      },
    },
    async ({ cashbackId, token }) =>
      run({
        method: "DELETE",
        path: `/openapi/cashback/${encodeURIComponent(cashbackId)}`,
        token,
      }),
  );

  // ----------------------------------------------------------------------
  // Categories
  // ----------------------------------------------------------------------
  server.registerTool(
    "salesbox_categories_list",
    {
      title: "List categories",
      description: "Return list of categories for the company (paginated).",
      inputSchema: {
        ...langArg,
        page: z.number().int().optional().describe("Page number"),
        pageSize: z.number().int().optional().describe("Page size"),
        ...tokenArg,
      },
    },
    async ({ lang, page, pageSize, token }) =>
      run({
        method: "GET",
        path: "/openapi/categories",
        query: { lang, page, pageSize },
        token,
      }),
  );

  server.registerTool(
    "salesbox_category_get",
    {
      title: "Get category by id",
      description:
        "Return one category with direct subcategories. Optionally include custom fields.",
      inputSchema: {
        categoryId: z.string().describe("Category id"),
        ...langArg,
        withCustomFields: z
          .boolean()
          .optional()
          .describe("If true, include customFields in the response."),
        ...tokenArg,
      },
    },
    async ({ categoryId, lang, withCustomFields, token }) =>
      run({
        method: "GET",
        path: `/openapi/categories/${encodeURIComponent(categoryId)}`,
        query: {
          lang,
          withCustomFields:
            withCustomFields === undefined ? undefined : String(withCustomFields),
        },
        token,
      }),
  );

  server.registerTool(
    "salesbox_categories_create_many",
    {
      title: "Create many categories",
      description: "Create multiple categories in one request.",
      inputSchema: {
        categories: z
          .array(z.record(z.any()))
          .describe(
            "Array of category objects (order, names, available, parentId, previewURL, originalURL, internalId, externalId, minimumAllowAge).",
          ),
        ...tokenArg,
      },
    },
    async ({ categories, token }) =>
      run({
        method: "POST",
        path: "/openapi/categories/createMany",
        body: { categories },
        token,
      }),
  );

  server.registerTool(
    "salesbox_categories_update_many",
    {
      title: "Update many categories",
      description: "Update multiple categories. Each item requires `id`.",
      inputSchema: {
        categories: z
          .array(z.record(z.any()))
          .describe("Array of category objects, each with an `id`."),
        ignoreOffersPhotos: z.boolean().optional(),
        ...tokenArg,
      },
    },
    async ({ categories, ignoreOffersPhotos, token }) =>
      run({
        method: "POST",
        path: "/openapi/categories/updateMany",
        query: {
          ignoreOffersPhotos:
            ignoreOffersPhotos === undefined
              ? undefined
              : String(ignoreOffersPhotos),
        },
        body: { categories },
        token,
      }),
  );

  server.registerTool(
    "salesbox_categories_delete",
    {
      title: "Delete categories",
      description: "Delete categories by IDs.",
      inputSchema: {
        ids: z.array(z.string()).describe("Category IDs to delete"),
        ...tokenArg,
      },
    },
    async ({ ids, token }) =>
      run({ method: "DELETE", path: "/openapi/categories", body: { ids }, token }),
  );

  server.registerTool(
    "salesbox_categories_set_ordering",
    {
      title: "Set category order",
      description: "Update display order for categories.",
      inputSchema: {
        ordering: z
          .array(z.object({ id: z.string(), order: z.number().int() }))
          .describe("Array of { id, order } items."),
        ...tokenArg,
      },
    },
    async ({ ordering, token }) =>
      run({
        method: "PUT",
        path: "/openapi/categories/ordering",
        body: { ordering },
        token,
      }),
  );

  // Category custom fields
  server.registerTool(
    "salesbox_category_custom_fields_get",
    {
      title: "Get category custom fields",
      description: "Return custom field definitions and values for a category.",
      inputSchema: {
        categoryId: z.string().describe("Category id"),
        lang: z.string().describe("Language code (required)"),
        filter: z.string().optional().describe("Substring filter on field key"),
        forceGetAll: z
          .boolean()
          .optional()
          .describe("If true, return all fields (admin context)."),
        ...tokenArg,
      },
    },
    async ({ categoryId, lang, filter, forceGetAll, token }) =>
      run({
        method: "GET",
        path: `/openapi/categories/${encodeURIComponent(categoryId)}/custom-fields`,
        query: {
          lang,
          filter,
          forceGetAll:
            forceGetAll === undefined ? undefined : String(forceGetAll),
        },
        token,
      }),
  );

  server.registerTool(
    "salesbox_category_custom_fields_set",
    {
      title: "Set category custom field values",
      description: "Upsert custom field values by key for a category.",
      inputSchema: {
        categoryId: z.string().describe("Category id"),
        fields: z
          .array(z.object({ key: z.string(), value: z.any() }))
          .describe("Array of { key, value } to upsert."),
        ...tokenArg,
      },
    },
    async ({ categoryId, fields, token }) =>
      run({
        method: "PUT",
        path: `/openapi/categories/${encodeURIComponent(categoryId)}/custom-fields`,
        body: { fields },
        token,
      }),
  );

  server.registerTool(
    "salesbox_category_custom_field_clear",
    {
      title: "Clear category custom field value",
      description: "Remove the stored value for a field key (definition stays).",
      inputSchema: {
        categoryId: z.string().describe("Category id"),
        fieldKey: z.string().describe("Field key"),
        ...tokenArg,
      },
    },
    async ({ categoryId, fieldKey, token }) =>
      run({
        method: "DELETE",
        path: `/openapi/categories/${encodeURIComponent(
          categoryId,
        )}/custom-fields/${encodeURIComponent(fieldKey)}`,
        token,
      }),
  );

  // Category SEO
  server.registerTool(
    "salesbox_category_seo_get",
    {
      title: "Get category SEO",
      description: "Return SEO metadata (title, description, keywords, slug).",
      inputSchema: { categoryId: z.string(), ...tokenArg },
    },
    async ({ categoryId, token }) =>
      run({
        method: "GET",
        path: `/openapi/categories/${encodeURIComponent(categoryId)}/seo`,
        token,
      }),
  );

  server.registerTool(
    "salesbox_category_seo_set",
    {
      title: "Set category SEO",
      description:
        "Update SEO metadata. Only the fields you send are updated (title, description, keywords, slug).",
      inputSchema: {
        categoryId: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        keywords: z.string().optional(),
        slug: z.string().optional(),
        ...tokenArg,
      },
    },
    async ({ categoryId, token, ...body }) =>
      run({
        method: "PUT",
        path: `/openapi/categories/${encodeURIComponent(categoryId)}/seo`,
        body,
        token,
      }),
  );

  server.registerTool(
    "salesbox_category_seo_clear_field",
    {
      title: "Clear category SEO field",
      description: "Clear a single SEO field.",
      inputSchema: {
        categoryId: z.string(),
        field: z.enum(["title", "description", "keywords", "slug"]),
        ...tokenArg,
      },
    },
    async ({ categoryId, field, token }) =>
      run({
        method: "DELETE",
        path: `/openapi/categories/${encodeURIComponent(
          categoryId,
        )}/seo/${field}`,
        token,
      }),
  );

  server.registerTool(
    "salesbox_categories_seo_list",
    {
      title: "List category SEO (paginated)",
      description: "Return SEO metadata for company categories, paginated.",
      inputSchema: {
        page: z.number().int().optional(),
        pageSize: z.number().int().optional(),
        ...tokenArg,
      },
    },
    async ({ page, pageSize, token }) =>
      run({
        method: "GET",
        path: "/openapi/categories/seo",
        query: { page, pageSize },
        token,
      }),
  );

  server.registerTool(
    "salesbox_categories_seo_update_many",
    {
      title: "Bulk update category SEO",
      description:
        "Update SEO metadata for up to 100 categories. Each item needs `id` plus at least one SEO field.",
      inputSchema: {
        categories: z
          .array(z.record(z.any()))
          .describe("Array of { id, title?, description?, keywords?, slug? }."),
        ...tokenArg,
      },
    },
    async ({ categories, token }) =>
      run({
        method: "POST",
        path: "/openapi/categories/seo/updateMany",
        body: { categories },
        token,
      }),
  );

  server.registerTool(
    "salesbox_categories_seo_delete_many",
    {
      title: "Bulk clear category SEO",
      description:
        "Clear SEO fields for up to 100 categories. Omit `fields` to clear all.",
      inputSchema: {
        ids: z.array(z.string()).describe("Category IDs"),
        fields: z
          .array(z.enum(["title", "description", "keywords", "slug"]))
          .optional()
          .describe("Which fields to clear; omit to clear all."),
        ...tokenArg,
      },
    },
    async ({ ids, fields, token }) =>
      run({
        method: "DELETE",
        path: "/openapi/categories/seo",
        body: { ids, ...(fields ? { fields } : {}) },
        token,
      }),
  );

  // ----------------------------------------------------------------------
  // Chats
  // ----------------------------------------------------------------------
  server.registerTool(
    "salesbox_chats_by_user",
    {
      title: "Get user chats by status",
      description:
        "List chats for a user filtered by status (active or archived).",
      inputSchema: {
        userId: z.string().describe("User ID"),
        status: z.enum(["active", "archived"]),
        ...langArg,
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
        ...tokenArg,
      },
    },
    async ({ userId, status, lang, page, pageSize, token }) =>
      run({
        method: "GET",
        path: `/openapi/chats/byUser/${encodeURIComponent(
          userId,
        )}/${status}`,
        query: { lang, page, pageSize },
        token,
      }),
  );

  server.registerTool(
    "salesbox_chat_send_message",
    {
      title: "Send chat message",
      description:
        "Send a message to a chat. May include text, offers, orders, images, file.",
      inputSchema: {
        chatId: z.string().describe("Chat ID"),
        ...langArg,
        text: z.string().optional().describe("Message text"),
        offers: z
          .array(z.object({ id: z.string() }))
          .optional()
          .describe("Offer IDs to attach"),
        orders: z
          .array(z.object({ id: z.string() }))
          .optional()
          .describe("Order IDs to attach"),
        images: z
          .array(z.object({ url: z.string() }))
          .optional()
          .describe("Image URLs to attach"),
        file: z.string().nullable().optional().describe("File attachment URL"),
        ...tokenArg,
      },
    },
    async ({ chatId, lang, token, ...body }) =>
      run({
        method: "POST",
        path: `/openapi/chats/${encodeURIComponent(chatId)}/messages`,
        query: { lang },
        body,
        token,
      }),
  );

  // ----------------------------------------------------------------------
  // Companies
  // ----------------------------------------------------------------------
  server.registerTool(
    "salesbox_company_custom_fields_get",
    {
      title: "Get company custom fields",
      description: "Return company-level custom field definitions and values.",
      inputSchema: {
        lang: z.string().describe("Language code (required)"),
        filter: z.string().optional(),
        forceGetAll: z.boolean().optional(),
        ...tokenArg,
      },
    },
    async ({ lang, filter, forceGetAll, token }) =>
      run({
        method: "GET",
        path: "/openapi/company/custom-fields",
        query: {
          lang,
          filter,
          forceGetAll:
            forceGetAll === undefined ? undefined : String(forceGetAll),
        },
        token,
      }),
  );

  server.registerTool(
    "salesbox_company_custom_fields_set",
    {
      title: "Set company custom field values",
      description: "Upsert company-level custom field values by key.",
      inputSchema: {
        fields: z.array(z.object({ key: z.string(), value: z.any() })),
        ...tokenArg,
      },
    },
    async ({ fields, token }) =>
      run({
        method: "PUT",
        path: "/openapi/company/custom-fields",
        body: { fields },
        token,
      }),
  );

  server.registerTool(
    "salesbox_company_custom_field_clear",
    {
      title: "Clear company custom field value",
      description: "Remove the stored value for a company field key.",
      inputSchema: { fieldKey: z.string(), ...tokenArg },
    },
    async ({ fieldKey, token }) =>
      run({
        method: "DELETE",
        path: `/openapi/company/custom-fields/${encodeURIComponent(fieldKey)}`,
        token,
      }),
  );

  server.registerTool(
    "salesbox_company_seo_get",
    {
      title: "Get company SEO",
      description: "Return company SEO metadata (title, description, keywords).",
      inputSchema: { ...tokenArg },
    },
    async ({ token }) =>
      run({ method: "GET", path: "/openapi/company/seo", token }),
  );

  server.registerTool(
    "salesbox_company_seo_set",
    {
      title: "Set company SEO",
      description:
        "Update company SEO metadata. Only sent fields are updated (title, description, keywords).",
      inputSchema: {
        title: z.string().optional(),
        description: z.string().optional(),
        keywords: z.string().optional(),
        ...tokenArg,
      },
    },
    async ({ token, ...body }) =>
      run({ method: "PUT", path: "/openapi/company/seo", body, token }),
  );

  server.registerTool(
    "salesbox_company_seo_clear_field",
    {
      title: "Clear company SEO field",
      description: "Clear a single company SEO field.",
      inputSchema: {
        field: z.enum(["title", "description", "keywords"]),
        ...tokenArg,
      },
    },
    async ({ field, token }) =>
      run({ method: "DELETE", path: `/openapi/company/seo/${field}`, token }),
  );

  // ----------------------------------------------------------------------
  // Custom field definitions
  // ----------------------------------------------------------------------
  server.registerTool(
    "salesbox_custom_field_definitions_list",
    {
      title: "List custom field definitions",
      description:
        "List custom field definitions, optionally filtered by entity type.",
      inputSchema: {
        entityType: z.enum(["user", "order", "offer"]).optional(),
        ...tokenArg,
      },
    },
    async ({ entityType, token }) =>
      run({
        method: "GET",
        path: "/openapi/custom-fields/definitions",
        query: { entityType },
        token,
      }),
  );

  server.registerTool(
    "salesbox_custom_field_definition_create",
    {
      title: "Create custom field definition",
      description:
        "Create a custom field definition. Key must match [a-z][a-z0-9_]* and be unique per entity type.",
      inputSchema: {
        body: z
          .record(z.any())
          .describe("Definition payload (key, entityType, type, label, etc.)."),
        ...tokenArg,
      },
    },
    async ({ body, token }) =>
      run({
        method: "POST",
        path: "/openapi/custom-fields/definitions",
        body,
        token,
      }),
  );

  server.registerTool(
    "salesbox_custom_field_definition_update",
    {
      title: "Update custom field definition",
      description: "Update an existing definition. Only provided fields change.",
      inputSchema: {
        fieldId: z.string().describe("Field definition ID"),
        body: z.record(z.any()).describe("Fields to update."),
        ...tokenArg,
      },
    },
    async ({ fieldId, body, token }) =>
      run({
        method: "PATCH",
        path: `/openapi/custom-fields/definitions/${encodeURIComponent(fieldId)}`,
        body,
        token,
      }),
  );

  server.registerTool(
    "salesbox_custom_field_definition_delete",
    {
      title: "Delete custom field definition",
      description: "Soft-delete a custom field definition by ID.",
      inputSchema: { fieldId: z.string(), ...tokenArg },
    },
    async ({ fieldId, token }) =>
      run({
        method: "DELETE",
        path: `/openapi/custom-fields/definitions/${encodeURIComponent(fieldId)}`,
        token,
      }),
  );

  // ----------------------------------------------------------------------
  // Discounts
  // ----------------------------------------------------------------------
  server.registerTool(
    "salesbox_discounts_list",
    {
      title: "List discounts",
      description: "List company discounts.",
      inputSchema: { ...tokenArg },
    },
    async ({ token }) =>
      run({ method: "GET", path: "/openapi/discounts", token }),
  );

  server.registerTool(
    "salesbox_discount_get",
    {
      title: "Get discount by id",
      description: "Return one discount. Optional lang for category titles.",
      inputSchema: {
        discountId: z.string(),
        ...langArg,
        ...tokenArg,
      },
    },
    async ({ discountId, lang, token }) =>
      run({
        method: "GET",
        path: `/openapi/discounts/${encodeURIComponent(discountId)}`,
        query: { lang },
        token,
      }),
  );

  server.registerTool(
    "salesbox_discount_create",
    {
      title: "Create discount",
      description:
        "Create a discount. Required: name (min 2), discount (1-99), categories (may be empty).",
      inputSchema: {
        name: z.string().min(2),
        discount: z.number().int().min(1).max(99),
        categories: z.array(z.string()).describe("Category IDs (may be empty)"),
        offers: z.array(z.string()).optional(),
        users: z.array(z.string()).optional(),
        groups: z.array(z.string()).optional(),
        forAllUsers: z.boolean().optional(),
        dateStart: z.string().optional().describe("ISO date"),
        dateFinish: z.string().nullable().optional().describe("ISO date"),
        hideTextDiscount: z.boolean().optional(),
        ...tokenArg,
      },
    },
    async ({ token, ...body }) =>
      run({ method: "POST", path: "/openapi/discounts", body, token }),
  );

  server.registerTool(
    "salesbox_discount_update",
    {
      title: "Update discount",
      description: "Update a discount by ID (same fields as create).",
      inputSchema: {
        discountId: z.string(),
        body: z.record(z.any()).describe("Discount fields to update."),
        ...tokenArg,
      },
    },
    async ({ discountId, body, token }) =>
      run({
        method: "PUT",
        path: `/openapi/discounts/${encodeURIComponent(discountId)}`,
        body,
        token,
      }),
  );

  server.registerTool(
    "salesbox_discount_delete",
    {
      title: "Delete discount",
      description: "Delete one discount by ID.",
      inputSchema: { discountId: z.string(), ...tokenArg },
    },
    async ({ discountId, token }) =>
      run({
        method: "DELETE",
        path: `/openapi/discounts/${encodeURIComponent(discountId)}`,
        token,
      }),
  );

  server.registerTool(
    "salesbox_discounts_delete_many",
    {
      title: "Delete many discounts",
      description: "Delete several discounts by IDs.",
      inputSchema: {
        ids: z.array(z.string()).min(1),
        ...tokenArg,
      },
    },
    async ({ ids, token }) =>
      run({ method: "DELETE", path: "/openapi/discounts", body: { ids }, token }),
  );

  // ----------------------------------------------------------------------
  // Filters
  // ----------------------------------------------------------------------
  server.registerTool(
    "salesbox_filters_list",
    {
      title: "List filters",
      description: "Return filter parameters (attributes) for the company.",
      inputSchema: { ...langArg, ...tokenArg },
    },
    async ({ lang, token }) =>
      run({
        method: "GET",
        path: "/openapi/filters/params",
        query: { lang },
        token,
      }),
  );

  server.registerTool(
    "salesbox_filters_create_many",
    {
      title: "Create many filters",
      description: "Create multiple filter parameters.",
      inputSchema: {
        body: z
          .record(z.any())
          .describe("FilterParamsCreateManyRequest payload."),
        ...tokenArg,
      },
    },
    async ({ body, token }) =>
      run({
        method: "POST",
        path: "/openapi/filters/params/createMany",
        body,
        token,
      }),
  );

  server.registerTool(
    "salesbox_filters_update_many",
    {
      title: "Update many filters",
      description: "Update multiple filter parameters.",
      inputSchema: {
        body: z.record(z.any()).describe("Update payload."),
        ...tokenArg,
      },
    },
    async ({ body, token }) =>
      run({
        method: "PUT",
        path: "/openapi/filters/params/updateMany",
        body,
        token,
      }),
  );

  server.registerTool(
    "salesbox_filters_delete_many",
    {
      title: "Delete many filters",
      description: "Delete multiple filter parameters by IDs.",
      inputSchema: {
        ids: z.array(z.string()),
        ...tokenArg,
      },
    },
    async ({ ids, token }) =>
      run({
        method: "DELETE",
        path: "/openapi/filters/params/deleteMany",
        body: { ids },
        token,
      }),
  );

  // ----------------------------------------------------------------------
  // Generic escape hatch — call any /openapi/* endpoint not covered above.
  // ----------------------------------------------------------------------
  server.registerTool(
    "salesbox_raw_request",
    {
      title: "Raw SalesBox API request",
      description:
        "Call any SalesBox /openapi/* endpoint directly. Use when no dedicated tool exists.",
      inputSchema: {
        method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
        path: z
          .string()
          .describe("Path beginning with /openapi/ , e.g. /openapi/offers"),
        query: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
        body: z.any().optional(),
        ...tokenArg,
      },
    },
    async ({ method, path, query, body, token }) =>
      run({ method, path, query, body, token }),
  );
}
