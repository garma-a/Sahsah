"""Validate planning artifacts only; no application or provider calls.

Requires jsonschema in the tool environment. --oas-schema can reuse a previously
downloaded official meta-schema without a network fetch.
"""

import argparse
import hashlib
import json
import re
import urllib.request
from datetime import date
from pathlib import Path

import jsonschema


BASE = Path(__file__).resolve().parent
OAS_SCHEMA = "https://spec.openapis.org/oas/3.0/schema/2024-10-18"


def walk(node):
    if isinstance(node, dict):
        yield node
        for value in node.values():
            yield from walk(value)
    elif isinstance(node, list):
        for value in node:
            yield from walk(value)


def json_schema(node):
    if isinstance(node, list):
        return [json_schema(value) for value in node]
    if not isinstance(node, dict):
        return node
    result = {
        key: value.replace("#/components/schemas/", "#/$defs/")
        if key == "$ref"
        else json_schema(value)
        for key, value in node.items()
        if key not in ("nullable", "discriminator")
    }
    if node.get("nullable"):
        if isinstance(result.get("type"), str):
            result["type"] = [result["type"], "null"]
        else:
            return {"anyOf": [result, {"type": "null"}]}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oas-schema", type=Path)
    args = parser.parse_args()
    api = json.loads((BASE / "openapi.json").read_text())
    realtime = json.loads((BASE / "realtime.schema.json").read_text())
    examples = json.loads((BASE / "contract-examples.json").read_text())
    if args.oas_schema:
        meta_bytes = args.oas_schema.read_bytes()
    else:
        with urllib.request.urlopen(OAS_SCHEMA, timeout=20) as response:
            meta_bytes = response.read()
    meta = json.loads(meta_bytes)
    oas_errors = list(jsonschema.validators.validator_for(meta)(meta).iter_errors(api))
    jsonschema.Draft202012Validator.check_schema(realtime)
    definitions = json_schema(api["components"]["schemas"])
    definitions.update(realtime["$defs"])
    checker = jsonschema.FormatChecker()
    fixtures = []
    for example in examples:
        schema = realtime if example["schema"] is None else {
            "$schema": realtime["$schema"],
            "$defs": definitions,
            "$ref": "#/$defs/" + example["schema"],
        }
        valid = jsonschema.Draft202012Validator(
            schema, format_checker=checker
        ).is_valid(example["value"])
        fixtures.append({
            "name": example["name"],
            "expected_valid": example["valid"],
            "actual_valid": valid,
            "passed": valid == example["valid"],
        })

    unresolved = []
    references = 0
    for document_name, document in (("openapi", api), ("realtime", realtime)):
        for node in walk(document):
            reference = node.get("$ref", "")
            if not reference.startswith("#/"):
                continue
            references += 1
            value = document
            try:
                for part in reference[2:].split("/"):
                    value = value[part.replace("~1", "/").replace("~0", "~")]
            except (KeyError, TypeError):
                unresolved.append(document_name + ":" + reference)

    link_count = 0
    missing_links = []
    whitespace = []
    repo = BASE.parent.parent
    documents = [
        *BASE.glob("*.md"),
        *BASE.parent.joinpath("adr").glob("001[2-6]-*.md"),
        repo / "AGENTS.md",
        repo / "CONTEXT.md",
        BASE.parent / "database/gameplay-design.md",
        BASE.parent / "database/operations-and-retention.md",
    ]
    for document in documents:
        source = document.read_text()
        for number, line in enumerate(source.splitlines(), 1):
            if line.rstrip() != line:
                whitespace.append(str(document.relative_to(repo)) + ":" + str(number))
        for target in re.findall(r"\]\(([^)]+)\)", source):
            if re.match(r"^[a-z]+:", target) or target.startswith("#"):
                continue
            link_count += 1
            if not (document.parent / target.split("#", 1)[0]).exists():
                missing_links.append(str(document.relative_to(repo)) + ":" + target)

    operations = [
        value["operationId"]
        for path in api["paths"].values()
        for value in path.values()
    ]
    discriminator_errors = []
    for name, schema in api["components"]["schemas"].items():
        if schema.get("discriminator") and not schema["discriminator"].get("mapping"):
            discriminator_errors.append(name)
    report = {
        "date": str(date.today()),
        "kind": "planning artifact validation only",
        "openapi_schema": OAS_SCHEMA,
        "openapi_schema_sha256": hashlib.sha256(meta_bytes).hexdigest(),
        "openapi_errors": len(oas_errors),
        "operations": len(operations),
        "unique_operation_ids": len(set(operations)),
        "schemas": len(api["components"]["schemas"]),
        "realtime_definitions": len(realtime["$defs"]),
        "local_refs_checked": references,
        "unresolved_refs": unresolved,
        "discriminator_errors": discriminator_errors,
        "json_schema_meta_valid": True,
        "markdown_links_checked": link_count,
        "missing_markdown_links": missing_links,
        "trailing_whitespace": whitespace,
        "fixtures": fixtures,
        "runtime_integration_tests_run": False,
        "railway_load_tests_run": False,
    }
    (BASE / "validation-results.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    )
    failed = [value["name"] for value in fixtures if not value["passed"]]
    print(json.dumps({
        "operations": len(operations),
        "schemas": report["schemas"],
        "realtime_definitions": report["realtime_definitions"],
        "examples_passed": len(fixtures) - len(failed),
        "examples_total": len(fixtures),
        "openapi_errors": len(oas_errors),
        "unresolved_refs": unresolved,
        "missing_links": missing_links,
        "failed_examples": failed,
    }))
    for error in oas_errors[:5]:
        print("/".join(map(str, error.path)), error.message[:240])
    raise SystemExit(bool(
        oas_errors or failed or unresolved or missing_links or whitespace
        or discriminator_errors or len(operations) != len(set(operations))
    ))


if __name__ == "__main__":
    main()
