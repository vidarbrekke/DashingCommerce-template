#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const PLUGIN_ID = "commerce";
const DB_PATH = path.resolve(process.cwd(), "data.db");
const FIXTURES_PATH = new URL("../.emdash/commerce-fixtures.json", import.meta.url);

function sqlValue(value) {
	const text = String(value ?? "");
	return `'${text.replaceAll("'", "''")}'`;
}

function buildInventoryStockDocId(productId, variantId) {
	return `stock:${encodeURIComponent(productId)}:${encodeURIComponent(variantId)}`;
}

function buildInventoryStockEntries(fixtures) {
	const products = Array.isArray(fixtures.products) ? fixtures.products : [];
	const productSkus = Array.isArray(fixtures.productSkus) ? fixtures.productSkus : [];
	const skusByProduct = new Map();
	const rowsById = new Map();

	const addRow = (row) => {
		if (rowsById.has(row.id)) {
			return;
		}
		rowsById.set(row.id, row);
	};

	for (const sku of productSkus) {
		if (!sku?.id) {
			throw new Error(`Missing id for product SKU ${sku?.productId || "<unknown>"}`);
		}
		if (!sku?.productId) {
			throw new Error(`Missing productId for product SKU ${sku.id}`);
		}

		const createdAt = sku.createdAt ?? new Date().toISOString();
		const updatedAt = sku.updatedAt ?? createdAt;

		addRow({
			id: buildInventoryStockDocId(sku.productId, sku.id),
			productId: sku.productId,
			variantId: sku.id,
			quantity: Number(sku.inventoryQuantity ?? 0),
			version: Number(sku.inventoryVersion ?? 1),
			updatedAt,
		});
		const list = skusByProduct.get(sku.productId) ?? [];
		list.push(sku);
		skusByProduct.set(sku.productId, list);
	}

	for (const product of products) {
		if (product.type === "variable") {
			continue;
		}
		const relatedSkus = skusByProduct.get(product.id);
		if (!relatedSkus || relatedSkus.length !== 1) {
			continue;
		}

		const sku = relatedSkus[0];
		if (!sku || !sku.id) {
			continue;
		}
		const updatedAt = sku.updatedAt ?? sku.createdAt ?? new Date().toISOString();

		addRow({
			id: buildInventoryStockDocId(product.id, ""),
			productId: product.id,
			variantId: "",
			quantity: Number(sku.inventoryQuantity ?? 0),
			version: Number(sku.inventoryVersion ?? 1),
			updatedAt,
		});
	}

	return [...rowsById.values()];
}

function buildSeedEntries(fixtures) {
	const catalogTerms = Array.isArray(fixtures.catalogTerms) ? fixtures.catalogTerms : [];
	return [
		["products", fixtures.products],
		["productSkus", fixtures.productSkus],
		["productAttributes", fixtures.productAttributes],
		["productAttributeValues", fixtures.productAttributeValues],
		["productSkuOptionValues", fixtures.productSkuOptionValues],
		["categories", fixtures.categories],
		["productCategoryLinks", fixtures.productCategoryLinks],
		["catalogTerms", catalogTerms],
		["productTagLinks", fixtures.productTagLinks],
		["inventoryStock", buildInventoryStockEntries(fixtures)],
		["orders", fixtures.orders ?? []],
	];
}

function buildSeedSql(seedEntries) {
	let sql = "BEGIN TRANSACTION;\n";
	const template = `INSERT INTO _plugin_storage (plugin_id, collection, id, data, created_at, updated_at)
\t\t VALUES (${sqlValue(PLUGIN_ID)}, @collection, @id, @data, @createdAt, @updatedAt)
\t\t ON CONFLICT(plugin_id, collection, id) DO UPDATE SET
\t\t   data = excluded.data,
\t\t   updated_at = excluded.updated_at;\n`;

	for (const [collection, rows] of seedEntries) {
		const safeCollection = sqlValue(collection);
		for (const row of rows ?? []) {
			if (!row?.id) {
				throw new Error(`Missing id for collection ${collection}`);
			}

			const createdAt = row.createdAt ?? new Date().toISOString();
			const updatedAt = row.updatedAt ?? createdAt;
			sql += template
				.replace("@collection", safeCollection)
				.replace("@id", sqlValue(row.id))
				.replace("@data", sqlValue(JSON.stringify(row)))
				.replace("@createdAt", sqlValue(createdAt))
				.replace("@updatedAt", sqlValue(updatedAt));
		}
	}

	sql += "COMMIT;\n";
	return sql;
}

function runWithSqliteCli(sql) {
	const check = spawnSync("sqlite3", ["-version"], { encoding: "utf8" });
	if (check.status !== 0) {
		return false;
	}

	const result = spawnSync("sqlite3", [DB_PATH], {
		input: sql,
		encoding: "utf8",
	});
	if (result.status !== 0) {
		throw new Error(
			`sqlite3 command failed with status ${result.status}: ${result.stderr || result.stdout || "unknown"}`,
		);
	}
	return true;
}

async function main() {
	if (!existsSync(DB_PATH)) {
		throw new Error(`EmDash database missing at ${DB_PATH}. Run emdash init/emdash seed first.`);
	}

	const raw = await readFile(FIXTURES_PATH, "utf8");
	const fixtures = JSON.parse(raw);

	const seedEntries = buildSeedEntries(fixtures);
	const seedSql = buildSeedSql(seedEntries);
	const usedSqliteCli = runWithSqliteCli(seedSql);
	if (!usedSqliteCli) {
		throw new Error(
			"sqlite3 binary unavailable. Install sqlite3 CLI or restore better-sqlite3 native bindings.",
		);
	}

	console.log("Commerce fixture seed complete for plugin", PLUGIN_ID);
}

main().catch((error) => {
	console.error("Commerce fixture seed failed:", error);
	process.exitCode = 1;
});
