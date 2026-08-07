import { describe, expect, it } from "vitest";

import {
	assertFileWithinEmDashMediaUploadLimit,
	EMDASH_DEFAULT_MAX_UPLOAD_BYTES,
	formatEmDashMediaLimitShort,
} from "./emdash-media-limits.ts";

describe("emdash-media-limits", () => {
	it("formats round megabytes", () => {
		expect(formatEmDashMediaLimitShort(52_428_800)).toBe("50 MB");
	});

	it("allows files at or under the cap", () => {
		const ok = new File([new Uint8Array([1])], "tiny.png", { type: "image/png" });
		expect(() =>
			assertFileWithinEmDashMediaUploadLimit(ok, EMDASH_DEFAULT_MAX_UPLOAD_BYTES),
		).not.toThrow();
	});

	it("rejects files over the cap", () => {
		const blob = new Uint8Array(2048);
		const file = new File([blob], "huge.png", { type: "image/png" });
		expect(() => assertFileWithinEmDashMediaUploadLimit(file, 1024)).toThrow(
			/exceeds max upload size/,
		);
	});
});
