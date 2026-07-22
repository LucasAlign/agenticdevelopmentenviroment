import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const workflowPath = join(
	import.meta.dirname,
	"../../../.github/workflows/build-desktop.yml",
);
const workflow = readFileSync(workflowPath, "utf8");
const betaWorkflow = readFileSync(
	join(import.meta.dirname, "../../../.github/workflows/release-desktop-beta.yml"),
	"utf8",
);
const stableWorkflow = readFileSync(
	join(import.meta.dirname, "../../../.github/workflows/release-desktop.yml"),
	"utf8",
);

describe("desktop build workflow", () => {
	test("does not expose an empty signing certificate as CSC_LINK", () => {
		expect(workflow).not.toContain(
			"CSC_LINK: $" + "{{ secrets.MAC_CERTIFICATE }}",
		);
		expect(workflow).toContain('if [[ -n "$MAC_CERTIFICATE" ]]');
		expect(workflow).toContain(
			'printf \'CSC_LINK=%s\\n\' "$MAC_CERTIFICATE" >> "$GITHUB_ENV"',
		);
		expect(workflow).toContain(
			'echo "CSC_IDENTITY_AUTO_DISCOVERY=false" >> "$GITHUB_ENV"',
		);
	});
});

describe("desktop beta workflow", () => {
	test("checks release-tag uniqueness without an expected failing command", () => {
		expect(betaWorkflow).not.toContain("gh release view $tag");
		expect(betaWorkflow).toContain("gh release list `");
		expect(betaWorkflow).toContain("$existingReleaseTags -contains $tag");
	});

	test("does not invoke the Bash-only root postinstall on Windows", () => {
		expect(betaWorkflow).toContain("bun install --frozen --ignore-scripts");
		expect(betaWorkflow).toContain(
			"bun run --filter=@ade/desktop install:deps",
		);
	});

	test("expects staged assets in lexical order during handoff", () => {
		expect(betaWorkflow).toContain(
			'"${expected_installer} SHA256SUMS.txt "',
		);
	});
});

describe("stable desktop release workflow", () => {
	test("does not claim private beta tags", () => {
		expect(stableWorkflow).toContain(
			"if: ${{ !contains(github.ref_name, '-beta.') }}",
		);
		expect(stableWorkflow).toContain(
			"!contains(github.ref_name, '-beta.')",
		);
	});
});
